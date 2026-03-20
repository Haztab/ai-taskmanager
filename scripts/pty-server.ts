/**
 * Standalone WebSocket PTY server for Claude interactions.
 * Runs on port 3100. The FE connects via xterm.js + WebSocket.
 *
 * Actions:
 *   ?action=login           — interactive `claude auth login`
 *   ?action=status           — auth status check (returns JSON, closes)
 *   ?action=logout           — auth logout (returns JSON, closes)
 *   ?action=execute&cwd=...  — interactive Claude session in a directory
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
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const action = url.searchParams.get("action") || "login";
  const binary = getClaudeBinary();
  console.log(`[pty-server] client connected, action=${action}, binary=${binary}`);

  // --- STATUS ---
  if (action === "status") {
    const status = getAuthStatus();
    ws.send(JSON.stringify({ type: "status", ...status }));
    ws.close();
    return;
  }

  // --- LOGOUT ---
  if (action === "logout") {
    try {
      execSync(`${binary} auth logout 2>&1`, { encoding: "utf-8", timeout: 10000 });
    } catch { /* ok */ }
    ws.send(JSON.stringify({ type: "logout", success: true }));
    ws.close();
    return;
  }

  // --- LOGIN --- spawn PTY for `claude auth login`
  if (action === "login") {
    const shell = pty.spawn(binary, ["auth", "login"], {
      name: "xterm-256color",
      cols: 100,
      rows: 24,
      env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
    });

    console.log(`[pty-server] spawned claude auth login, pid=${shell.pid}`);
    wireUpPty(ws, shell, () => {
      const status = getAuthStatus();
      console.log(`[pty-server] auth status: loggedIn=${status.loggedIn}`);
      return { type: "exit", ...status };
    });
    return;
  }

  // --- EXECUTE --- spawn interactive Claude session in a working directory
  if (action === "execute") {
    const cwd = url.searchParams.get("cwd") || process.cwd();
    console.log(`[pty-server] execute in cwd=${cwd}`);

    const shell = pty.spawn(binary, [], {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd,
      env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
    });

    console.log(`[pty-server] spawned interactive claude, pid=${shell.pid}`);
    wireUpPty(ws, shell, () => ({ type: "exit" }));
    return;
  }

  ws.send(JSON.stringify({ type: "error", message: `Unknown action: ${action}` }));
  ws.close();
});

/**
 * Wire a PTY process to a WebSocket connection.
 * Handles bidirectional data, resize, and cleanup.
 */
function wireUpPty(
  ws: WebSocket,
  shell: pty.IPty,
  onExit?: () => Record<string, unknown>
) {
  // PTY → WebSocket
  shell.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // WebSocket → PTY (user keystrokes or control messages)
  ws.on("message", (msg: Buffer | string) => {
    const str = typeof msg === "string" ? msg : msg.toString();
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "resize") {
        shell.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {
      // Not JSON — raw keystroke input
    }
    shell.write(str);
  });

  shell.onExit(({ exitCode }) => {
    console.log(`[pty-server] process exited, code=${exitCode}`);
    if (ws.readyState === WebSocket.OPEN) {
      const exitMsg = onExit ? onExit() : { type: "exit" };
      ws.send(JSON.stringify({ ...exitMsg, exitCode }));
      ws.close();
    }
  });

  ws.on("close", () => {
    console.log(`[pty-server] client disconnected`);
    try { shell.kill(); } catch { /* ok */ }
  });
}
