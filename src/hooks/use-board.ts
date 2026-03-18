"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import type { TaskStatus } from "@/types";
import { TASK_STATUSES } from "@/types";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  userStory: string | null;
  acceptanceCriteria: string | null;
  status: TaskStatus;
  priority: number;
  estimatedEffort: string | null;
  sortOrder: number;
  branchName: string | null;
  worktreePath: string | null;
  projectId: string;
  epicId: string | null;
  workstreamId: string | null;
  createdAt: string;
  updatedAt: string;
  workstream?: { id: string; name: string; slug: string; color: string };
  epic?: { id: string; title: string };
  dependencies?: {
    id: string;
    dependencyId: string;
    dependency: { id: string; title: string; status: string };
  }[];
}

export interface Workstream {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface Epic {
  id: string;
  title: string;
  description: string | null;
}

export type GroupedTasks = Record<TaskStatus, Task[]>;

interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  estimatedEffort?: string;
  projectId: string;
  epicId?: string | null;
  workstreamId?: string | null;
}

interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  estimatedEffort?: string;
  epicId?: string | null;
  workstreamId?: string | null;
}

interface ReorderInput {
  taskId: string;
  status: TaskStatus;
  sortOrder: number;
}

export function useBoard(projectId: string) {
  const queryClient = useQueryClient();
  const [activeWorkstreamSlug, setActiveWorkstreamSlug] = useState<
    string | null
  >(null);

  // Fetch tasks
  const tasksQuery = useQuery<Task[]>({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    enabled: !!projectId,
  });

  // Fetch workstreams
  const workstreamsQuery = useQuery<Workstream[]>({
    queryKey: ["workstreams", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      const project = await res.json();
      return project.workstreams ?? [];
    },
    enabled: !!projectId,
  });

  // Fetch epics
  const epicsQuery = useQuery<Epic[]>({
    queryKey: ["epics", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/epics?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch epics");
      return res.json();
    },
    enabled: !!projectId,
  });

  // Group and filter tasks
  const groupedTasks = useMemo<GroupedTasks>(() => {
    const tasks = tasksQuery.data ?? [];
    const filtered = activeWorkstreamSlug
      ? tasks.filter((t) => t.workstream?.slug === activeWorkstreamSlug)
      : tasks;

    const groups: GroupedTasks = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };

    for (const task of filtered) {
      const status = task.status as TaskStatus;
      if (groups[status]) {
        groups[status].push(task);
      }
    }

    // Sort by sortOrder within each group
    for (const status of TASK_STATUSES) {
      groups[status.value].sort((a, b) => a.sortOrder - b.sortOrder);
    }

    return groups;
  }, [tasksQuery.data, activeWorkstreamSlug]);

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async (input: UpdateTaskInput) => {
      const { id, ...data } = input;
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  // Reorder task mutation with optimistic updates
  const reorderTask = useMutation({
    mutationFn: async (input: ReorderInput) => {
      const res = await fetch("/api/tasks/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to reorder task");
      return res.json();
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>([
        "tasks",
        projectId,
      ]);

      queryClient.setQueryData<Task[]>(["tasks", projectId], (old) => {
        if (!old) return old;
        return old.map((task) =>
          task.id === input.taskId
            ? { ...task, status: input.status, sortOrder: input.sortOrder }
            : task
        );
      });

      return { previousTasks };
    },
    onError: (_err, _input, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(
          ["tasks", projectId],
          context.previousTasks
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  // Delete task mutation
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  return {
    tasks: tasksQuery.data ?? [],
    groupedTasks,
    isLoading: tasksQuery.isLoading,
    isError: tasksQuery.isError,
    workstreams: workstreamsQuery.data ?? [],
    epics: epicsQuery.data ?? [],
    activeWorkstreamSlug,
    setActiveWorkstreamSlug,
    createTask,
    updateTask,
    reorderTask,
    deleteTask,
  };
}
