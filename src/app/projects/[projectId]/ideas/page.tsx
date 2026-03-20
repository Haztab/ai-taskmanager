"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Sparkles,
  Rocket,
  Lightbulb,
  CheckCircle2,
  Trash2,
  Loader2,
} from "lucide-react";
import type { GeneratedIdea } from "@/types";

interface Idea {
  id: string;
  title: string;
  description: string;
  category: string | null;
  isPromoted: boolean;
  epicId: string | null;
  projectId: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
}

const categoryColors: Record<string, string> = {
  core: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  feature:
    "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  enhancement:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  security: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  bugfix: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  ux: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  performance:
    "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  analytics:
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  integration:
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  infrastructure:
    "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  documentation:
    "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  testing:
    "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  default:
    "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30",
};

function getCategoryColor(category: string): string {
  const key = category.toLowerCase();
  return categoryColors[key] ?? categoryColors.default;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function IdeasPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const queryClient = useQueryClient();

  const [streamingText, setStreamingText] = useState("");
  const [streamedIdeas, setStreamedIdeas] = useState<GeneratedIdea[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
  });

  const { data: ideas = [], isLoading: ideasLoading } = useQuery<Idea[]>({
    queryKey: ["ideas", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/ideas?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch ideas");
      return res.json();
    },
  });

  const promoteIdea = useMutation({
    mutationFn: async (ideaId: string) => {
      setPromotingId(ideaId);
      const res = await fetch("/api/ai/promote-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to promote idea" }));
        throw new Error(err.error || "Failed to promote idea");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const taskCount = data.tasks?.length ?? 0;
      toast.success(
        `Idea promoted! Created epic with ${taskCount} task${taskCount !== 1 ? "s" : ""}.`
      );
      queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["epics", projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setPromotingId(null);
    },
  });

  const deleteIdea = useMutation({
    mutationFn: async (ideaId: string) => {
      setDeletingId(ideaId);
      const res = await fetch(`/api/ideas/${ideaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete idea");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Idea deleted");
      queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const generateIdeas = useCallback(async () => {
    if (!project?.description) {
      toast.error("Project needs a description to generate ideas");
      return;
    }

    setIsStreaming(true);
    setStreamingText("");
    setStreamedIdeas([]);

    try {
      const res = await fetch("/api/ideas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectDescription: project.description,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate ideas" }));
        throw new Error(err.error || "Failed to generate ideas");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages from buffer
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);

          try {
            const data = JSON.parse(payload);

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.text) {
              accumulated += data.text;
              setStreamingText(accumulated);

              // Try to parse ideas from accumulated text
              const parsed = parseIdeasFromStream(accumulated);
              if (parsed.length > 0) {
                setStreamedIdeas(parsed);
              }
            }

            if (data.done) {
              // Ideas were saved server-side, refetch
              queryClient.invalidateQueries({
                queryKey: ["ideas", projectId],
              });
              toast.success(`Generated ${data.count} ideas!`);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue; // incomplete JSON chunk
            throw e;
          }
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate ideas"
      );
    } finally {
      setIsStreaming(false);
      setStreamedIdeas([]);
      setStreamingText("");
    }
  }, [project, projectId, queryClient]);

  const savedUnpromoted = ideas.filter((i) => !i.isPromoted);
  const savedPromoted = ideas.filter((i) => i.isPromoted);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Lightbulb className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Ideas</h2>
            <p className="text-sm text-muted-foreground">
              Generate and manage project ideas using AI
            </p>
          </div>
        </div>
        <Button
          onClick={generateIdeas}
          disabled={isStreaming}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-violet-500/20"
        >
          {isStreaming ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isStreaming ? "Generating..." : "Generate Ideas"}
        </Button>
      </div>

      {/* Streaming output */}
      {isStreaming && (
        <Card className="border-gray-800 bg-gray-950 overflow-hidden">
          <CardHeader className="border-b border-gray-800 pb-3">
            <CardTitle className="text-sm text-green-400 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              AI is generating ideas...
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm whitespace-pre-wrap font-mono text-green-400 p-4 max-h-64 overflow-auto bg-gray-950">
              {streamingText || "Waiting for response..."}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Streamed ideas preview (shown during generation) */}
      {streamedIdeas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Generating... ({streamedIdeas.length} found so far)
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {streamedIdeas.map((idea, index) => (
              <StreamedIdeaCard key={`streamed-${index}`} idea={idea} />
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {ideasLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Unpromoted ideas */}
      {!ideasLoading && savedUnpromoted.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Ideas ({savedUnpromoted.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedUnpromoted.map((idea) => (
              <SavedIdeaCard
                key={idea.id}
                idea={idea}
                onPromote={() => promoteIdea.mutate(idea.id)}
                onDelete={() => deleteIdea.mutate(idea.id)}
                isPromoting={promotingId === idea.id}
                isDeleting={deletingId === idea.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Promoted ideas */}
      {!ideasLoading && savedPromoted.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-muted-foreground">
            Promoted ({savedPromoted.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedPromoted.map((idea) => (
              <SavedIdeaCard
                key={idea.id}
                idea={idea}
                isPromoted
                onDelete={() => deleteIdea.mutate(idea.id)}
                isDeleting={deletingId === idea.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!ideasLoading &&
        !isStreaming &&
        streamedIdeas.length === 0 &&
        ideas.length === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-3 rounded-full bg-muted mb-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4 text-center">
                No ideas yet. Click &quot;Generate Ideas&quot; to get started!
              </p>
              <Button
                onClick={generateIdeas}
                variant="outline"
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Ideas
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Streamed idea card (read-only preview during generation)            */
/* ------------------------------------------------------------------ */

function StreamedIdeaCard({ idea }: { idea: GeneratedIdea }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-transparent to-indigo-500/10 p-[1px]">
      <Card className="flex flex-col h-full rounded-xl border-0 bg-card opacity-75">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {idea.title}
            </CardTitle>
            <Badge
              variant="secondary"
              className={cn(
                getCategoryColor(idea.category),
                "shrink-0 border text-xs font-medium"
              )}
            >
              {idea.category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <CardDescription className="text-sm line-clamp-4">
            {idea.description}
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saved idea card (with promote / delete actions)                     */
/* ------------------------------------------------------------------ */

function SavedIdeaCard({
  idea,
  isPromoted,
  onPromote,
  onDelete,
  isPromoting,
  isDeleting,
}: {
  idea: Idea;
  isPromoted?: boolean;
  onPromote?: () => void;
  onDelete: () => void;
  isPromoting?: boolean;
  isDeleting?: boolean;
}) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-transparent to-indigo-500/10 p-[1px]">
      <Card
        className={cn(
          "flex flex-col h-full rounded-xl border-0 bg-card",
          isPromoted && "opacity-60"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {idea.title}
            </CardTitle>
            {idea.category && (
              <Badge
                variant="secondary"
                className={cn(
                  getCategoryColor(idea.category),
                  "shrink-0 border text-xs font-medium"
                )}
              >
                {idea.category}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <CardDescription className="text-sm line-clamp-4">
            {idea.description}
          </CardDescription>
        </CardContent>
        <CardFooter className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
          {isPromoted ? (
            <Badge
              variant="outline"
              className="text-green-600 border-green-500/30 bg-green-500/10 gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              Promoted
            </Badge>
          ) : onPromote ? (
            <Button
              size="sm"
              onClick={onPromote}
              disabled={isPromoting || isDeleting}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white gap-1.5 shadow-sm"
            >
              {isPromoting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              {isPromoting ? "Promoting..." : "Promote to Epic"}
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            disabled={isDeleting || isPromoting}
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Incremental JSON parser for streaming                               */
/* ------------------------------------------------------------------ */

function parseIdeasFromStream(text: string): GeneratedIdea[] {
  // Try to find a complete JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item: unknown): item is GeneratedIdea =>
            typeof item === "object" &&
            item !== null &&
            "title" in item &&
            "description" in item &&
            "category" in item
        );
      }
    } catch {
      // Partial JSON — fall through to individual object parsing
    }
  }

  // Try to find individual complete JSON objects
  const ideas: GeneratedIdea[] = [];
  const objectRegex =
    /\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*"description"\s*:\s*"[^"]*"[^{}]*"category"\s*:\s*"[^"]*"[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.title && obj.description && obj.category) {
        ideas.push(obj);
      }
    } catch {
      // Skip malformed
    }
  }
  return ideas;
}
