"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TerminalIcon, RotateCcw } from "lucide-react";

interface ClaudeTerminalProps {
  taskId: string;
  worktreePath: string | null;
  isBlocked?: boolean;
  blockedBy?: string[];
  onSessionComplete?: () => void;
}

export function ClaudeTerminal({
  taskId,
  worktreePath,
  isBlocked,
  blockedBy,
  onSessionComplete,
}: ClaudeTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<"disconnected" | "connecting" | "running" | "exited">("disconnected");

  const connect = useCallback(() => {
    if (!worktreePath || !termRef.current) return;

    // Clean up previous
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#111113",
        foreground: "#eeeeef",
        cursor: "#5b5bd6",
        selectionBackground: "#5b5bd644",
        black: "#111113",
        red: "#e5484d",
        green: "#30a46c",
        yellow: "#f5a623",
        blue: "#3e63dd",
        magenta: "#8e4ec6",
        cyan: "#12a594",
        white: "#eeeeef",
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    setStatus("connecting");
    term.writeln("\x1b[90m Connecting to Claude Code...\x1b[0m");

    const cwd = encodeURIComponent(worktreePath);
    const ws = new WebSocket(`ws://localhost:3100?action=execute&cwd=${cwd}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("running");
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      const data = event.data;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "exit") {
          setStatus("exited");
          onSessionComplete?.();
          return;
        }
        if (parsed.type === "error") {
          term.writeln(`\r\n\x1b[31m Error: ${parsed.message}\x1b[0m`);
          setStatus("exited");
          return;
        }
      } catch {
        // Not JSON — raw PTY output
      }
      term.write(data);
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[31m Cannot connect to PTY server.\x1b[0m");
      term.writeln("\x1b[90m Start it with: npx tsx scripts/pty-server.ts\x1b[0m");
      setStatus("disconnected");
    };

    ws.onclose = () => {
      setStatus((prev) => (prev === "exited" ? prev : "exited"));
      onSessionComplete?.();
    };

    // Forward keystrokes to PTY
    term.onData((data: string) => {
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
    if (termRef.current) {
      resizeObserver.observe(termRef.current);
    }
  }, [worktreePath, onSessionComplete]);

  // Connect on mount / when worktreePath changes
  useEffect(() => {
    if (worktreePath) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worktreePath]);

  if (isBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 border rounded-lg bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="font-semibold mb-1 text-red-700 dark:text-red-400">
          Blocked by Dependencies
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Complete the following tasks before starting work:
        </p>
        <div className="space-y-1">
          {blockedBy?.map((name, i) => (
            <Badge key={i} variant="destructive" className="mr-1">
              {name}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  if (!worktreePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 border rounded-lg bg-muted/30">
        <div className="p-3 rounded-full bg-muted mb-4">
          <TerminalIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold mb-1">No Worktree Active</h3>
        <p className="text-sm text-muted-foreground">
          Click &quot;Start Work&quot; to create a git worktree and launch the
          Claude Code terminal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Claude Code — {worktreePath.split("/").pop()}
          </span>
          <Badge
            variant="secondary"
            className={
              status === "running"
                ? "text-xs bg-green-500/15 text-green-600 border-green-500/30"
                : status === "connecting"
                ? "text-xs bg-yellow-500/15 text-yellow-600 border-yellow-500/30"
                : status === "exited"
                ? "text-xs bg-gray-500/15 text-gray-600 border-gray-500/30"
                : "text-xs"
            }
          >
            {status === "running"
              ? "Connected"
              : status === "connecting"
              ? "Connecting..."
              : status === "exited"
              ? "Session Ended"
              : "Disconnected"}
          </Badge>
        </div>
        {(status === "exited" || status === "disconnected") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={connect}
            className="gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reconnect
          </Button>
        )}
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        className="flex-1 bg-[#111113] min-h-[400px]"
        style={{ padding: "4px" }}
      />
    </div>
  );
}
