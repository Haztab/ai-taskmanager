"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Header } from "@/components/layout/header";
import { toast } from "sonner";

interface CreateProjectPayload {
  name: string;
  description: string;
  repoPath: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [repoPath, setRepoPath] = useState("");

  const createProject = useMutation({
    mutationFn: async (payload: CreateProjectPayload) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to create project" }));
        throw new Error(error.message || "Failed to create project");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Project created successfully");
      router.push(`/projects/${data.id}/ideas`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    createProject.mutate({ name: name.trim(), description: description.trim(), repoPath: repoPath.trim() });
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="New Project"
        breadcrumbs={[
          { label: "Projects", href: "/" },
          { label: "New Project" },
        ]}
      />

      <div className="flex-1 p-6 flex items-start justify-center">
        <Card className="w-full max-w-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Create a New Project</CardTitle>
              <CardDescription>
                Set up a new project to start generating ideas and managing tasks with AI.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="My Awesome Project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project, its goals, and what you want to build..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  A good description helps the AI generate better ideas and tasks.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="repoPath">Repository Path</Label>
                <Input
                  id="repoPath"
                  placeholder="/Users/you/projects/my-repo"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Absolute path to your local git repository. Used for worktree management.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
