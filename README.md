# TaskFlow AI

**AI-powered project management — from ideation to implementation.**

## Overview

TaskFlow AI is a local-first project management tool that integrates Claude AI into every stage of the development lifecycle. Generate feature ideas with AI, promote them into structured epics and tasks, manage work on a drag-and-drop Kanban board, and execute tasks directly through Claude Code CLI — all from a single interface.

## Features

- **AI Idea Generation** — Describe your project and Claude generates 10-15 categorized feature ideas
- **Idea Promotion** — Convert any idea into a full epic with 3-8 tasks, complete with user stories, acceptance criteria, and effort estimates
- **Kanban Board** — Drag-and-drop task management across 5 columns (Backlog, To Do, In Progress, Review, Done)
- **Workstream Filtering** — Organize tasks by workstream (Frontend, Backend, Mobile, Dashboard, Database)
- **Task Execution** — Execute tasks via Claude Code CLI with plan-first approach and streaming terminal output
- **Token Usage Tracking** — Monitor daily token consumption with per-source breakdown and budget limits
- **Dependency Management** — Define task dependencies with automatic blocking
- **Git Worktrees** — Auto-create isolated git worktrees per task with task-based branch naming
- **OAuth 2.0 Authentication** — Direct PKCE flow for Claude API access
- **Settings Management** — Configure API keys, model selection (Sonnet/Opus/Haiku), and daily token limits

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 |
| UI | React 19, shadcn/ui, Tailwind CSS 4 |
| State | TanStack Query v5 |
| Database | Prisma + SQLite |
| AI | Anthropic SDK |
| Terminal | xterm.js, node-pty |
| Drag & Drop | dnd-kit |
| Icons | Lucide React |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Git

### Installation

```bash
# Clone the repository
git clone <repo-url> ai-taskmanager
cd ai-taskmanager

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see below)

# Run database migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `ANTHROPIC_API_KEY` | Anthropic API key (or configure via Settings UI) | — |
| `CLAUDE_MAX_DAILY_TOKENS` | Daily token budget | `5000000` |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ai/                  # AI endpoints (generate-tasks, promote-idea, refine-task)
│   │   ├── epics/               # Epic CRUD
│   │   ├── ideas/               # Idea CRUD + generation
│   │   ├── projects/            # Project CRUD
│   │   ├── settings/            # App settings + Claude auth
│   │   ├── tasks/               # Task CRUD + reorder + execute
│   │   ├── usage/               # Token usage + sessions
│   │   └── worktree/            # Git worktree management
│   ├── projects/
│   │   └── [projectId]/
│   │       ├── board/           # Kanban board page
│   │       ├── ideas/           # Ideas page
│   │       ├── settings/        # Project settings
│   │       └── tasks/[taskId]/  # Task detail + execution
│   ├── settings/                # Global settings page
│   └── usage/                   # Token usage dashboard
├── components/
│   ├── board/                   # Kanban board, columns, task cards
│   ├── ideas/                   # Idea cards
│   ├── layout/                  # Header, sidebar, workstream tabs
│   ├── terminal/                # Claude terminal + auth terminal
│   └── ui/                      # shadcn/ui primitives
├── hooks/                       # Custom React hooks
├── lib/
│   ├── ai/                      # Claude client + prompt templates
│   ├── claude-code/             # Claude Code CLI integration
│   ├── git/                     # Git worktree utilities
│   ├── db.ts                    # Prisma client
│   └── utils.ts                 # Shared utilities
└── types/                       # TypeScript types and constants
prisma/
├── schema.prisma                # Database schema (9 models)
└── seed.ts                      # Database seed script
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Next.js dev server |
| `build` | `npm run build` | Production build |
| `start` | `npm run start` | Start production server |
| `lint` | `npm run lint` | Run ESLint |
| `db:migrate` | `npm run db:migrate` | Run Prisma migrations |
| `db:seed` | `npm run db:seed` | Seed database with sample data |
| `db:reset` | `npm run db:reset` | Reset database (destructive) |
| `db:studio` | `npm run db:studio` | Open Prisma Studio GUI |
