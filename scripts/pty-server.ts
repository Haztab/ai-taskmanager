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
import { execSync, spawn } from "child_process";
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

  // --- RUN --- auto-run with detailed progress via stream-json
  if (action === "run") {
    const cwd = url.searchParams.get("cwd") || process.cwd();
    console.log(`[pty-server] run in cwd=${cwd}`);

    if (!fs.existsSync(cwd)) {
      ws.send(JSON.stringify({ type: "error", message: `Directory does not exist: ${cwd}` }));
      ws.close();
      return;
    }

    let child: ReturnType<typeof spawn> | null = null;

    ws.on("message", (msg: Buffer | string) => {
      const str = typeof msg === "string" ? msg : msg.toString();

      if (child) return; // Already spawned

      try {
        const parsed = JSON.parse(str);
        if (parsed.type === "resize") return;
        if (parsed.type === "prompt" && parsed.text) {
          const prompt = parsed.text;
          console.log(`[pty-server] got prompt (${prompt.length} chars), spawning stream-json...`);

          const tmpFile = `/tmp/claude-task-${Date.now()}.txt`;
          fs.writeFileSync(tmpFile, prompt, "utf-8");

          child = spawn("bash", [
            "-c",
            `cat "${tmpFile}" | "${binary}" -p --dangerously-skip-permissions --verbose --output-format stream-json 2>&1; rm -f "${tmpFile}"`,
          ], { cwd, env: { ...process.env }, stdio: ["pipe", "pipe", "pipe"] });

          console.log(`[pty-server] spawned claude stream-json, pid=${child.pid}`);

          let buffer = "";
          let turnNum = 0;

          child.stdout?.on("data", (data: Buffer) => {
            buffer += data.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              try {
                const event = JSON.parse(trimmed);
                const formatted = formatStreamEvent(event, turnNum);
                if (formatted) {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(formatted);
                  }
                }
                // Track turns
                if (event.type === "assistant") turnNum++;
              } catch {
                // Not JSON, send raw
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(trimmed + "\r\n");
                }
              }
            }
          });

          child.stderr?.on("data", (data: Buffer) => {
            const text = data.toString();
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(`\x1b[31m${text}\x1b[0m`);
            }
          });

          child.on("close", (code) => {
            console.log(`[pty-server] stream-json exited, code=${code}`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "exit", status: code === 0 ? "completed" : "failed", exitCode: code }));
              ws.close();
            }
          });

          child.on("error", (err) => {
            console.error(`[pty-server] process error:`, err.message);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "error", message: err.message }));
              ws.close();
            }
          });

          return;
        }
      } catch { /* not JSON */ }
    });

    ws.on("close", () => {
      console.log(`[pty-server] run client disconnected`);
      if (child) {
        try { child.kill(); } catch { /* ok */ }
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

// ANSI color helpers
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[90m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bgDim: "\x1b[48;5;236m",
};

const TOOL_ICONS: Record<string, string> = {
  Write: "📝",
  Edit: "✏️",
  Read: "📖",
  Bash: "⚡",
  Glob: "🔍",
  Grep: "🔎",
  WebFetch: "🌐",
  WebSearch: "🔎",
  TodoWrite: "📋",
  Agent: "🤖",
  Task: "📋",
  NotebookEdit: "📓",
};

/**
 * Format a Claude stream-json event into colored terminal output.
 */
function formatStreamEvent(event: Record<string, unknown>, turnNum: number): string | null {
  const type = event.type as string;

  // System init — show model info
  if (type === "system" && event.subtype === "init") {
    const model = (event.model as string) || "unknown";
    return `${C.dim}── Claude Code ${C.cyan}${model}${C.dim} ──${C.reset}\r\n`;
  }

  // Assistant message — tool use or text
  if (type === "assistant") {
    const message = event.message as Record<string, unknown> | undefined;
    if (!message?.content) return null;

    const content = message.content as Array<Record<string, unknown>>;
    const parts: string[] = [];

    for (const block of content) {
      if (block.type === "tool_use") {
        const name = block.name as string;
        const input = block.input as Record<string, unknown>;
        const icon = TOOL_ICONS[name] || "🔧";

        parts.push(`\r\n${C.yellow}${icon} ${C.bold}${name}${C.reset}`);

        // Show relevant details based on tool
        if (name === "Write" && input.file_path) {
          parts.push(`${C.dim}   → ${C.green}${input.file_path}${C.reset}`);
          if (input.content) {
            const lines = String(input.content).split("\n").length;
            parts.push(`${C.dim}   ${lines} lines${C.reset}`);
          }
        } else if (name === "Edit" && input.file_path) {
          parts.push(`${C.dim}   → ${C.cyan}${input.file_path}${C.reset}`);
        } else if (name === "Read" && input.file_path) {
          parts.push(`${C.dim}   → ${C.blue}${input.file_path}${C.reset}`);
        } else if (name === "Bash" && input.command) {
          const cmd = String(input.command).split("\n")[0].slice(0, 80);
          parts.push(`${C.dim}   $ ${C.white}${cmd}${C.reset}`);
        } else if (name === "Glob" && input.pattern) {
          parts.push(`${C.dim}   ${input.pattern}${C.reset}`);
        } else if (name === "Grep" && input.pattern) {
          parts.push(`${C.dim}   /${input.pattern}/${C.reset}`);
        }
        parts.push("");
      } else if (block.type === "text") {
        const text = String(block.text).trim();
        if (text) {
          parts.push(`\r\n${C.white}${text}${C.reset}\r\n`);
        }
      }
    }

    return parts.length > 0 ? parts.join("\r\n") : null;
  }

  // Tool result — show brief outcome
  if (type === "user") {
    const message = event.message as Record<string, unknown> | undefined;
    if (!message?.content) return null;

    const content = message.content as Array<Record<string, unknown>>;
    const toolResult = event.tool_use_result as Record<string, unknown> | undefined;

    for (const block of content) {
      if (block.type === "tool_result") {
        const resultText = String(block.content || "").trim();
        const resultType = toolResult?.type as string | undefined;

        if (resultType === "create") {
          const filePath = toolResult?.filePath as string;
          return `${C.green}   ✓ Created ${filePath || "file"}${C.reset}\r\n`;
        } else if (resultType === "edit" || resultType === "update") {
          const filePath = toolResult?.filePath as string;
          return `${C.cyan}   ✓ Updated ${filePath || "file"}${C.reset}\r\n`;
        }

        // Show first line of result
        if (resultText) {
          const firstLine = resultText.split("\n")[0].slice(0, 100);
          return `${C.dim}   → ${firstLine}${C.reset}\r\n`;
        }
      }
    }
    return null;
  }

  // Result — final summary
  if (type === "result") {
    const duration = event.duration_ms as number | undefined;
    const numTurns = event.num_turns as number | undefined;
    const cost = event.total_cost_usd as number | undefined;
    const result = String(event.result || "").trim();

    const parts: string[] = [];
    parts.push(`\r\n${C.dim}───────────────────────────────────${C.reset}`);

    if (result) {
      parts.push(`${C.white}${result}${C.reset}`);
    }

    const stats: string[] = [];
    if (numTurns) stats.push(`${numTurns} turns`);
    if (duration) stats.push(`${(duration / 1000).toFixed(1)}s`);
    if (cost) stats.push(`$${cost.toFixed(4)}`);
    if (stats.length > 0) {
      parts.push(`${C.dim}${stats.join(" · ")}${C.reset}`);
    }

    return parts.join("\r\n") + "\r\n";
  }

  return null;
}
