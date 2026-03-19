"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_WORKSTREAMS } from "@/types";
import { Settings, Database, Hash, Layers } from "lucide-react";

export default function SettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const dbMode = process.env.NEXT_PUBLIC_DB_MODE ?? "mock";

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-gray-500/20 to-slate-500/20">
          <Settings className="h-6 w-6 text-gray-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Project configuration and preferences
          </p>
        </div>
      </div>

      {/* Database Mode */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">Database Mode</CardTitle>
              <CardDescription>
                Current data storage mode for the application
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                  dbMode === "real" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <Badge
                variant={dbMode === "real" ? "default" : "secondary"}
                className={
                  dbMode === "real"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                }
              >
                {dbMode === "real" ? "Production (SQLite)" : "Mock (In-Memory)"}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {dbMode === "real"
                ? "Using SQLite database for persistent storage."
                : "Using in-memory mock data. Data will reset on restart."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Project ID */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-purple-500/10">
              <Hash className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-base">Project Information</CardTitle>
              <CardDescription>Internal project identifiers</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">
                Project ID:
              </span>
              <code className="bg-muted px-2.5 py-1 rounded-md text-xs font-mono border">
                {projectId}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workstreams */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-indigo-500/10">
              <Layers className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <CardTitle className="text-base">Workstreams</CardTitle>
              <CardDescription>
                Team workstreams used for task organization and filtering
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {DEFAULT_WORKSTREAMS.map((ws) => (
              <div
                key={ws.slug}
                className="flex items-center gap-3 py-2.5 px-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
                  style={{ backgroundColor: ws.color }}
                >
                  {ws.name}
                </span>
                <span className="text-xs text-muted-foreground flex-1">
                  {ws.slug}
                </span>
                <code
                  className="text-xs font-mono px-2 py-0.5 rounded border bg-muted"
                  style={{ color: ws.color }}
                >
                  {ws.color}
                </code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
