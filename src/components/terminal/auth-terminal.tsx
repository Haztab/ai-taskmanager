"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface AuthTerminalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function AuthTerminal({ onSuccess, onClose }: AuthTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [status, setStatus] = useState<"connecting" | "running" | "done">("connecting");

  useEffect(() => {
    if (!termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#111113",
        foreground: "#eeeeef",
        cursor: "#5b5bd6",
        selectionBackground: "#5b5bd644",
      },
      rows: 12,
      cols: 90,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    terminalRef.current = term;

    term.writeln("\x1b[90m Connecting to Claude Code...\x1b[0m");

    // Connect to PTY server
    const ws = new WebSocket("ws://localhost:3100?action=login");
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("running");
      // Send resize
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      const data = event.data;
      // Check if it's a JSON control message
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "exit") {
          if (parsed.loggedIn) {
            term.writeln("\r\n\x1b[32m✓ Successfully authenticated!\x1b[0m");
            setStatus("done");
            setTimeout(onSuccess, 1000);
          } else {
            term.writeln("\r\n\x1b[31m✗ Authentication failed.\x1b[0m");
            setStatus("done");
          }
          return;
        }
      } catch {
        // Not JSON — raw PTY output
      }
      term.write(data);
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[31m Error: Cannot connect to PTY server.\x1b[0m");
      term.writeln("\x1b[90m Run: make pty-server\x1b[0m");
      setStatus("done");
    };

    ws.onclose = () => {
      if (status !== "done") {
        // Check if we got logged in
        fetch("/api/settings/claude-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check" }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.loggedIn) {
              term.writeln("\r\n\x1b[32m✓ Authenticated!\x1b[0m");
              setStatus("done");
              setTimeout(onSuccess, 1000);
            }
          })
          .catch(() => {});
      }
    };

    // Forward keystrokes to PTY
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    });
    resizeObserver.observe(termRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-lg overflow-hidden border border-[#333]">
      <div
        ref={termRef}
        className="bg-[#111113]"
        style={{ padding: "8px" }}
      />
    </div>
  );
}
