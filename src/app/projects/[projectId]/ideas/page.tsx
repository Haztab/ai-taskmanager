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
import { Sparkles, Rocket, Lightbulb, CheckCircle2 } from "lucide-react";
import type { GeneratedIdea } from "@/types";

interface Idea extends GeneratedIdea {
  id: string;
  projectId: string;
  promoted: boolean;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
}

const categoryColors: Record<string, string> = {
  core: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  feature: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  enhancement: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  security: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  bugfix: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  ux: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  performance: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  analytics: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  integration: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  infrastructure: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  documentation: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  testing: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  default: "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30",
};

function getCategoryColor(category: string): string {
  const key = category.toLowerCase();
  return categoryColors[key] ?? categoryColors.default;
}

export default function IdeasPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const queryClient = useQueryClient();

  const [streamingText, setStreamingText] = useState("");
  const [streamedIdeas, setStreamedIdeas] = useState<GeneratedIdea[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

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
    mutationFn: async (idea: GeneratedIdea) => {
      const res = await fetch("/api/ai/promote-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idea }),
      });
      if (!res.ok) throw new Error("Failed to promote idea");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Idea promoted to task!");
      queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
          description: project.description,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate ideas");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setStreamingText(accumulated);

        // Try to parse JSON ideas from accumulated text
        const parsed = parseIdeasFromStream(accumulated);
        if (parsed.length > 0) {
          setStreamedIdeas(parsed);
        }
      }

      // Final parse
      const finalIdeas = parseIdeasFromStream(accumulated);
      setStreamedIdeas(finalIdeas);

      // Refetch saved ideas
      queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
      toast.success(`Generated ${finalIdeas.length} ideas!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate ideas");
    } finally {
      setIsStreaming(false);
    }
  }, [project, projectId, queryClient]);

  return (
    <div className="p-6 space-y-6">
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
          <Sparkles className="mr-2 h-4 w-4" />
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

      {/* Streamed ideas (during/after generation, before they're saved) */}
      {streamedIdeas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Newly Generated ({streamedIdeas.length})
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {streamedIdeas.map((idea, index) => (
              <IdeaCard
                key={`streamed-${index}`}
                idea={idea}
                onPromote={() => promoteIdea.mutate(idea)}
                isPromoting={promoteIdea.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Saved ideas */}
      {ideasLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      ) : ideas.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Saved Ideas ({ideas.length})
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                promoted={idea.promoted}
                onPromote={() => promoteIdea.mutate(idea)}
                isPromoting={promoteIdea.isPending}
              />
            ))}
          </div>
        </div>
      ) : (
        !isStreaming &&
        streamedIdeas.length === 0 && (
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
        )
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  promoted,
  onPromote,
  isPromoting,
}: {
  idea: GeneratedIdea;
  promoted?: boolean;
  onPromote: () => void;
  isPromoting: boolean;
}) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-transparent to-indigo-500/10 p-[1px]">
      <Card className="flex flex-col h-full rounded-xl border-0 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">
              {idea.title}
            </CardTitle>
            <Badge
              variant="secondary"
              className={cn(getCategoryColor(idea.category), "shrink-0 border text-xs font-medium")}
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
        <CardFooter className="pt-3 border-t border-border/50">
          {promoted ? (
            <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/10 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Promoted
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={onPromote}
              disabled={isPromoting}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white gap-1.5 shadow-sm"
            >
              <Rocket className="h-3.5 w-3.5" />
              {isPromoting ? "Promoting..." : "Promote to Task"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function parseIdeasFromStream(text: string): GeneratedIdea[] {
  const ideas: GeneratedIdea[] = [];

  // Try to find JSON array in the text
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
      // Partial JSON, try individual objects
    }
  }

  // Try to find individual JSON objects
  const objectRegex = /\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*"description"\s*:\s*"[^"]*"[^{}]*"category"\s*:\s*"[^"]*"[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.title && obj.description && obj.category) {
        ideas.push(obj);
      }
    } catch {
      // Skip malformed objects
    }
  }

  return ideas;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}
