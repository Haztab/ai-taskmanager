"use client";

import { cn } from "@/lib/utils";

interface Workstream {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface WorkstreamTabsProps {
  workstreams: Workstream[];
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
}

export function WorkstreamTabs({
  workstreams,
  activeSlug,
  onSelect,
}: WorkstreamTabsProps) {
  return (
    <div className="flex items-center gap-1 px-4">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
          activeSlug === null
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        All
      </button>
      {workstreams.map((ws) => (
        <button
          key={ws.slug}
          onClick={() => onSelect(ws.slug)}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeSlug === ws.slug
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: ws.color }}
          />
          {ws.name}
        </button>
      ))}
    </div>
  );
}
