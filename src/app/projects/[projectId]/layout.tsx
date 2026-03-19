"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, LayoutDashboard, Settings, ChevronRight } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  repoPath: string;
}

const subNavItems = [
  { segment: "ideas", label: "Ideas", icon: Lightbulb },
  { segment: "board", label: "Board", icon: LayoutDashboard },
  { segment: "settings", label: "Settings", icon: Settings },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const projectId = params.projectId;

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-[#e4e4e7] px-8 pt-5 pb-0">
        <div className="mb-4">
          <div className="flex items-center gap-1 text-[13px] text-[#6e6e80] mb-1">
            <Link href="/" className="hover:text-[#0a0a0a] transition-colors">
              Projects
            </Link>
            <ChevronRight className="w-3 h-3 text-[#c0c0c8]" />
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32 align-middle" />
            ) : (
              <span className="text-[#0a0a0a] font-medium">
                {project?.name ?? "Unknown Project"}
              </span>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-[-0.02em]">
              {project?.name ?? "Project"}
            </h1>
          )}
        </div>

        <nav className="flex gap-1 -mb-px">
          {subNavItems.map((item) => {
            const href = `/projects/${projectId}/${item.segment}`;
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.segment}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-[#5b5bd6] text-[#0a0a0a]"
                    : "border-transparent text-[#6e6e80] hover:text-[#0a0a0a] hover:border-[#c0c0c8]"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
