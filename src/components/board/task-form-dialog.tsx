"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUSES, PRIORITIES, EFFORTS } from "@/types";
import type { TaskStatus, Priority, Effort } from "@/types";
import type { Task, Workstream, Epic } from "@/hooks/use-board";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workstreams: Workstream[];
  epics: Epic[];
  task?: Task | null;
  defaultStatus?: TaskStatus;
  onSubmit: (data: {
    title: string;
    description?: string;
    status: TaskStatus;
    priority: number;
    estimatedEffort?: string;
    workstreamId?: string | null;
    epicId?: string | null;
    projectId: string;
  }) => void;
  isSubmitting?: boolean;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  projectId,
  workstreams,
  epics,
  task,
  defaultStatus = "backlog",
  onSubmit,
  isSubmitting = false,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<Priority>(3);
  const [effort, setEffort] = useState<Effort | "">("");
  const [workstreamId, setWorkstreamId] = useState<string>("");
  const [epicId, setEpicId] = useState<string>("");

  const isEditing = !!task;

  // Pre-fill fields when editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority as Priority);
      setEffort((task.estimatedEffort as Effort) ?? "");
      setWorkstreamId(task.workstreamId ?? "");
      setEpicId(task.epicId ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus);
      setPriority(3);
      setEffort("");
      setWorkstreamId("");
      setEpicId("");
    }
  }, [task, defaultStatus, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      estimatedEffort: effort || undefined,
      workstreamId: workstreamId || null,
      epicId: epicId || null,
      projectId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Create Task"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the task details below."
              : "Fill in the details to create a new task."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="Task title..."
              value={title}
              onChange={(e) =>
                setTitle((e.target as HTMLInputElement).value)
              }
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              placeholder="Describe the task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Status & Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as TaskStatus)}
              >
                <SelectTrigger className="w-full">
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
              <Label>Priority</Label>
              <Select
                value={String(priority)}
                onValueChange={(val) => setPriority(Number(val) as Priority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${p.color}`}
                        />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Effort & Workstream row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Effort</Label>
              <Select
                value={effort}
                onValueChange={(val) => setEffort(val as Effort)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select effort" />
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

            <div className="space-y-1.5">
              <Label>Workstream</Label>
              <Select
                value={workstreamId}
                onValueChange={(val) => setWorkstreamId(val ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select workstream" />
                </SelectTrigger>
                <SelectContent>
                  {workstreams.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: ws.color }}
                        />
                        {ws.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Epic */}
          {epics.length > 0 && (
            <div className="space-y-1.5">
              <Label>Epic</Label>
              <Select
                value={epicId}
                onValueChange={(val) => setEpicId(val ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select epic" />
                </SelectTrigger>
                <SelectContent>
                  {epics.map((epic) => (
                    <SelectItem key={epic.id} value={epic.id}>
                      {epic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Update Task"
                  : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
