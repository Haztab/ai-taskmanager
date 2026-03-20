"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Search,
  ArrowUpDown,
  ExternalLink,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import type { GeneratedIdea } from "@/types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Idea {
  id: string;
  title: string;
  description: string;
  category: string | null;
  isPromoted: boolean;
  epicId: string | null;
  epic?: { id: string; title: string } | null;
  projectId: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
}

type SortKey = "newest" | "oldest" | "title" | "category";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

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
  return categoryColors[category.toLowerCase()] ?? categoryColors.default;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function IdeasPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Streaming state
  const [streamedIdeas, setStreamedIdeas] = useState<GeneratedIdea[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // UI state
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkPromoting, setBulkPromoting] = useState(false);

  // Data
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

  // Derived: unique categories from saved ideas
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const idea of ideas) {
      if (idea.category) cats.add(idea.category);
    }
    return Array.from(cats).sort();
  }, [ideas]);

  // Derived: filtered and sorted ideas
  const filteredIdeas = useMemo(() => {
    let list = [...ideas];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (categoryFilter) {
      list = list.filter(
        (i) => i.category?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    // Sort
    list.sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "category":
          return (a.category || "").localeCompare(b.category || "");
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return list;
  }, [ideas, searchQuery, categoryFilter, sortKey]);

  const unpromoted = filteredIdeas.filter((i) => !i.isPromoted);
  const promoted = filteredIdeas.filter((i) => i.isPromoted);

  // ---- Mutations ----

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
      toast.success(`Promoted! Created epic with ${taskCount} task${taskCount !== 1 ? "s" : ""}.`, {
        action: {
          label: "View Board",
          onClick: () => router.push(`/projects/${projectId}/board`),
        },
      });
      queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["epics", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setPromotingId(null),
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
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => {
      setDeletingId(null);
      setConfirmDeleteId(null);
    },
  });

  // ---- Bulk actions ----

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUnpromoted = () => {
    if (selectedIds.size === unpromoted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpromoted.map((i) => i.id)));
    }
  };

  const bulkPromote = async () => {
    if (selectedIds.size === 0) return;
    setBulkPromoting(true);
    let successCount = 0;
    for (const ideaId of selectedIds) {
      try {
        const res = await fetch("/api/ai/promote-idea", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ideaId }),
        });
        if (res.ok) successCount++;
      } catch { /* continue */ }
    }
    setBulkPromoting(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    queryClient.invalidateQueries({ queryKey: ["epics", projectId] });
    toast.success(`Promoted ${successCount} idea${successCount !== 1 ? "s" : ""} to epics.`, {
      action: {
        label: "View Board",
        onClick: () => router.push(`/projects/${projectId}/board`),
      },
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    let successCount = 0;
    for (const ideaId of selectedIds) {
      try {
        const res = await fetch(`/api/ideas/${ideaId}`, { method: "DELETE" });
        if (res.ok) successCount++;
      } catch { /* continue */ }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
    toast.success(`Deleted ${successCount} idea${successCount !== 1 ? "s" : ""}.`);
  };

  // ---- Generate ----

  const generateIdeas = useCallback(async () => {
    if (!project?.description) {
      toast.error("Project needs a description to generate ideas");
      return;
    }

    setIsStreaming(true);
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
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);

          try {
            const data = JSON.parse(payload);

            if (data.error) throw new Error(data.error);

            if (data.text) {
              accumulated += data.text;
              const parsed = parseIdeasFromStream(accumulated);
              if (parsed.length > 0) setStreamedIdeas(parsed);
            }

            if (data.done) {
              queryClient.invalidateQueries({ queryKey: ["ideas", projectId] });
              toast.success(`Generated ${data.count} ideas!`);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate ideas");
    } finally {
      setIsStreaming(false);
      setStreamedIdeas([]);
    }
  }, [project, projectId, queryClient]);

  // ---- Render ----

  const totalCount = ideas.length;
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Lightbulb className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              Ideas
              {totalCount > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({totalCount})
                </span>
              )}
            </h2>
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

      {/* Streaming: idea cards appearing one by one */}
      {isStreaming && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            {streamedIdeas.length === 0
              ? "AI is thinking..."
              : `Found ${streamedIdeas.length} idea${streamedIdeas.length !== 1 ? "s" : ""} so far...`}
          </div>
          {streamedIdeas.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {streamedIdeas.map((idea, index) => (
                <div
                  key={`streamed-${index}`}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <StreamedIdeaCard idea={idea} />
                </div>
              ))}
            </div>
          )}
          {streamedIdeas.length === 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toolbar: search, category filter, sort */}
      {!ideasLoading && totalCount > 0 && (
        <div className="space-y-3">
          {/* Search + Sort row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ideas..."
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs"
              onClick={() => {
                const order: SortKey[] = ["newest", "oldest", "title", "category"];
                const idx = order.indexOf(sortKey);
                setSortKey(order[(idx + 1) % order.length]);
              }}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortKey === "newest"
                ? "Newest"
                : sortKey === "oldest"
                ? "Oldest"
                : sortKey === "title"
                ? "A-Z"
                : "Category"}
            </Button>
          </div>

          {/* Category filter tabs */}
          {categories.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                  !categoryFilter
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter?.toLowerCase() === cat.toLowerCase() ? null : cat
                    )
                  }
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                    categoryFilter?.toLowerCase() === cat.toLowerCase()
                      ? "bg-foreground text-background border-foreground"
                      : cn(getCategoryColor(cat), "hover:opacity-80")
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Bulk action bar */}
          {unpromoted.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-xs text-muted-foreground"
                onClick={selectAllUnpromoted}
              >
                {selectedIds.size === unpromoted.length ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {selectedIds.size === unpromoted.length ? "Deselect All" : "Select All"}
              </Button>
              {hasSelection && (
                <>
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                    onClick={bulkPromote}
                    disabled={bulkPromoting}
                  >
                    {bulkPromoting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Rocket className="h-3 w-3" />
                    )}
                    Promote Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs text-destructive hover:bg-destructive/10"
                    onClick={bulkDelete}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete Selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </>
              )}
            </div>
          )}
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

      {/* No results for filter */}
      {!ideasLoading &&
        totalCount > 0 &&
        filteredIdeas.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No ideas match your search or filter.</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter(null);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}

      {/* Unpromoted ideas */}
      {!ideasLoading && unpromoted.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            Ideas ({unpromoted.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {unpromoted.map((idea) => (
              <SavedIdeaCard
                key={idea.id}
                idea={idea}
                projectId={projectId}
                onPromote={() => promoteIdea.mutate(idea.id)}
                onDelete={() => {
                  if (confirmDeleteId === idea.id) {
                    deleteIdea.mutate(idea.id);
                  } else {
                    setConfirmDeleteId(idea.id);
                    setTimeout(() => setConfirmDeleteId((cur) => (cur === idea.id ? null : cur)), 3000);
                  }
                }}
                isPromoting={promotingId === idea.id}
                isPromoteDisabled={!!promotingId || bulkPromoting}
                isDeleting={deletingId === idea.id}
                isConfirmingDelete={confirmDeleteId === idea.id}
                isSelected={selectedIds.has(idea.id)}
                onToggleSelect={() => toggleSelect(idea.id)}
                showSelect={hasSelection}
              />
            ))}
          </div>
        </div>
      )}

      {/* Promoted ideas */}
      {!ideasLoading && promoted.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-muted-foreground">
            Promoted ({promoted.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promoted.map((idea) => (
              <SavedIdeaCard
                key={idea.id}
                idea={idea}
                projectId={projectId}
                isPromoted
                onDelete={() => {
                  if (confirmDeleteId === idea.id) {
                    deleteIdea.mutate(idea.id);
                  } else {
                    setConfirmDeleteId(idea.id);
                    setTimeout(() => setConfirmDeleteId((cur) => (cur === idea.id ? null : cur)), 3000);
                  }
                }}
                isDeleting={deletingId === idea.id}
                isConfirmingDelete={confirmDeleteId === idea.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!ideasLoading && !isStreaming && totalCount === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-3 rounded-full bg-muted mb-4">
              <Lightbulb className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4 text-center">
              No ideas yet. Click &quot;Generate Ideas&quot; to get started!
            </p>
            <Button onClick={generateIdeas} variant="outline" className="gap-2">
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
      <Card className="flex flex-col h-full rounded-xl border-0 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{idea.title}</CardTitle>
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
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saved idea card                                                     */
/* ------------------------------------------------------------------ */

function SavedIdeaCard({
  idea,
  projectId,
  isPromoted,
  onPromote,
  onDelete,
  isPromoting,
  isPromoteDisabled,
  isDeleting,
  isConfirmingDelete,
  isSelected,
  onToggleSelect,
  showSelect,
}: {
  idea: Idea;
  projectId: string;
  isPromoted?: boolean;
  onPromote?: () => void;
  onDelete: () => void;
  isPromoting?: boolean;
  isPromoteDisabled?: boolean;
  isDeleting?: boolean;
  isConfirmingDelete?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showSelect?: boolean;
}) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-violet-500/10 via-transparent to-indigo-500/10 p-[1px]">
      <Card
        className={cn(
          "flex flex-col h-full rounded-xl border-0 bg-card transition-all",
          isPromoted && "opacity-60",
          isSelected && "ring-2 ring-violet-500 ring-offset-1"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              {/* Checkbox for bulk select (unpromoted only) */}
              {showSelect && onToggleSelect && (
                <button
                  onClick={onToggleSelect}
                  className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 text-violet-500" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              )}
              <CardTitle className="text-base leading-snug">{idea.title}</CardTitle>
            </div>
            {idea.category && (
              <Badge
                variant="secondary"
                className={cn(getCategoryColor(idea.category), "shrink-0 border text-xs font-medium")}
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
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-green-600 border-green-500/30 bg-green-500/10 gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Promoted
              </Badge>
              {idea.epic && (
                <a
                  href={`/projects/${projectId}/board`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title={`Epic: ${idea.epic.title}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {idea.epic.title}
                </a>
              )}
            </div>
          ) : onPromote ? (
            <Button
              size="sm"
              onClick={onPromote}
              disabled={isPromoting || isPromoteDisabled || isDeleting}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isPromoting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Rocket className="h-3.5 w-3.5" />
              )}
              {isPromoting ? "Promoting..." : "Promote to Epic"}
            </Button>
          ) : null}
          {/* Delete with confirmation */}
          <Button
            size={isConfirmingDelete ? "sm" : "icon"}
            variant={isConfirmingDelete ? "destructive" : "ghost"}
            onClick={onDelete}
            disabled={isDeleting || isPromoting}
            className={cn(
              isConfirmingDelete
                ? "gap-1.5 text-xs"
                : "h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            )}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isConfirmingDelete ? (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                Confirm
              </>
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
      // Partial JSON — fall through
    }
  }

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
    } catch { /* skip */ }
  }
  return ideas;
}
