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
import { Separator } from "@/components/ui/separator";
import { DEFAULT_WORKSTREAMS } from "@/types";

export default function SettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const dbMode = process.env.NEXT_PUBLIC_DB_MODE ?? "mock";

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Project configuration and preferences
        </p>
      </div>

      {/* Database Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Database Mode</CardTitle>
          <CardDescription>
            Current data storage mode for the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge
              variant={dbMode === "real" ? "default" : "secondary"}
              className="text-sm"
            >
              {dbMode === "real" ? "Production (SQLite)" : "Mock (In-Memory)"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {dbMode === "real"
                ? "Using SQLite database for persistent storage."
                : "Using in-memory mock data. Data will reset on restart."}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Project ID */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Information</CardTitle>
          <CardDescription>Internal project identifiers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-medium">
                Project ID:
              </span>
              <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                {projectId}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Workstreams */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workstreams</CardTitle>
          <CardDescription>
            Team workstreams used for task organization and filtering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DEFAULT_WORKSTREAMS.map((ws) => (
              <div
                key={ws.slug}
                className="flex items-center gap-3 py-2 px-3 rounded-md border"
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: ws.color }}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium">{ws.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({ws.slug})
                  </span>
                </div>
                <div
                  className="text-xs font-mono text-muted-foreground"
                  style={{ color: ws.color }}
                >
                  {ws.color}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
