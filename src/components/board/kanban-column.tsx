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

const COLUMN_TOP_BAR: Record<TaskStatus, string> = {
  backlog: "bg-slate-400 dark:bg-slate-500",
  todo: "bg-blue-500 dark:bg-blue-400",
  in_progress: "bg-amber-500 dark:bg-amber-400",
  review: "bg-purple-500 dark:bg-purple-400",
  done: "bg-emerald-500 dark:bg-emerald-400",
};

const COLUMN_DOT_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-slate-400 dark:bg-slate-500",
  todo: "bg-blue-500 dark:bg-blue-400",
  in_progress: "bg-amber-500 dark:bg-amber-400",
  review: "bg-purple-500 dark:bg-purple-400",
  done: "bg-emerald-500 dark:bg-emerald-400",
};

const COLUMN_BADGE_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  todo: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  review: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
};

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  projectId: string;
  onQuickAdd: (title: string, status: TaskStatus) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (taskId: string) => void;
  onClickTask?: (task: Task) => void;
}

export function KanbanColumn({
  status,
  title,
  tasks,
  projectId,
  onQuickAdd,
  onEditTask,
  onDeleteTask,
  onClickTask,
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
        "flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow",
        COLUMN_COLORS[status],
        isOver && "ring-2 ring-primary/30 shadow-md"
      )}
    >
      {/* Colored top bar */}
      <div className={cn("h-1 w-full", COLUMN_TOP_BAR[status])} />

      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", COLUMN_DOT_COLORS[status])} />
          <h3
            className={cn(
              "text-sm font-semibold",
              COLUMN_HEADER_COLORS[status]
            )}
          >
            {title}
          </h3>
          <span className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
            COLUMN_BADGE_COLORS[status]
          )}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => setIsAddingTask(true)}
          className={cn(
            "rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground",
            `hover:bg-${status === "backlog" ? "slate" : status === "todo" ? "blue" : status === "in_progress" ? "amber" : status === "review" ? "purple" : "emerald"}-100 dark:hover:bg-${status === "backlog" ? "slate" : status === "todo" ? "blue" : status === "in_progress" ? "amber" : status === "review" ? "purple" : "emerald"}-900/30`
          )}
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
            <TaskCard
              key={task.id}
              task={task}
              projectId={projectId}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onClick={onClickTask}
            />
          ))}
        </SortableContext>

        {/* Quick add input at bottom */}
        {isAddingTask && (
          <div className="rounded-lg border-2 border-dashed border-primary/20 bg-background/60 p-2 backdrop-blur-sm">
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
              className="h-8 border-primary/20 text-sm focus-visible:ring-primary/30"
            />
          </div>
        )}
      </div>
    </div>
  );
}
