import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.create({
    data: {
      name: "E-Commerce Platform",
      description:
        "A modern e-commerce platform with real-time inventory, AI recommendations, and multi-vendor support.",
      repoPath: process.cwd(),
    },
  });

  const workstreams = await Promise.all([
    prisma.workstream.create({
      data: { name: "Frontend", slug: "fe", color: "#3B82F6", projectId: project.id },
    }),
    prisma.workstream.create({
      data: { name: "Backend", slug: "be", color: "#10B981", projectId: project.id },
    }),
    prisma.workstream.create({
      data: { name: "Mobile", slug: "mobile", color: "#8B5CF6", projectId: project.id },
    }),
    prisma.workstream.create({
      data: { name: "Dashboard", slug: "dashboard", color: "#F59E0B", projectId: project.id },
    }),
    prisma.workstream.create({
      data: { name: "Database", slug: "db", color: "#EF4444", projectId: project.id },
    }),
  ]);

  const epic = await prisma.epic.create({
    data: {
      title: "User Authentication System",
      description: "Complete authentication flow with OAuth, MFA, and session management",
      projectId: project.id,
    },
  });

  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: "Design login/signup UI",
        description: "Create responsive login and signup forms with social auth buttons",
        userStory: "As a user, I want a clean login page so I can easily access my account",
        acceptanceCriteria: JSON.stringify([
          "Login form with email/password",
          "Signup form with validation",
          "Social auth buttons (Google, GitHub)",
          "Responsive on mobile",
        ]),
        status: "todo",
        priority: 2,
        estimatedEffort: "M",
        sortOrder: 0,
        projectId: project.id,
        epicId: epic.id,
        workstreamId: workstreams[0].id,
      },
    }),
    prisma.task.create({
      data: {
        title: "Implement JWT auth endpoints",
        description: "Create REST endpoints for login, signup, refresh token, and logout",
        userStory: "As a developer, I want secure auth endpoints so the frontend can authenticate users",
        acceptanceCriteria: JSON.stringify([
          "POST /auth/login returns JWT",
          "POST /auth/signup creates user",
          "POST /auth/refresh rotates tokens",
          "POST /auth/logout invalidates session",
        ]),
        status: "in_progress",
        priority: 1,
        estimatedEffort: "L",
        sortOrder: 0,
        projectId: project.id,
        epicId: epic.id,
        workstreamId: workstreams[1].id,
      },
    }),
    prisma.task.create({
      data: {
        title: "Set up user table and migrations",
        description: "Create database schema for users, sessions, and OAuth providers",
        status: "done",
        priority: 1,
        estimatedEffort: "S",
        sortOrder: 0,
        projectId: project.id,
        epicId: epic.id,
        workstreamId: workstreams[4].id,
      },
    }),
    prisma.task.create({
      data: {
        title: "Add product search with filters",
        description: "Implement search functionality with category, price, and rating filters",
        status: "backlog",
        priority: 3,
        estimatedEffort: "L",
        sortOrder: 0,
        projectId: project.id,
        workstreamId: workstreams[0].id,
      },
    }),
    prisma.task.create({
      data: {
        title: "Shopping cart API",
        description: "CRUD endpoints for shopping cart with inventory validation",
        status: "todo",
        priority: 2,
        estimatedEffort: "M",
        sortOrder: 1,
        projectId: project.id,
        workstreamId: workstreams[1].id,
      },
    }),
    prisma.task.create({
      data: {
        title: "Mobile product listing screen",
        description: "React Native screen for browsing products with infinite scroll",
        status: "backlog",
        priority: 3,
        estimatedEffort: "M",
        sortOrder: 1,
        projectId: project.id,
        workstreamId: workstreams[2].id,
      },
    }),
  ]);

  await prisma.taskDependency.create({
    data: {
      dependentId: tasks[0].id,
      dependencyId: tasks[2].id,
    },
  });

  await Promise.all([
    prisma.idea.create({
      data: {
        title: "AI-Powered Product Recommendations",
        description: "Use machine learning to suggest products based on browsing history and purchase patterns.",
        category: "Enhancement",
        projectId: project.id,
      },
    }),
    prisma.idea.create({
      data: {
        title: "Real-time Inventory Tracking",
        description: "WebSocket-based inventory updates so users see live stock levels.",
        category: "Core",
        projectId: project.id,
      },
    }),
    prisma.idea.create({
      data: {
        title: "Multi-vendor Marketplace",
        description: "Allow third-party sellers to list products with their own storefronts.",
        category: "Core",
        projectId: project.id,
      },
    }),
  ]);

  console.log("Seed complete!");
  console.log(`Created project: ${project.name} (${project.id})`);
  console.log(`Created ${workstreams.length} workstreams`);
  console.log(`Created ${tasks.length} tasks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
