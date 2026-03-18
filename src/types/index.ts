export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export type Priority = 1 | 2 | 3 | 4;

export type Effort = "XS" | "S" | "M" | "L" | "XL";

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 1, label: "Critical", color: "bg-red-500" },
  { value: 2, label: "High", color: "bg-orange-500" },
  { value: 3, label: "Medium", color: "bg-yellow-500" },
  { value: 4, label: "Low", color: "bg-blue-500" },
];

export const EFFORTS: Effort[] = ["XS", "S", "M", "L", "XL"];

export const DEFAULT_WORKSTREAMS = [
  { name: "Frontend", slug: "fe", color: "#3B82F6" },
  { name: "Backend", slug: "be", color: "#10B981" },
  { name: "Mobile", slug: "mobile", color: "#8B5CF6" },
  { name: "Dashboard", slug: "dashboard", color: "#F59E0B" },
  { name: "Database", slug: "db", color: "#EF4444" },
];

export interface GeneratedIdea {
  title: string;
  description: string;
  category: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  userStory: string;
  acceptanceCriteria: string[];
  estimatedEffort: Effort;
  workstream: string;
}
