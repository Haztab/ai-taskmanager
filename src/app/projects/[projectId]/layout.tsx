"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface Project {
  id: string;
  name: string;
  description: string;
  repoPath: string;
}

const subNavItems = [
  { segment: "ideas", label: "Ideas", icon: "💡" },
  { segment: "board", label: "Board", icon: "📋" },
  { segment: "settings", label: "Settings", icon: "⚙️" },
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
      {/* Project header with sub-navigation */}
      <div className="border-b bg-card px-6 pt-4 pb-0">
        <div className="mb-3">
          <div className="text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground">
              Projects
            </Link>
            <span className="mx-2">/</span>
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32 align-middle" />
            ) : (
              <span className="text-foreground font-medium">
                {project?.name ?? "Unknown Project"}
              </span>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <h1 className="text-2xl font-bold">{project?.name ?? "Project"}</h1>
          )}
        </div>

        <nav className="flex gap-1">
          {subNavItems.map((item) => {
            const href = `/projects/${projectId}/${item.segment}`;
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={item.segment}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary bg-accent/50"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30"
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
