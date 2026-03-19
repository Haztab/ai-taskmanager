"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  Layers,
  Lightbulb,
  FolderPlus,
  Plus,
  ArrowRight,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  repoPath: string | null;
  createdAt: string;
  _count: { tasks: number; epics: number; ideas: number };
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => fetch("/api/projects").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Projects"
        actions={
          <Button onClick={() => router.push("/projects/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        }
      />

      <div className="flex-1 p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-[#e4e4e7] p-6 animate-pulse">
                <div className="h-5 bg-[#f0f0f3] rounded w-3/4 mb-3" />
                <div className="h-4 bg-[#f0f0f3] rounded w-full mb-2" />
                <div className="h-4 bg-[#f0f0f3] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}/board`}>
                <div className="group bg-white rounded-xl border border-[#e4e4e7] p-6 hover:border-[#c0c0c8] hover:shadow-elevated-lg transition-all duration-200 cursor-pointer">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-[15px] font-semibold text-[#0a0a0a] tracking-[-0.01em] group-hover:text-[#5b5bd6] transition-colors">
                      {project.name}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-[#c0c0c8] group-hover:text-[#5b5bd6] group-hover:translate-x-0.5 transition-all" />
                  </div>

                  {project.description && (
                    <p className="text-[13px] text-[#6e6e80] leading-relaxed line-clamp-2 mb-4">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-[#f0f0f3]">
                    <div className="flex gap-4 text-[12px] text-[#6e6e80]">
                      <span className="flex items-center gap-1.5">
                        <CheckSquare className="w-3 h-3 text-[#5b5bd6]" />
                        {project._count.tasks}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-[#5b5bd6]" />
                        {project._count.epics}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Lightbulb className="w-3 h-3 text-[#5b5bd6]" />
                        {project._count.ideas}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#a0a0a8]">
                      {getRelativeTime(project.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f0f0f3] flex items-center justify-center mb-5">
              <FolderPlus className="w-7 h-7 text-[#6e6e80]" />
            </div>
            <h2 className="text-[17px] font-semibold text-[#0a0a0a] mb-1.5 tracking-[-0.01em]">
              No projects yet
            </h2>
            <p className="text-[14px] text-[#6e6e80] mb-6 max-w-sm leading-relaxed">
              Create your first project to start managing tasks with AI.
            </p>
            <Button onClick={() => router.push("/projects/new")} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
