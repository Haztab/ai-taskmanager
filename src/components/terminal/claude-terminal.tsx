"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TerminalIcon, RotateCcw, Play } from "lucide-react";

interface ClaudeTerminalProps {
  taskId: string;
  worktreePath: string | null;
  isBlocked?: boolean;
  blockedBy?: string[];
  taskContext?: {
    title: string;
    description?: string | null;
    acceptanceCriteria?: string | null;
    userStory?: string | null;
  };
  autoRun?: boolean;
  onSessionComplete?: () => void;
}

export function ClaudeTerminal({
  taskId,
  worktreePath,
  isBlocked,
  blockedBy,
  taskContext,
  autoRun = true,
  onSessionComplete,
}: ClaudeTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const connectingRef = useRef(false);
  const [status, setStatus] = useState<
    "disconnected" | "connecting" | "running" | "completed" | "failed"
  >("disconnected");

  const buildPrompt = useCallback(() => {
    if (!taskContext?.title) return null;
    let prompt = `Implement the following task:\n\nTask: ${taskContext.title}`;
    if (taskContext.description) {
      prompt += `\nDescription: ${taskContext.description}`;
    }
    if (taskContext.userStory) {
      prompt += `\nUser Story: ${taskContext.userStory}`;
    }
    if (taskContext.acceptanceCriteria) {
      try {
        const criteria = JSON.parse(taskContext.acceptanceCriteria);
        if (Array.isArray(criteria) && criteria.length > 0) {
          prompt += `\nAcceptance Criteria:\n${criteria.map((c: string) => `- ${c}`).join("\n")}`;
        }
      } catch {
        prompt += `\nAcceptance Criteria: ${taskContext.acceptanceCriteria}`;
      }
    }
    return prompt;
  }, [taskContext]);

  const connect = useCallback(
    (mode: "run" | "execute" = "run") => {
      if (!worktreePath || !termRef.current || connectingRef.current) return;
      connectingRef.current = true;

      // Clean up previous
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
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
      term.writeln("\x1b[90mConnecting to Claude Code...\x1b[0m\r\n");

      const cwd = encodeURIComponent(worktreePath);
      const wsUrl = `ws://localhost:3100?action=${mode}&cwd=${cwd}`;

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      const decoder = new TextDecoder();

      let didConnect = false;
      let gotOutput = false;

      ws.onopen = () => {
        didConnect = true;
        connectingRef.current = false;
        setStatus("running");
        ws.send(
          JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows })
        );

        // In "run" mode, send the prompt after a brief delay for the server to set up
        if (mode === "run") {
          const prompt = buildPrompt();
          if (prompt) {
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                term.writeln("\x1b[36m--- Running task with Claude ---\x1b[0m\r\n");
                ws.send(JSON.stringify({ type: "prompt", text: prompt }));
              }
            }, 200);
          }
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        let text: string;
        if (event.data instanceof ArrayBuffer) {
          text = decoder.decode(event.data);
        } else {
          text = String(event.data);
        }

        // Check for JSON control messages (exit, error)
        if (text.trimStart().startsWith("{")) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.type === "exit") {
              setStatus(parsed.exitCode === 0 ? "completed" : "failed");
              term.writeln(
                parsed.exitCode === 0
                  ? "\r\n\x1b[32m--- Task completed ---\x1b[0m"
                  : "\r\n\x1b[31m--- Task failed ---\x1b[0m"
              );
              onSessionComplete?.();
              return;
            }
            if (parsed.type === "error") {
              term.writeln(`\r\n\x1b[31mError: ${parsed.message}\x1b[0m`);
              setStatus("failed");
              connectingRef.current = false;
              return;
            }
          } catch {
            // Not valid JSON
          }
        }
        // Write terminal output
        gotOutput = true;
        term.write(text);
      };

      ws.onerror = () => {
        connectingRef.current = false;
        if (!didConnect) {
          term.writeln("\r\n\x1b[31mCannot connect to PTY server.\x1b[0m");
          term.writeln("\x1b[90mStart it with: npx tsx scripts/pty-server.ts\x1b[0m");
          setStatus("disconnected");
        }
        // If we already connected, onerror is likely a connection reset — ignore it
      };

      ws.onclose = () => {
        connectingRef.current = false;
        setStatus((prev) => {
          if (prev === "completed" || prev === "failed") return prev;
          // If we connected and got output, it completed
          if (didConnect && gotOutput) return "completed";
          // If we connected but got no output, something went wrong
          if (didConnect) {
            term.writeln("\r\n\x1b[33mConnection closed without output. Claude may still be starting.\x1b[0m");
            return "failed";
          }
          return "disconnected";
        });
      };

      // Forward keystrokes
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Resize handling
      const el = termRef.current;
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      });
      if (el) resizeObserver.observe(el);

      return () => {
        resizeObserver.disconnect();
      };
    },
    [worktreePath, buildPrompt, onSessionComplete]
  );

  const mountedRef = useRef(false);

  useEffect(() => {
    if (!worktreePath) return;

    // StrictMode guard: skip the first cleanup/re-mount cycle
    if (mountedRef.current) return;
    mountedRef.current = true;

    // Small delay to ensure DOM is ready after navigation
    const timer = setTimeout(() => {
      if (autoRun && taskContext?.title) {
        connect("run");
      } else {
        connect("execute");
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      // Don't cleanup WebSocket/terminal on StrictMode unmount
      // Only cleanup when the component truly unmounts (worktreePath changes)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worktreePath]);

  // Cleanup on true unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      connectingRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
  }, []);

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
                : status === "completed"
                ? "text-xs bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                : status === "failed"
                ? "text-xs bg-red-500/15 text-red-600 border-red-500/30"
                : "text-xs"
            }
          >
            {status === "running"
              ? "Running..."
              : status === "connecting"
              ? "Connecting..."
              : status === "completed"
              ? "Completed"
              : status === "failed"
              ? "Failed"
              : "Disconnected"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {(status === "completed" || status === "failed" || status === "disconnected") && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => connect("run")}
                className="gap-1.5 text-xs"
              >
                <Play className="h-3 w-3" />
                Re-run
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => connect("execute")}
                className="gap-1.5 text-xs"
              >
                <TerminalIcon className="h-3 w-3" />
                Interactive
              </Button>
            </>
          )}
        </div>
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
