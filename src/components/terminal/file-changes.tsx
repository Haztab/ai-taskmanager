"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  FilePlus,
  FileMinus,
  FilePen,
  FileQuestion,
  FileSymlink,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
} from "lucide-react";

interface FileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "untracked";
  additions?: number;
  deletions?: number;
}

interface ChangesData {
  files: FileChange[];
  diff: string;
  branch: string;
  totalAdditions: number;
  totalDeletions: number;
}

interface FileChangesProps {
  worktreePath: string | null;
}

const STATUS_CONFIG: Record<
  FileChange["status"],
  { icon: typeof FilePlus; color: string; label: string }
> = {
  added: { icon: FilePlus, color: "text-emerald-500", label: "A" },
  modified: { icon: FilePen, color: "text-amber-500", label: "M" },
  deleted: { icon: FileMinus, color: "text-red-500", label: "D" },
  renamed: { icon: FileSymlink, color: "text-blue-500", label: "R" },
  untracked: { icon: FileQuestion, color: "text-gray-400", label: "?" },
};

export function FileChanges({ worktreePath }: FileChangesProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const {
    data: changes,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ChangesData>({
    queryKey: ["worktree-changes", worktreePath],
    queryFn: async () => {
      const res = await fetch(
        `/api/worktree/changes?path=${encodeURIComponent(worktreePath!)}`
      );
      if (!res.ok) throw new Error("Failed to fetch changes");
      return res.json();
    },
    enabled: !!worktreePath,
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const toggleFile = useCallback((path: string) => {
    setExpandedFile((prev) => (prev === path ? null : path));
  }, []);

  if (!worktreePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
        <GitBranch className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">No worktree active.</p>
        <p className="text-xs mt-1">Start work to see file changes.</p>
      </div>
    );
  }

  // Parse diff into per-file sections
  const fileDiffs = parseDiffByFile(changes?.diff ?? "");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Changes
          </h3>
          {changes && changes.files.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {changes.files.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {/* Branch info */}
      {changes?.branch && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b text-[11px] text-muted-foreground bg-muted/10">
          <GitBranch className="h-3 w-3" />
          <span className="font-mono truncate">{changes.branch}</span>
        </div>
      )}

      {/* Stats summary */}
      {changes && changes.files.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b text-[11px]">
          <span className="text-muted-foreground">
            {changes.files.length} file{changes.files.length !== 1 ? "s" : ""}
          </span>
          {changes.totalAdditions > 0 && (
            <span className="text-emerald-600 flex items-center gap-0.5">
              <Plus className="h-2.5 w-2.5" />
              {changes.totalAdditions}
            </span>
          )}
          {changes.totalDeletions > 0 && (
            <span className="text-red-500 flex items-center gap-0.5">
              <Minus className="h-2.5 w-2.5" />
              {changes.totalDeletions}
            </span>
          )}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-7 bg-muted/50 rounded animate-pulse"
              />
            ))}
          </div>
        ) : !changes || changes.files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">No changes yet</p>
            <p className="text-xs mt-1">
              Changes will appear here as Claude works
            </p>
          </div>
        ) : (
          <div>
            {changes.files.map((file) => {
              const config = STATUS_CONFIG[file.status];
              const Icon = config.icon;
              const isExpanded = expandedFile === file.path;
              const fileDiff = fileDiffs[file.path];

              return (
                <div key={file.path}>
                  <button
                    onClick={() => toggleFile(file.path)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors group"
                  >
                    {fileDiff ? (
                      isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      )
                    ) : (
                      <span className="w-3" />
                    )}
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                    <span className="text-xs font-mono truncate flex-1">
                      {file.path}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {file.additions !== undefined && file.additions > 0 && (
                        <span className="text-[10px] text-emerald-600">
                          +{file.additions}
                        </span>
                      )}
                      {file.deletions !== undefined && file.deletions > 0 && (
                        <span className="text-[10px] text-red-500">
                          -{file.deletions}
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-bold ${config.color} w-3 text-center`}
                      >
                        {config.label}
                      </span>
                    </div>
                  </button>

                  {/* Inline diff */}
                  {isExpanded && fileDiff && (
                    <div className="bg-[#0d1117] border-y border-[#30363d] overflow-x-auto">
                      <pre className="text-[11px] leading-[1.6] font-mono">
                        {fileDiff.map((line, i) => (
                          <div
                            key={i}
                            className={
                              line.startsWith("+")
                                ? "bg-emerald-500/10 text-emerald-400 px-3"
                                : line.startsWith("-")
                                ? "bg-red-500/10 text-red-400 px-3"
                                : line.startsWith("@@")
                                ? "bg-blue-500/10 text-blue-400 px-3"
                                : "text-gray-400 px-3"
                            }
                          >
                            {line}
                          </div>
                        ))}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function parseDiffByFile(diff: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!diff) return result;

  const sections = diff.split(/^diff --git /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split("\n");
    // Extract filename from "a/path b/path"
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;
    const filePath = headerMatch[2];

    // Get the diff lines (skip headers until we hit @@)
    const diffLines: string[] = [];
    let started = false;
    for (const line of lines.slice(1)) {
      if (line.startsWith("@@")) started = true;
      if (started) diffLines.push(line);
    }

    if (diffLines.length > 0) {
      result[filePath] = diffLines;
    }
  }

  return result;
}
