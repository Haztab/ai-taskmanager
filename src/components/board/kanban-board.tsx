"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { TASK_STATUSES } from "@/types";
import type { TaskStatus } from "@/types";
import { useBoard } from "@/hooks/use-board";
import type { Task } from "@/hooks/use-board";
import { WorkstreamTabs } from "@/components/layout/workstream-tabs";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskDetailModal } from "./task-detail-modal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface KanbanBoardProps {
  projectId: string;
}

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const {
    tasks: allTasks,
    groupedTasks,
    isLoading,
    workstreams,
    epics,
    activeWorkstreamSlug,
    setActiveWorkstreamSlug,
    createTask,
    updateTask,
    reorderTask,
    deleteTask,
  } = useBoard(projectId);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("backlog");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Task count summary
  const taskCount = useMemo(() => {
    let total = 0;
    for (const status of TASK_STATUSES) {
      total += groupedTasks[status.value].length;
    }
    return total;
  }, [groupedTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const taskData = active.data.current;
      if (taskData?.type === "task") {
        setActiveTask(taskData.task as Task);
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      if (!activeData || activeData.type !== "task") return;

      const draggedTask = activeData.task as Task;
      const draggedTaskId = draggedTask.id;
      const sourceStatus = draggedTask.status as TaskStatus;

      const hasUnfinishedDeps =
        draggedTask.dependencies &&
        draggedTask.dependencies.some((d) => d.dependency.status !== "done");

      let targetStatus: TaskStatus;
      const overData = over.data.current;

      if (overData?.type === "column") {
        targetStatus = overData.status as TaskStatus;
      } else if (overData?.type === "task") {
        targetStatus = (overData.task as Task).status as TaskStatus;
      } else {
        const overId = String(over.id);
        if (overId.startsWith("column-")) {
          targetStatus = overId.replace("column-", "") as TaskStatus;
        } else {
          return;
        }
      }

      const activeStatuses: TaskStatus[] = ["in_progress", "review", "done"];
      if (hasUnfinishedDeps && activeStatuses.includes(targetStatus)) {
        toast.error("Cannot move: task has unfinished dependencies");
        return;
      }

      const sourceTasks = [...groupedTasks[sourceStatus]];
      const targetTasks =
        sourceStatus === targetStatus
          ? sourceTasks
          : [...groupedTasks[targetStatus]];

      if (sourceStatus === targetStatus) {
        const oldIndex = sourceTasks.findIndex((t) => t.id === draggedTaskId);
        const overTaskId = String(over.id);
        const newIndex = sourceTasks.findIndex((t) => t.id === overTaskId);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(sourceTasks, oldIndex, newIndex);
        const newSortOrder = newIndex;

        reorderTask.mutate(
          {
            taskId: draggedTaskId,
            status: targetStatus,
            sortOrder: newSortOrder,
          },
          {
            onError: () => {
              toast.error("Failed to reorder task");
            },
          }
        );
      } else {
        let newSortOrder: number;

        if (overData?.type === "task") {
          const overTaskId = String(over.id);
          const targetIndex = targetTasks.findIndex(
            (t) => t.id === overTaskId
          );
          newSortOrder = targetIndex >= 0 ? targetIndex : targetTasks.length;
        } else {
          newSortOrder = targetTasks.length;
        }

        reorderTask.mutate(
          {
            taskId: draggedTaskId,
            status: targetStatus,
            sortOrder: newSortOrder,
          },
          {
            onError: () => {
              toast.error("Failed to move task");
            },
          }
        );
      }
    },
    [groupedTasks, reorderTask]
  );

  const handleQuickAdd = useCallback(
    (title: string, status: TaskStatus) => {
      // Find workstream matching active filter for context-aware quick-add
      const workstream = activeWorkstreamSlug
        ? workstreams.find((ws) => ws.slug === activeWorkstreamSlug)
        : undefined;

      createTask.mutate(
        {
          title,
          status,
          priority: 3,
          projectId,
          workstreamId: workstream?.id ?? undefined,
        },
        {
          onError: () => {
            toast.error("Failed to create task");
          },
        }
      );
    },
    [createTask, projectId, activeWorkstreamSlug, workstreams]
  );

  const handleClickTask = useCallback((task: Task) => {
    setDetailTaskId(task.id);
    setDetailOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setDefaultStatus(task.status);
    setDialogOpen(true);
  }, []);

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      deleteTask.mutate(taskId, {
        onSuccess: () => toast.success("Task deleted"),
        onError: () => toast.error("Failed to delete task"),
      });
    },
    [deleteTask]
  );

  const handleFormSubmit = useCallback(
    (data: {
      title: string;
      description?: string;
      status: TaskStatus;
      priority: number;
      estimatedEffort?: string;
      workstreamId?: string | null;
      epicId?: string | null;
      projectId: string;
    }) => {
      if (editingTask) {
        updateTask.mutate(
          {
            id: editingTask.id,
            ...data,
          },
          {
            onSuccess: () => {
              setDialogOpen(false);
              setEditingTask(null);
              toast.success("Task updated");
            },
            onError: () => {
              toast.error("Failed to update task");
            },
          }
        );
      } else {
        createTask.mutate(data, {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success("Task created");
          },
          onError: () => {
            toast.error("Failed to create task");
          },
        });
      }
    },
    [editingTask, createTask, updateTask]
  );

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b px-4 py-2">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex flex-1 gap-4 overflow-x-auto p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-72 shrink-0 space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Workstream filter tabs + task count + add button */}
      <div className="flex items-center justify-between border-b pr-4">
        <WorkstreamTabs
          workstreams={workstreams}
          activeSlug={activeWorkstreamSlug}
          onSelect={setActiveWorkstreamSlug}
        />
        <div className="flex items-center gap-3">
          {taskCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {taskCount} task{taskCount !== 1 ? "s" : ""}
            </span>
          )}
          <Button
            size="sm"
            className="gap-1.5 bg-primary font-semibold shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            onClick={() => {
              setEditingTask(null);
              setDefaultStatus("todo");
              setDialogOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Board columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto bg-gradient-to-br from-slate-50/80 via-white to-slate-100/60 p-6 dark:from-slate-950/80 dark:via-slate-900 dark:to-slate-950/60">
          {TASK_STATUSES.map((statusConfig) => (
            <KanbanColumn
              key={statusConfig.value}
              status={statusConfig.value}
              title={statusConfig.label}
              tasks={groupedTasks[statusConfig.value]}
              projectId={projectId}
              onQuickAdd={handleQuickAdd}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onClickTask={handleClickTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-72 rotate-3 opacity-90">
              <TaskCard task={activeTask} projectId={projectId} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task creation/editing dialog */}
      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        projectId={projectId}
        workstreams={workstreams}
        epics={epics}
        task={editingTask}
        defaultStatus={defaultStatus}
        onSubmit={handleFormSubmit}
        isSubmitting={createTask.isPending || updateTask.isPending}
      />

      {/* Task detail modal */}
      <TaskDetailModal
        taskId={detailTaskId}
        projectId={projectId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailTaskId(null);
        }}
      />
    </div>
  );
}
