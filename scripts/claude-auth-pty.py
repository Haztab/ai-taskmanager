#!/usr/bin/env python3
"""
Helper script that runs `claude auth login` in a PTY.
Captures output (URL), reads auth code from a file, and sends it to the PTY.

Usage: python3 claude-auth-pty.py <claude-binary> <code-file-path>

Output protocol (stdout, one per line):
  URL:<oauth-url>
  NEEDS_CODE
  CODE_SENT
  LOGIN_SUCCESS
  LOGIN_DONE
  ERROR:<message>
"""
import pty, os, sys, select, time, re, signal

if len(sys.argv) < 3:
    print("ERROR:Usage: claude-auth-pty.py <binary> <code-file>", flush=True)
    sys.exit(1)

binary = sys.argv[1]
code_file = sys.argv[2]

# Set BROWSER=echo so claude prints URL instead of opening browser
os.environ["BROWSER"] = "echo"
os.environ["TERM"] = "dumb"

master, slave = pty.openpty()
pid = os.fork()

if pid == 0:
    # Child: run claude auth login in the PTY
    os.close(master)
    os.setsid()
    os.dup2(slave, 0)
    os.dup2(slave, 1)
    os.dup2(slave, 2)
    os.close(slave)
    os.execvp(binary, [binary, "auth", "login"])
    # If execvp fails
    os._exit(1)

# Parent: read output, send code
os.close(slave)

output = ""
auth_url = None
code_sent = False
needs_code_sent = False

def read_pty():
    global output, auth_url, needs_code_sent
    try:
        data = os.read(master, 4096)
        if not data:
            return False
        text = data.decode("utf-8", errors="replace")
        output += text
        # Strip ANSI
        clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', output)
        # Look for URL
        if not auth_url:
            m = re.search(r'(https://claude\.ai/oauth/authorize[^\s\x1b]+)', clean)
            if m:
                auth_url = m.group(1)
                print(f"URL:{auth_url}", flush=True)
        # After URL found, signal code needed
        if auth_url and not needs_code_sent:
            needs_code_sent = True
            print("NEEDS_CODE", flush=True)
        # Check for success
        if re.search(r'[Ss]uccess|[Ll]ogged.in|[Ww]elcome|[Aa]uthenticated', clean):
            if auth_url:
                print("LOGIN_SUCCESS", flush=True)
                return False
        return True
    except OSError:
        return False

# Main loop: read output, poll for code file
try:
    deadline = time.time() + 600  # 10 min timeout
    while time.time() < deadline:
        # Read any available PTY output
        r, _, _ = select.select([master], [], [], 0.5)
        if r:
            if not read_pty():
                break

        # Poll for code file
        if auth_url and not code_sent and os.path.exists(code_file):
            time.sleep(0.1)  # Let file finish writing
            try:
                with open(code_file, "r") as f:
                    code = f.read().strip()
                os.unlink(code_file)
                if code:
                    # Write code to PTY
                    os.write(master, (code + "\r").encode())
                    code_sent = True
                    print("CODE_SENT", flush=True)
            except Exception as e:
                print(f"ERROR:Failed to read code: {e}", flush=True)

        # Check if child exited
        try:
            wpid, status = os.waitpid(pid, os.WNOHANG)
            if wpid != 0:
                # Drain remaining output
                try:
                    while True:
                        r, _, _ = select.select([master], [], [], 0.1)
                        if not r:
                            break
                        read_pty()
                except:
                    pass
                break
        except ChildProcessError:
            break

    print("LOGIN_DONE", flush=True)
except Exception as e:
    print(f"ERROR:{e}", flush=True)
finally:
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
