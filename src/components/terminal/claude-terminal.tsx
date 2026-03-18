"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ClaudeTerminalProps {
  taskId: string;
  worktreePath: string | null;
  isBlocked?: boolean;
  blockedBy?: string[];
  onSessionComplete?: () => void;
}

type Phase = "idle" | "planning" | "executing" | "done";

export function ClaudeTerminal({
  taskId,
  worktreePath,
  isBlocked,
  blockedBy,
  onSessionComplete,
}: ClaudeTerminalProps) {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState<
    { type: "command" | "plan" | "output" | "error" | "phase" | "usage"; text: string }[]
  >([]);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionUsage, setSessionUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
  } | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [output, scrollToBottom]);

  const handleExecute = async () => {
    if (!prompt.trim() || !worktreePath || isRunning || isBlocked) return;

    setIsRunning(true);
    setPhase("planning");
    setSessionUsage(null);
    setOutput((prev) => [
      ...prev,
      { type: "command", text: `\n$ ${prompt}\n` },
      { type: "phase", text: "\n--- Phase 1: Creating Plan ---\n" },
    ]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/tasks/${taskId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        setOutput((prev) => [
          ...prev,
          { type: "error", text: `Error: ${err.error}\n` },
        ]);
        setIsRunning(false);
        setPhase("idle");
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                switch (parsed.type) {
                  case "phase":
                    setPhase(
                      parsed.phase === "planning"
                        ? "planning"
                        : parsed.phase === "executing"
                        ? "executing"
                        : "idle"
                    );
                    if (parsed.phase === "executing") {
                      setOutput((prev) => [
                        ...prev,
                        {
                          type: "phase",
                          text: "\n--- Phase 2: Executing Plan ---\n",
                        },
                      ]);
                    }
                    break;
                  case "plan":
                    setOutput((prev) => [
                      ...prev,
                      { type: "plan", text: parsed.data },
                    ]);
                    break;
                  case "output":
                    setOutput((prev) => [
                      ...prev,
                      { type: "output", text: parsed.data },
                    ]);
                    break;
                  case "error":
                    setOutput((prev) => [
                      ...prev,
                      { type: "error", text: parsed.data },
                    ]);
                    break;
                  case "done":
                    if (parsed.usage) {
                      setSessionUsage(parsed.usage);
                      setOutput((prev) => [
                        ...prev,
                        {
                          type: "usage",
                          text: `\n--- Done (${parsed.status}) | Tokens: ${formatTokens(
                            parsed.usage.inputTokens + parsed.usage.outputTokens
                          )} ---\n`,
                        },
                      ]);
                    }
                    break;
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setOutput((prev) => [
          ...prev,
          { type: "error", text: `\nError: ${e.message}\n` },
        ]);
      }
    } finally {
      setIsRunning(false);
      setPhase("done");
      setPrompt("");
      abortControllerRef.current = null;
      onSessionComplete?.();
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setPhase("idle");
  };

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
        <div className="text-4xl mb-3">🌳</div>
        <h3 className="font-semibold mb-1">No Worktree Active</h3>
        <p className="text-sm text-muted-foreground">
          Click &quot;Start Work&quot; to create a git worktree and enable the
          Claude Code terminal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Claude Code - {worktreePath.split("/").pop()}
          </span>
          {isRunning && (
            <Badge variant="secondary" className="text-xs">
              {phase === "planning" ? "Planning..." : "Executing..."}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sessionUsage && (
            <span className="text-xs text-muted-foreground">
              {formatTokens(sessionUsage.inputTokens + sessionUsage.outputTokens)} tokens
            </span>
          )}
          {isRunning && (
            <Button variant="destructive" size="sm" onClick={handleStop}>
              Stop
            </Button>
          )}
        </div>
      </div>

      <div
        ref={outputRef}
        className="flex-1 bg-[#1a1a2e] font-mono text-sm p-4 overflow-auto whitespace-pre-wrap min-h-[300px]"
      >
        {output.length === 0 ? (
          <span className="text-gray-500">
            Ready. Type a prompt below. Claude will create a plan first, then
            execute automatically.
          </span>
        ) : (
          output.map((line, i) => (
            <span
              key={i}
              className={
                line.type === "command"
                  ? "text-cyan-400"
                  : line.type === "plan"
                  ? "text-blue-400"
                  : line.type === "output"
                  ? "text-green-400"
                  : line.type === "error"
                  ? "text-red-400"
                  : line.type === "phase"
                  ? "text-yellow-400 font-bold"
                  : "text-purple-400"
              }
            >
              {line.text}
            </span>
          ))
        )}
      </div>

      <div className="flex gap-2 p-2 bg-muted border-t">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleExecute()}
          placeholder="Describe what to implement..."
          disabled={isRunning}
          className="font-mono text-sm"
        />
        <Button
          onClick={handleExecute}
          disabled={isRunning || !prompt.trim()}
        >
          {isRunning ? "Running..." : "Run"}
        </Button>
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
