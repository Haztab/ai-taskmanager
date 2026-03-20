"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { LockIcon, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITIES } from "@/types";
import type { Task } from "@/hooks/use-board";

const PRIORITY_PILL_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  2: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  4: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  5: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400",
};

interface TaskCardProps {
  task: Task;
  projectId: string;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onClick?: (task: Task) => void;
}

export function TaskCard({ task, projectId, onEdit, onDelete, onClick }: TaskCardProps) {
  const router = useRouter();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "task",
      task,
      status: task.status,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityConfig = PRIORITIES.find((p) => p.value === task.priority);
  const hasUnfinishedDeps =
    task.dependencies &&
    task.dependencies.some((d) => d.dependency.status !== "done");

  const workstreamColor = task.workstream?.color ?? "transparent";

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-navigate]")) return;
    if (onClick) {
      onClick(task);
    } else {
      router.push(`/projects/${projectId}/tasks/${task.id}`);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftColor: workstreamColor,
        borderLeftWidth: task.workstream ? "3px" : undefined,
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-[2px] active:cursor-grabbing",
        isDragging && "z-50 opacity-50 shadow-lg",
        hasUnfinishedDeps && "opacity-60 border-dashed border-amber-500/40"
      )}
    >
      {/* Title row */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {hasUnfinishedDeps && (
              <LockIcon className="size-3.5 shrink-0 text-amber-500 animate-pulse" />
            )}
            <p className="truncate text-sm font-medium leading-tight">
              {task.title}
            </p>
          </div>
        </div>

        {/* Quick actions (visible on hover) */}
        <div
          data-no-navigate
          className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit task"
            >
              <Pencil className="size-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete task"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Bottom row: badges */}
      <div className="mt-2 flex items-center gap-1.5">
        {priorityConfig && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              PRIORITY_PILL_COLORS[task.priority] ?? "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", priorityConfig.color)}
            />
            {priorityConfig.label}
          </span>
        )}

        {task.estimatedEffort && (
          <span className="ml-auto inline-flex items-center rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-inset ring-muted-foreground/10">
            {task.estimatedEffort}
          </span>
        )}
      </div>

      {/* Epic indicator */}
      {task.epic && (
        <div className="mt-1.5 truncate text-[10px] text-muted-foreground">
          {task.epic.title}
        </div>
      )}
    </div>
  );
}
