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
import * as fs from "fs";

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

// Resolve the real binary path (follow symlinks) for node-pty
function resolveRealPath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[pty-server] listening on ws://localhost:${PORT}`);

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const action = url.searchParams.get("action") || "login";
  const binary = resolveRealPath(getClaudeBinary());
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

  // --- LOGIN ---
  if (action === "login") {
    try {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to spawn Claude";
      console.error(`[pty-server] login spawn failed:`, msg);
      ws.send(JSON.stringify({ type: "error", message: msg }));
      ws.close();
    }
    return;
  }

  // --- EXECUTE --- interactive Claude session (no auto-prompt)
  if (action === "execute") {
    const cwd = url.searchParams.get("cwd") || process.cwd();
    console.log(`[pty-server] execute in cwd=${cwd}`);

    if (!fs.existsSync(cwd)) {
      console.error(`[pty-server] cwd does not exist: ${cwd}`);
      ws.send(JSON.stringify({ type: "error", message: `Directory does not exist: ${cwd}` }));
      ws.close();
      return;
    }

    try {
      const shell = pty.spawn(binary, [], {
        name: "xterm-256color",
        cols: 100,
        rows: 30,
        cwd,
        env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
      });

      console.log(`[pty-server] spawned interactive claude, pid=${shell.pid}`);
      wireUpPty(ws, shell, () => ({ type: "exit" }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to spawn Claude";
      console.error(`[pty-server] spawn failed:`, msg);
      ws.send(JSON.stringify({ type: "error", message: msg }));
      ws.close();
    }
    return;
  }

  // --- RUN --- auto-run a prompt with no confirmations, streams output via PTY
  if (action === "run") {
    const cwd = url.searchParams.get("cwd") || process.cwd();
    console.log(`[pty-server] run in cwd=${cwd}`);

    if (!fs.existsSync(cwd)) {
      ws.send(JSON.stringify({ type: "error", message: `Directory does not exist: ${cwd}` }));
      ws.close();
      return;
    }

    // Collect messages until we get the prompt
    const messageQueue: string[] = [];
    let shell: pty.IPty | null = null;

    ws.on("message", (msg: Buffer | string) => {
      const str = typeof msg === "string" ? msg : msg.toString();

      // If shell already spawned, forward to it (for resize etc)
      if (shell) {
        try {
          const parsed = JSON.parse(str);
          if (parsed.type === "resize") {
            shell.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch { /* not JSON */ }
        return;
      }

      // Skip resize messages while waiting for prompt
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === "resize") return;
        if (parsed.type === "prompt" && parsed.text) {
          // Got the prompt — spawn Claude
          const prompt = parsed.text;
          console.log(`[pty-server] got prompt (${prompt.length} chars), spawning...`);

          const tmpFile = `/tmp/claude-task-${Date.now()}.txt`;
          fs.writeFileSync(tmpFile, prompt, "utf-8");

          try {
            shell = pty.spawn("/bin/bash", [
              "-c",
              `cat "${tmpFile}" | "${binary}" -p --dangerously-skip-permissions 2>&1; EXIT=$?; rm -f "${tmpFile}"; exit $EXIT`,
            ], {
              name: "xterm-256color",
              cols: 100,
              rows: 30,
              cwd,
              env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
            });

            console.log(`[pty-server] spawned claude run, pid=${shell.pid}`);

            // PTY output → WebSocket
            shell.onData((data: string) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
              }
            });

            shell.onExit(({ exitCode }) => {
              console.log(`[pty-server] run exited, code=${exitCode}`);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "exit", status: exitCode === 0 ? "completed" : "failed", exitCode }));
                ws.close();
              }
            });
          } catch (err: unknown) {
            try { fs.unlinkSync(tmpFile); } catch { /* ok */ }
            const errMsg = err instanceof Error ? err.message : "Failed to spawn";
            console.error(`[pty-server] run spawn failed:`, errMsg);
            ws.send(JSON.stringify({ type: "error", message: errMsg }));
            ws.close();
          }
          return;
        }
      } catch { /* not JSON */ }
    });

    ws.on("close", () => {
      console.log(`[pty-server] run client disconnected`);
      if (shell) {
        try { shell.kill(); } catch { /* ok */ }
      }
    });

    return;
  }

  ws.send(JSON.stringify({ type: "error", message: `Unknown action: ${action}` }));
  ws.close();
});

/**
 * Wire a PTY process to a WebSocket connection.
 */
function wireUpPty(
  ws: WebSocket,
  shell: pty.IPty,
  onExit?: () => Record<string, unknown>
) {
  // PTY → WebSocket
  shell.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      // node-pty gives strings, but ws may still send as binary.
      // Wrapping in a JSON envelope ensures text frame delivery.
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
