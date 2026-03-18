"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/layout/header";
import { ClaudeTerminal } from "@/components/terminal/claude-terminal";
import { toast } from "sonner";
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
  workstream?: { id: string; name: string; slug: string; color: string } | null;
  dependencies?: { id: string; dependencyId: string; dependency: { id: string; title: string; status: string } }[];
  sessions?: { id: string; prompt: string; status: string; createdAt: string }[];
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

export default function TaskDetailPage() {
  const params = useParams<{ projectId: string; taskId: string }>();
  const { projectId, taskId } = params;
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json();
    },
  });

  const [editForm, setEditForm] = useState<{
    title?: string;
    description?: string;
    userStory?: string;
    acceptanceCriteria?: string[];
    priority?: number;
    estimatedEffort?: string;
    status?: string;
  }>({});

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
    onError: (error: Error) => {
      toast.error(error.message);
    },
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
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
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
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const startEditing = () => {
    if (task) {
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
    }
  };

  const handleSave = () => {
    const updates: Record<string, unknown> = { ...editForm };
    if (editForm.acceptanceCriteria) {
      updates.acceptanceCriteria = JSON.stringify(editForm.acceptanceCriteria);
    }
    updateTask.mutate(updates);
  };

  const acceptanceCriteria = task ? parseAcceptanceCriteria(task.acceptanceCriteria) : [];
  const priorityInfo = PRIORITIES.find((p) => p.value === task?.priority);
  const statusInfo = TASK_STATUSES.find((s) => s.value === task?.status);

  // Dependency blocking: check if any dependency is not "done"
  const unfinishedDeps = (task?.dependencies ?? []).filter(
    (d) => d.dependency.status !== "done"
  );
  const isBlocked = unfinishedDeps.length > 0;
  const blockedByNames = unfinishedDeps.map((d) => d.dependency.title);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Loading..."
          breadcrumbs={[
            { label: "Projects", href: "/" },
            { label: "Board", href: `/projects/${projectId}/board` },
            { label: "Task" },
          ]}
        />
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col h-full">
        <Header
          title="Task Not Found"
          breadcrumbs={[
            { label: "Projects", href: "/" },
            { label: "Board", href: `/projects/${projectId}/board` },
          ]}
        />
        <div className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Task not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title={task.title}
        breadcrumbs={[
          { label: "Projects", href: "/" },
          { label: "Board", href: `/projects/${projectId}/board` },
          { label: task.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refineTask.mutate()}
              disabled={refineTask.isPending}
            >
              {refineTask.isPending ? "Refining..." : "AI Refine"}
            </Button>
            {!task.worktreePath && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isBlocked) {
                    toast.error(
                      `Blocked by: ${blockedByNames.join(", ")}. Complete dependencies first.`
                    );
                    return;
                  }
                  createWorktree.mutate();
                }}
                disabled={createWorktree.isPending || isBlocked}
                title={
                  isBlocked
                    ? `Blocked by: ${blockedByNames.join(", ")}`
                    : "Create a git worktree to start coding"
                }
              >
                {isBlocked
                  ? "Blocked"
                  : createWorktree.isPending
                  ? "Creating..."
                  : "Start Work"}
              </Button>
            )}
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={updateTask.isPending}>
                  {updateTask.isPending ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEditing}>
                Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left side - Task details */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{statusInfo?.label ?? task.status}</Badge>
            {priorityInfo && (
              <Badge className={priorityInfo.color + " text-white"}>
                {priorityInfo.label}
              </Badge>
            )}
            {task.estimatedEffort && (
              <Badge variant="secondary">Effort: {task.estimatedEffort}</Badge>
            )}
            {task.workstream && (
              <Badge variant="secondary" style={{ borderColor: task.workstream.color }}>
                {task.workstream.name}
              </Badge>
            )}
            {task.epic && (
              <Badge variant="outline">Epic: {task.epic.title}</Badge>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editForm.description ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {task.description || "No description."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">User Story</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editForm.userStory ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, userStory: e.target.value }))}
                  rows={3}
                />
              ) : (
                <p className="text-sm italic whitespace-pre-wrap">
                  {task.userStory || "No user story."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Acceptance Criteria</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-2">
                  {(editForm.acceptanceCriteria ?? []).map((ac, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={ac}
                        onChange={(e) => {
                          const updated = [...(editForm.acceptanceCriteria ?? [])];
                          updated[i] = e.target.value;
                          setEditForm((f) => ({ ...f, acceptanceCriteria: updated }));
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const updated = (editForm.acceptanceCriteria ?? []).filter((_, idx) => idx !== i);
                          setEditForm((f) => ({ ...f, acceptanceCriteria: updated }));
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditForm((f) => ({
                        ...f,
                        acceptanceCriteria: [...(f.acceptanceCriteria ?? []), ""],
                      }))
                    }
                  >
                    Add Criterion
                  </Button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {acceptanceCriteria.length > 0 ? (
                    acceptanceCriteria.map((ac, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-0.5 rounded" readOnly />
                        <span>{ac}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-muted-foreground">
                      No acceptance criteria defined.
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Task Properties</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editForm.title ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as TaskStatus }))}
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={String(editForm.priority)}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, priority: Number(v) as Priority }))}
                  >
                    <SelectTrigger>
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
                <div className="space-y-2">
                  <Label>Effort</Label>
                  <Select
                    value={editForm.estimatedEffort}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, estimatedEffort: v as Effort }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              </CardContent>
            </Card>
          )}

          {/* Dependencies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Dependencies</CardTitle>
            </CardHeader>
            <CardContent>
              {task.dependencies && task.dependencies.length > 0 ? (
                <ul className="space-y-1">
                  {task.dependencies.map((dep) => (
                    <li key={dep.id} className="flex items-center gap-2 text-sm">
                      <Badge
                        variant="outline"
                        className={
                          dep.dependency.status === "done"
                            ? "border-green-500 text-green-600"
                            : "border-yellow-500 text-yellow-600"
                        }
                      >
                        {dep.dependency.status === "done" ? "Done" : "Blocked"}
                      </Badge>
                      <span>{dep.dependency.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No dependencies.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator orientation="vertical" />

        {/* Right side - Claude Code Terminal */}
        <div className="w-[500px] p-4">
          <ClaudeTerminal
            taskId={taskId}
            worktreePath={task.worktreePath}
            isBlocked={isBlocked}
            blockedBy={blockedByNames}
            onSessionComplete={() => {
              queryClient.invalidateQueries({ queryKey: ["task", taskId] });
            }}
          />
        </div>
      </div>
    </div>
  );
}
