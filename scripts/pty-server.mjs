/**
 * WebSocket PTY server for claude auth login.
 * Uses Python's built-in pty module via a subprocess wrapper.
 * Runs on port 3100.
 *
 * Usage: node scripts/pty-server.mjs
 */
import { WebSocketServer } from "ws";
import { spawn, execSync } from "child_process";

const PORT = 3100;

function getClaudeBinary() {
  try {
    return execSync("which claude 2>/dev/null", { encoding: "utf-8", timeout: 3000 }).trim();
  } catch {
    return "claude";
  }
}

function getAuthStatus() {
  try {
    const binary = getClaudeBinary();
    const out = execSync(`${binary} auth status 2>&1`, { encoding: "utf-8", timeout: 10000 }).trim();
    const data = JSON.parse(out);
    return { loggedIn: data.loggedIn === true, email: data.email };
  } catch {
    return { loggedIn: false };
  }
}

// Python script that creates a PTY and bridges stdin/stdout.
// This is inline so no pip packages are needed.
const PYTHON_PTY_BRIDGE = `
import pty, os, sys, select, signal, struct, fcntl, termios, json

binary = sys.argv[1]
master, slave = pty.openpty()
pid = os.fork()
if pid == 0:
    os.close(master)
    os.setsid()
    os.dup2(slave, 0)
    os.dup2(slave, 1)
    os.dup2(slave, 2)
    os.close(slave)
    os.environ["TERM"] = "xterm-256color"
    os.execvp(binary, [binary, "auth", "login"])
    os._exit(1)

os.close(slave)
sys.stdout = os.fdopen(sys.stdout.fileno(), 'wb', 0)
sys.stdin = os.fdopen(sys.stdin.fileno(), 'rb', 0)

try:
    while True:
        r, _, _ = select.select([master, 0], [], [], 0.1)
        for fd in r:
            if fd == master:
                try:
                    data = os.read(master, 4096)
                    if not data:
                        raise OSError
                    sys.stdout.write(data)
                    sys.stdout.flush()
                except OSError:
                    sys.exit(0)
            elif fd == 0:
                try:
                    data = os.read(0, 4096)
                    if not data:
                        raise OSError
                    # Check for resize command
                    try:
                        text = data.decode()
                        if text.startswith('{"type":"resize"'):
                            parsed = json.loads(text)
                            rows = parsed.get("rows", 24)
                            cols = parsed.get("cols", 80)
                            winsize = struct.pack("HHHH", rows, cols, 0, 0)
                            fcntl.ioctl(master, termios.TIOCSWINSZ, winsize)
                            continue
                    except:
                        pass
                    os.write(master, data)
                except OSError:
                    sys.exit(0)
        # Check child
        try:
            w, s = os.waitpid(pid, os.WNOHANG)
            if w:
                break
        except ChildProcessError:
            break
except:
    pass
finally:
    try: os.close(master)
    except: pass
    try: os.kill(pid, signal.SIGTERM)
    except: pass
`;

const wss = new WebSocketServer({ port: PORT });
console.log(`[pty-server] listening on ws://localhost:${PORT}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const action = url.searchParams.get("action") || "login";
  const binary = getClaudeBinary();
  console.log(`[pty-server] client connected, action=${action}`);

  if (action === "status") {
    ws.send(JSON.stringify({ type: "status", ...getAuthStatus() }));
    ws.close();
    return;
  }

  if (action === "logout") {
    try { execSync(`${binary} auth logout 2>&1`, { encoding: "utf-8", timeout: 10000 }); } catch {}
    ws.send(JSON.stringify({ type: "logout", success: true }));
    ws.close();
    return;
  }

  // Spawn Python PTY bridge
  const child = spawn("python3", ["-c", PYTHON_PTY_BRIDGE, binary], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  console.log(`[pty-server] spawned python pty bridge, pid=${child.pid}`);

  // PTY output → WebSocket
  child.stdout.on("data", (data) => {
    if (ws.readyState === 1) ws.send(data);
  });

  child.stderr.on("data", (data) => {
    console.log("[pty-server] stderr:", data.toString().trim());
  });

  // WebSocket → PTY input
  ws.on("message", (msg) => {
    if (!child.stdin.writable) return;
    child.stdin.write(msg);
  });

  child.on("close", (exitCode) => {
    console.log(`[pty-server] python exited, code=${exitCode}`);
    const status = getAuthStatus();
    console.log(`[pty-server] auth: loggedIn=${status.loggedIn}`);
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "exit", exitCode, ...status }));
      ws.close();
    }
  });

  ws.on("close", () => {
    console.log("[pty-server] client disconnected");
    try { child.kill(); } catch {}
  });
});
