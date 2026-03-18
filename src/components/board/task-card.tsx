"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITIES } from "@/types";
import type { Task } from "@/hooks/use-board";

interface TaskCardProps {
  task: Task;
  projectId: string;
}

export function TaskCard({ task, projectId }: TaskCardProps) {
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

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if we're dragging
    if (isDragging) return;
    // Don't navigate if user clicked during a potential drag
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-navigate]")) return;
    router.push(`/projects/${projectId}/tasks/${task.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "z-50 opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Workstream color indicator */}
        {task.workstream && (
          <div
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: task.workstream.color }}
            title={task.workstream.name}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {hasUnfinishedDeps && (
              <LockIcon className="size-3 shrink-0 text-amber-500" />
            )}
            <p className="truncate text-sm font-medium leading-tight">
              {task.title}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom row: badges */}
      <div className="mt-2 flex items-center gap-1.5">
        {/* Priority dot */}
        {priorityConfig && (
          <span
            className={cn("size-2 shrink-0 rounded-full", priorityConfig.color)}
            title={priorityConfig.label}
          />
        )}

        {/* Priority label */}
        {priorityConfig && (
          <span className="text-[10px] text-muted-foreground">
            {priorityConfig.label}
          </span>
        )}

        {/* Effort badge */}
        {task.estimatedEffort && (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
