#!/usr/bin/env python3
"""
Helper script that runs `claude auth login` in a PTY.
Claude uses server-side polling — no code paste needed.
Just captures the URL and waits for the process to exit.

Output protocol (stdout, one per line):
  URL:<oauth-url>
  LOGIN_SUCCESS
  LOGIN_DONE
  ERROR:<message>
  DEBUG:<message>
"""
import pty, os, sys, select, time, re, signal

def debug(msg):
    print(f"DEBUG:{msg}", flush=True)

if len(sys.argv) < 2:
    print("ERROR:Usage: claude-auth-pty.py <binary>", flush=True)
    sys.exit(1)

binary = sys.argv[1]
debug(f"binary={binary}")

os.environ["BROWSER"] = "echo"
os.environ["TERM"] = "dumb"

master, slave = pty.openpty()
pid = os.fork()

if pid == 0:
    os.close(master)
    os.setsid()
    os.dup2(slave, 0)
    os.dup2(slave, 1)
    os.dup2(slave, 2)
    os.close(slave)
    os.execvp(binary, [binary, "auth", "login"])
    os._exit(1)

os.close(slave)
debug(f"forked child pid={pid}")

output = ""
auth_url = None

def read_pty():
    global output, auth_url
    try:
        data = os.read(master, 4096)
        if not data:
            debug("PTY EOF")
            return False
        text = data.decode("utf-8", errors="replace")
        output += text
        clean = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', text)
        clean = re.sub(r'\x1b\][^\x07]*\x07', '', clean)
        stripped = clean.strip()
        if stripped:
            debug(f"PTY: {repr(stripped[:200])}")

        # Look for URL
        clean_all = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', output)
        if not auth_url:
            m = re.search(r'(https://claude\.ai/oauth/authorize[^\s\x1b]+)', clean_all)
            if m:
                auth_url = m.group(1)
                print(f"URL:{auth_url}", flush=True)

        # Check for success
        if re.search(r'[Ss]uccess|[Ll]ogged.in|[Ww]elcome|[Aa]uthenticated', clean):
            debug(f"success pattern matched: {repr(stripped[:100])}")
            print("LOGIN_SUCCESS", flush=True)
            return False
        return True
    except OSError as e:
        debug(f"PTY OSError: {e}")
        return False

try:
    deadline = time.time() + 600
    debug("waiting for claude to complete (polling-based, no code needed)")
    while time.time() < deadline:
        r, _, _ = select.select([master], [], [], 1.0)
        if r:
            if not read_pty():
                break

        # Check if child exited
        try:
            wpid, wstatus = os.waitpid(pid, os.WNOHANG)
            if wpid != 0:
                exit_code = os.WEXITSTATUS(wstatus) if os.WIFEXITED(wstatus) else -1
                debug(f"child exited, exit_code={exit_code}")
                # Drain remaining
                try:
                    while True:
                        r, _, _ = select.select([master], [], [], 0.5)
                        if not r:
                            break
                        read_pty()
                except:
                    pass
                break
        except ChildProcessError:
            debug("child already gone")
            break

    debug("loop ended")
    print("LOGIN_DONE", flush=True)
except Exception as e:
    debug(f"exception: {e}")
    print(f"ERROR:{e}", flush=True)
finally:
    try: os.close(master)
    except: pass
    try: os.kill(pid, signal.SIGTERM)
    except: pass
    try: os.waitpid(pid, 0)
    except: pass
    debug("done")
