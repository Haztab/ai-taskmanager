"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Link2,
  Sparkles,
  GitBranch,
  Pencil,
  X,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Terminal,
} from "lucide-react";
import {
  type TaskStatus,
  type Priority,
  type Effort,
  TASK_STATUSES,
  PRIORITIES,
  EFFORTS,
} from "@/types";

interface TaskDetail {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  userStory: string | null;
  acceptanceCriteria: string | null;
  priority: number;
  estimatedEffort: string | null;
  status: string;
  branchName: string | null;
  worktreePath: string | null;
  epicId: string | null;
  workstreamId: string | null;
  epic?: { id: string; title: string } | null;
  workstream?: {
    id: string;
    name: string;
    slug: string;
    color: string;
  } | null;
  dependencies?: {
    id: string;
    dependencyId: string;
    dependency: { id: string; title: string; status: string };
  }[];
  sessions?: {
    id: string;
    prompt: string;
    status: string;
    createdAt: string;
  }[];
}

interface TaskDetailModalProps {
  taskId: string | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseAcceptanceCriteria(ac: string | null): string[] {
  if (!ac) return [];
  try {
    const parsed = JSON.parse(ac);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return ac ? [ac] : [];
  }
}

function getStatusStyle(status: string): string {
  switch (status) {
    case "done":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "in_progress":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "review":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
    case "todo":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    default:
      return "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30";
  }
}

function getPriorityStyle(priority: number): string {
  switch (priority) {
    case 1:
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
    case 2:
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
    case 3:
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
    case 4:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
    default:
      return "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30";
  }
}

interface SimpleTask {
  id: string;
  title: string;
  status: string;
}

export function TaskDetailModal({
  taskId,
  projectId,
  open,
  onOpenChange,
}: TaskDetailModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [depSearch, setDepSearch] = useState("");
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [editForm, setEditForm] = useState<{
    title?: string;
    description?: string;
    userStory?: string;
    acceptanceCriteria?: string[];
    priority?: number;
    estimatedEffort?: string;
    status?: string;
  }>({});

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json();
    },
    enabled: !!taskId && open,
  });

  // Fetch all tasks in project for dependency picker
  const { data: allTasks = [] } = useQuery<SimpleTask[]>({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && open,
  });

  const addDependency = useMutation({
    mutationFn: async (dependencyId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to add dependency");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      setDepSearch("");
      setShowDepPicker(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeDependency = useMutation({
    mutationFn: async (dependencyId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencyId }),
      });
      if (!res.ok) throw new Error("Failed to remove dependency");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateTask = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Task updated");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refineTask = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/refine-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error("Failed to refine task");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Task refined by AI");
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createWorktree = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/worktree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error("Failed to create worktree");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Worktree created!");
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEditing = () => {
    if (!task) return;
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      userStory: task.userStory ?? "",
      acceptanceCriteria: parseAcceptanceCriteria(task.acceptanceCriteria),
      priority: task.priority,
      estimatedEffort: task.estimatedEffort ?? "",
      status: task.status,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    const updates: Record<string, unknown> = { ...editForm };
    if (editForm.acceptanceCriteria) {
      updates.acceptanceCriteria = JSON.stringify(editForm.acceptanceCriteria);
    }
    updateTask.mutate(updates);
  };

  const handleClose = (o: boolean) => {
    if (!o) setIsEditing(false);
    onOpenChange(o);
  };

  const acceptanceCriteria = task
    ? parseAcceptanceCriteria(task.acceptanceCriteria)
    : [];
  const priorityInfo = PRIORITIES.find((p) => p.value === task?.priority);
  const statusInfo = TASK_STATUSES.find((s) => s.value === task?.status);

  const unfinishedDeps = (task?.dependencies ?? []).filter(
    (d) => d.dependency.status !== "done"
  );
  const isBlocked = unfinishedDeps.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-hidden p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-muted/30 to-transparent">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={editForm.title ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, title: e.target.value }))
                    }
                    className="text-lg font-semibold h-auto py-1 px-2 -ml-2"
                  />
                ) : (
                  <DialogTitle className="text-lg leading-tight">
                    {isLoading ? (
                      <Skeleton className="h-6 w-64" />
                    ) : (
                      task?.title ?? "Task"
                    )}
                  </DialogTitle>
                )}
                <DialogDescription className="sr-only">
                  Task details
                </DialogDescription>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isEditing && task && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 h-8 text-xs"
                      onClick={() => refineTask.mutate()}
                      disabled={refineTask.isPending}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {refineTask.isPending ? "Refining..." : "AI Refine"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 h-8 text-xs"
                      onClick={startEditing}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 h-8 text-xs"
                      onClick={() => {
                        handleClose(false);
                        router.push(
                          `/projects/${projectId}/tasks/${taskId}`
                        );
                      }}
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      Terminal
                    </Button>
                  </>
                )}
                {isEditing && (
                  <>
                    <Button
                      size="sm"
                      className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleSave}
                      disabled={updateTask.isPending}
                    >
                      <Save className="h-3.5 w-3.5" />
                      {updateTask.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setIsEditing(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Badges */}
          {task && !isLoading && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <Badge className={getStatusStyle(task.status) + " border text-xs"}>
                {statusInfo?.label ?? task.status}
              </Badge>
              {priorityInfo && (
                <Badge className={getPriorityStyle(task.priority) + " border text-xs"}>
                  {priorityInfo.label}
                </Badge>
              )}
              {task.estimatedEffort && (
                <Badge variant="secondary" className="text-xs">
                  {task.estimatedEffort}
                </Badge>
              )}
              {task.workstream && (
                <Badge
                  variant="secondary"
                  className="border text-xs"
                  style={{
                    borderColor: task.workstream.color,
                    backgroundColor: task.workstream.color + "15",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full mr-1 inline-block"
                    style={{ backgroundColor: task.workstream.color }}
                  />
                  {task.workstream.name}
                </Badge>
              )}
              {task.epic && (
                <Badge variant="outline" className="text-xs">
                  {task.epic.title}
                </Badge>
              )}
              {task.branchName && (
                <Badge variant="outline" className="text-xs gap-1 font-mono">
                  <GitBranch className="h-3 w-3" />
                  {task.branchName}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 max-h-[calc(90vh-180px)]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : task ? (
            <>
              {/* Edit: status/priority/effort row */}
              {isEditing && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v) =>
                        setEditForm((f) => ({
                          ...f,
                          status: v as TaskStatus,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <Select
                      value={String(editForm.priority)}
                      onValueChange={(v) =>
                        setEditForm((f) => ({
                          ...f,
                          priority: Number(v) as Priority,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={String(p.value)}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Effort</Label>
                    <Select
                      value={editForm.estimatedEffort}
                      onValueChange={(v) =>
                        setEditForm((f) => ({
                          ...f,
                          estimatedEffort: v as Effort,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {EFFORTS.map((e) => (
                          <SelectItem key={e} value={e}>
                            {e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Description */}
              <section>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Description
                </h4>
                {isEditing ? (
                  <Textarea
                    value={editForm.description ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="text-sm"
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap text-foreground/80">
                    {task.description || (
                      <span className="text-muted-foreground italic">
                        No description.
                      </span>
                    )}
                  </p>
                )}
              </section>

              {/* User Story */}
              {(task.userStory || isEditing) && (
                <section>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    User Story
                  </h4>
                  {isEditing ? (
                    <Textarea
                      value={editForm.userStory ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          userStory: e.target.value,
                        }))
                      }
                      rows={2}
                      className="text-sm italic"
                    />
                  ) : (
                    <p className="text-sm italic text-foreground/80">
                      {task.userStory}
                    </p>
                  )}
                </section>
              )}

              {/* Acceptance Criteria */}
              <section>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Acceptance Criteria
                </h4>
                {isEditing ? (
                  <div className="space-y-2">
                    {(editForm.acceptanceCriteria ?? []).map((ac, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={ac}
                          onChange={(e) => {
                            const updated = [
                              ...(editForm.acceptanceCriteria ?? []),
                            ];
                            updated[i] = e.target.value;
                            setEditForm((f) => ({
                              ...f,
                              acceptanceCriteria: updated,
                            }));
                          }}
                          className="text-sm h-8"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => {
                            const updated = (
                              editForm.acceptanceCriteria ?? []
                            ).filter((_, idx) => idx !== i);
                            setEditForm((f) => ({
                              ...f,
                              acceptanceCriteria: updated,
                            }));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() =>
                        setEditForm((f) => ({
                          ...f,
                          acceptanceCriteria: [
                            ...(f.acceptanceCriteria ?? []),
                            "",
                          ],
                        }))
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Add Criterion
                    </Button>
                  </div>
                ) : acceptanceCriteria.length > 0 ? (
                  <ul className="space-y-1.5">
                    {acceptanceCriteria.map((ac, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground/80"
                      >
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                        <span>{ac}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                    <Circle className="h-4 w-4 text-muted-foreground/50" />
                    No acceptance criteria defined.
                  </p>
                )}
              </section>

              {/* Dependencies */}
              <section>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Dependencies
                    {task.dependencies && task.dependencies.length > 0 && (
                      <span className="text-[10px] font-normal">
                        ({task.dependencies.length})
                      </span>
                    )}
                  </span>
                  {!showDepPicker && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => setShowDepPicker(true)}
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                  )}
                </h4>

                {/* Existing dependencies */}
                {task.dependencies && task.dependencies.length > 0 && (
                  <ul className="space-y-1.5 mb-2">
                    {task.dependencies.map((dep) => (
                      <li
                        key={dep.id}
                        className="flex items-center gap-2 text-sm p-2 rounded-lg border bg-muted/30 group"
                      >
                        {dep.dependency.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className="flex-1 truncate">{dep.dependency.title}</span>
                        <Badge
                          variant="outline"
                          className={
                            dep.dependency.status === "done"
                              ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-xs"
                              : "border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs"
                          }
                        >
                          {dep.dependency.status === "done" ? "Done" : "Pending"}
                        </Badge>
                        <button
                          onClick={() => removeDependency.mutate(dep.dependency.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5 rounded"
                          title="Remove dependency"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Dependency picker */}
                {showDepPicker && (
                  <div className="border rounded-lg p-2 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={depSearch}
                        onChange={(e) => setDepSearch(e.target.value)}
                        placeholder="Search tasks to add as dependency..."
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setShowDepPicker(false);
                            setDepSearch("");
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          setShowDepPicker(false);
                          setDepSearch("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {(() => {
                        const existingDepIds = new Set(
                          (task.dependencies ?? []).map((d) => d.dependency.id)
                        );
                        const q = depSearch.toLowerCase();
                        const available = allTasks.filter(
                          (t) =>
                            t.id !== taskId &&
                            !existingDepIds.has(t.id) &&
                            (q === "" || t.title.toLowerCase().includes(q))
                        );

                        if (available.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground py-2 text-center">
                              {depSearch ? "No matching tasks" : "No tasks available"}
                            </p>
                          );
                        }

                        return available.slice(0, 10).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => addDependency.mutate(t.id)}
                            className="w-full flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted transition-colors text-left"
                          >
                            <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{t.title}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {TASK_STATUSES.find((s) => s.value === t.status)?.label ?? t.status}
                            </Badge>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {(!task.dependencies || task.dependencies.length === 0) && !showDepPicker && (
                  <p className="text-sm text-muted-foreground italic">
                    No dependencies. This task can start immediately.
                  </p>
                )}
              </section>

              {/* Run Task / Status Actions */}
              {!isEditing && (
                <section className="pt-3 border-t space-y-3">
                  {/* Status flow info */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-muted">Backlog</span>
                    <span>→</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">To Do</span>
                    <span>→</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">In Progress</span>
                    <span>→</span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Review</span>
                    <span>→</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Done</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Primary action based on task state */}
                    {isBlocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-amber-600 border-amber-300"
                        disabled
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Blocked by Dependencies
                      </Button>
                    ) : !task.worktreePath ? (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm"
                        onClick={async () => {
                          // Create worktree (auto-moves to in_progress)
                          createWorktree.mutate(undefined, {
                            onSuccess: () => {
                              // Navigate to terminal page
                              handleClose(false);
                              router.push(`/projects/${projectId}/tasks/${taskId}`);
                            },
                          });
                        }}
                        disabled={createWorktree.isPending}
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        {createWorktree.isPending ? "Setting up..." : "Run Task"}
                      </Button>
                    ) : task.status === "in_progress" ? (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm"
                        onClick={() => {
                          handleClose(false);
                          router.push(`/projects/${projectId}/tasks/${taskId}`);
                        }}
                      >
                        <Terminal className="h-3.5 w-3.5" />
                        Open Terminal
                      </Button>
                    ) : task.status === "review" ? (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={async () => {
                          await fetch(`/api/tasks/${taskId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "done" }),
                          });
                          queryClient.invalidateQueries({ queryKey: ["task", taskId] });
                          queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
                          toast.success("Task marked as done!");
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark as Done
                      </Button>
                    ) : task.status === "done" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 border">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    ) : null}

                    {/* Secondary: open terminal if worktree exists */}
                    {task.worktreePath && task.status !== "done" && task.status !== "in_progress" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          handleClose(false);
                          router.push(`/projects/${projectId}/tasks/${taskId}`);
                        }}
                      >
                        <Terminal className="h-3.5 w-3.5" />
                        Open Terminal
                      </Button>
                    )}

                    {/* Open full page */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-muted-foreground ml-auto"
                      onClick={() => {
                        handleClose(false);
                        router.push(`/projects/${projectId}/tasks/${taskId}`);
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Full Page
                    </Button>
                  </div>
                </section>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Task not found.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
