"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { TaskCard } from "./task-card";
import type { Task } from "@/hooks/use-board";
import type { TaskStatus } from "@/types";

const COLUMN_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-slate-50 dark:bg-slate-900/50",
  todo: "bg-blue-50/50 dark:bg-blue-950/30",
  in_progress: "bg-amber-50/50 dark:bg-amber-950/30",
  review: "bg-purple-50/50 dark:bg-purple-950/30",
  done: "bg-emerald-50/50 dark:bg-emerald-950/30",
};

const COLUMN_HEADER_COLORS: Record<TaskStatus, string> = {
  backlog: "text-slate-600 dark:text-slate-400",
  todo: "text-blue-600 dark:text-blue-400",
  in_progress: "text-amber-600 dark:text-amber-400",
  review: "text-purple-600 dark:text-purple-400",
  done: "text-emerald-600 dark:text-emerald-400",
};

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  projectId: string;
  onQuickAdd: (title: string, status: TaskStatus) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  projectId,
  onQuickAdd,
}: KanbanColumnProps) {
  const [quickAddValue, setQuickAddValue] = useState("");
  const [isAddingTask, setIsAddingTask] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: {
      type: "column",
      status,
    },
  });

  const taskIds = tasks.map((t) => t.id);

  const handleQuickAdd = () => {
    const trimmed = quickAddValue.trim();
    if (!trimmed) return;
    onQuickAdd(trimmed, status);
    setQuickAddValue("");
    setIsAddingTask(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleQuickAdd();
    } else if (e.key === "Escape") {
      setQuickAddValue("");
      setIsAddingTask(false);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl border",
        COLUMN_COLORS[status],
        isOver && "ring-2 ring-primary/30"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "text-sm font-semibold",
              COLUMN_HEADER_COLORS[status]
            )}
          >
            {title}
          </h3>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => setIsAddingTask(true)}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 overflow-y-auto px-2 pb-2"
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} projectId={projectId} />
          ))}
        </SortableContext>

        {/* Quick add input at bottom */}
        {isAddingTask && (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-2">
            <Input
              autoFocus
              placeholder="Task title..."
              value={quickAddValue}
              onChange={(e) =>
                setQuickAddValue((e.target as HTMLInputElement).value)
              }
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!quickAddValue.trim()) {
                  setIsAddingTask(false);
                }
              }}
              className="h-7 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
