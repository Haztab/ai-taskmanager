"use client";

import { useParams } from "next/navigation";
import { KanbanBoard } from "@/components/board/kanban-board";

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  return (
    <div className="h-full">
      <KanbanBoard projectId={projectId} />
    </div>
  );
}
