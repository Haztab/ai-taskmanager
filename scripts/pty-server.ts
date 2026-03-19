/**
 * Standalone WebSocket PTY server for claude auth login.
 * Runs on port 3100. The FE connects via xterm.js + WebSocket.
 *
 * Usage: npx tsx scripts/pty-server.ts
 */
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { execSync } from "child_process";

const PORT = 3100;

function getClaudeBinary(): string {
  try {
    return execSync("which claude 2>/dev/null", { encoding: "utf-8", timeout: 3000 }).trim();
  } catch {
    return "claude";
  }
}

function getAuthStatus(): { loggedIn: boolean; email?: string } {
  try {
    const binary = getClaudeBinary();
    const out = execSync(`${binary} auth status 2>&1`, { encoding: "utf-8", timeout: 10000 }).trim();
    const data = JSON.parse(out);
    return { loggedIn: data.loggedIn === true, email: data.email };
  } catch {
    return { loggedIn: false };
  }
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[pty-server] listening on ws://localhost:${PORT}`);

wss.on("connection", (ws: WebSocket, req) => {
  const action = new URL(req.url || "/", `http://localhost:${PORT}`).searchParams.get("action") || "login";
  const binary = getClaudeBinary();
  console.log(`[pty-server] client connected, action=${action}, binary=${binary}`);

  if (action === "status") {
    const status = getAuthStatus();
    ws.send(JSON.stringify({ type: "status", ...status }));
    ws.close();
    return;
  }

  if (action === "logout") {
    try {
      execSync(`${binary} auth logout 2>&1`, { encoding: "utf-8", timeout: 10000 });
    } catch { /* ok */ }
    ws.send(JSON.stringify({ type: "logout", success: true }));
    ws.close();
    return;
  }

  // action === "login" — spawn PTY
  const shell = pty.spawn(binary, ["auth", "login"], {
    name: "xterm-256color",
    cols: 100,
    rows: 24,
    env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
  });

  console.log(`[pty-server] spawned claude auth login, pid=${shell.pid}`);

  // PTY → WebSocket
  shell.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // WebSocket → PTY (user keystrokes)
  ws.on("message", (msg: Buffer | string) => {
    const str = typeof msg === "string" ? msg : msg.toString();
    // Handle resize messages
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "resize") {
        shell.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch { /* not JSON, it's raw input */ }
    shell.write(str);
  });

  shell.onExit(({ exitCode }) => {
    console.log(`[pty-server] claude exited, code=${exitCode}`);
    // Check final auth status
    const status = getAuthStatus();
    console.log(`[pty-server] auth status: loggedIn=${status.loggedIn}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "exit", exitCode, ...status }));
      ws.close();
    }
  });

  ws.on("close", () => {
    console.log(`[pty-server] client disconnected`);
    try { shell.kill(); } catch { /* ok */ }
  });
});
