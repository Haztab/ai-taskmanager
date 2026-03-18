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
  feature: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  enhancement: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  bugfix: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  infrastructure: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  documentation: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  testing: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
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
        <div>
          <h2 className="text-xl font-semibold">Ideas</h2>
          <p className="text-sm text-muted-foreground">
            Generate and manage project ideas using AI
          </p>
        </div>
        <Button onClick={generateIdeas} disabled={isStreaming}>
          {isStreaming ? "Generating..." : "Generate Ideas"}
        </Button>
      </div>

      {/* Streaming output */}
      {isStreaming && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">AI is generating ideas...</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md max-h-64 overflow-auto">
              {streamingText || "Waiting for response..."}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Streamed ideas (during/after generation, before they're saved) */}
      {streamedIdeas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Newly Generated ({streamedIdeas.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
      ) : ideas.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Saved Ideas ({ideas.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                No ideas yet. Click &quot;Generate Ideas&quot; to get started!
              </p>
              <Button onClick={generateIdeas} variant="outline">
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
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            {idea.title}
          </CardTitle>
          <Badge
            variant="secondary"
            className={cn(getCategoryColor(idea.category), "shrink-0")}
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
      <CardFooter>
        {promoted ? (
          <Badge variant="outline" className="text-green-600">
            Promoted
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onPromote}
            disabled={isPromoting}
          >
            {isPromoting ? "Promoting..." : "Promote to Task"}
          </Button>
        )}
      </CardFooter>
    </Card>
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
