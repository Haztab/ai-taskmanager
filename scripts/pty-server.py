#!/usr/bin/env python3
"""
WebSocket PTY server for claude auth login.
Runs on port 3100. FE connects via xterm.js + WebSocket.

Usage: python3 scripts/pty-server.py
"""
import asyncio
import json
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import fcntl
import termios

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:
    print("Installing websockets...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "-q"])
    import websockets
    from websockets.asyncio.server import serve

PORT = 3100

def get_claude_binary():
    try:
        return subprocess.check_output(["which", "claude"], text=True, timeout=3).strip()
    except:
        return "claude"

def get_auth_status():
    try:
        binary = get_claude_binary()
        out = subprocess.check_output([binary, "auth", "status"], text=True, timeout=10, stderr=subprocess.STDOUT).strip()
        data = json.loads(out)
        return {"loggedIn": data.get("loggedIn", False), "email": data.get("email")}
    except:
        return {"loggedIn": False}

async def handle_client(websocket):
    path = websocket.request.path if hasattr(websocket, 'request') else "/"
    action = "login"
    if "action=status" in str(path):
        action = "status"
    elif "action=logout" in str(path):
        action = "logout"

    print(f"[pty-server] client connected, action={action}")

    if action == "status":
        await websocket.send(json.dumps({"type": "status", **get_auth_status()}))
        return

    if action == "logout":
        binary = get_claude_binary()
        try:
            subprocess.run([binary, "auth", "logout"], capture_output=True, timeout=10)
        except:
            pass
        await websocket.send(json.dumps({"type": "logout", "success": True}))
        return

    # Login — spawn PTY
    binary = get_claude_binary()
    master, slave = pty.openpty()

    pid = os.fork()
    if pid == 0:
        # Child
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
    print(f"[pty-server] spawned claude auth login, pid={pid}")

    # Set master to non-blocking
    flags = fcntl.fcntl(master, fcntl.F_GETFL)
    fcntl.fcntl(master, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    loop = asyncio.get_event_loop()
    running = True

    async def read_pty():
        """Read from PTY and send to WebSocket."""
        while running:
            try:
                r, _, _ = select.select([master], [], [], 0.05)
                if r:
                    data = os.read(master, 4096)
                    if not data:
                        break
                    await websocket.send(data)
                else:
                    await asyncio.sleep(0.05)
            except OSError:
                break
            except websockets.exceptions.ConnectionClosed:
                break

        # Check final status
        status = get_auth_status()
        print(f"[pty-server] auth status: loggedIn={status['loggedIn']}")
        try:
            await websocket.send(json.dumps({"type": "exit", **status}))
        except:
            pass

    async def write_pty():
        """Read from WebSocket and write to PTY."""
        nonlocal running
        try:
            async for message in websocket:
                if isinstance(message, str):
                    # Check for resize
                    try:
                        parsed = json.loads(message)
                        if parsed.get("type") == "resize":
                            cols = parsed.get("cols", 80)
                            rows = parsed.get("rows", 24)
                            winsize = struct.pack("HHHH", rows, cols, 0, 0)
                            fcntl.ioctl(master, termios.TIOCSWINSZ, winsize)
                            continue
                    except (json.JSONDecodeError, ValueError):
                        pass
                    os.write(master, message.encode())
                else:
                    os.write(master, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            running = False

    try:
        await asyncio.gather(read_pty(), write_pty())
    finally:
        print(f"[pty-server] cleaning up pid={pid}")
        try:
            os.close(master)
        except:
            pass
        try:
            os.kill(pid, signal.SIGTERM)
        except:
            pass
        try:
            os.waitpid(pid, 0)
        except:
            pass

async def main():
    async with serve(handle_client, "localhost", PORT):
        print(f"[pty-server] listening on ws://localhost:{PORT}")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
