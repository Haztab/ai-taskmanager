# TaskFlow AI — Product Requirements Document

## Vision & Problem Statement

Manual project planning is tedious and error-prone. Developers spend significant time breaking down features into tasks, writing user stories, estimating effort, and organizing work — before writing a single line of code. AI can accelerate the full lifecycle from ideation to implementation, letting developers focus on building instead of planning.

TaskFlow AI brings Claude into every stage of the project management workflow: brainstorming features, structuring work, and executing code — all within a unified local-first interface.

## Target Users

- **Solo developers** building side projects or MVPs who want AI-assisted planning and execution
- **Small teams** (2-5 engineers) who need lightweight project management without heavyweight tools
- **Developers exploring AI-assisted workflows** who want to experiment with Claude-driven ideation, task breakdown, and code generation

## Core User Journey

1. **Create a project** — Name it, add a description, optionally link a git repository
2. **Generate ideas** — Claude produces 10-15 categorized feature ideas based on the project description
3. **Promote ideas to epics** — Select an idea and Claude breaks it into an epic with 3-8 structured tasks (user stories, acceptance criteria, effort estimates, workstream assignments)
4. **Manage on the Kanban board** — Drag tasks across columns, filter by workstream, reorder priorities
5. **Execute with Claude Code** — Open a task, run Claude Code CLI with plan-first execution and streaming terminal output

## Feature Requirements

### 1. Project Management

- Create, read, update, and delete projects
- Each project has a name, description, and optional repository path
- Auto-created workstreams per project: Frontend, Backend, Mobile, Dashboard, Database
- Project-scoped navigation (board, ideas, settings)

### 2. AI Idea Generation

- User provides a project description; Claude generates 10-15 feature ideas via streaming response
- Each idea has a title, description, and category
- 7 categories: Core, Enhancement, UX, Performance, Security, Analytics, Integration
- Ideas are saved to the database and displayed as cards
- Ideas can be deleted or promoted to epics

### 3. Idea Promotion

- Select an idea to promote; Claude generates a structured epic with tasks
- Each generated task includes:
  - Title and description
  - User story ("As a [role], I want [feature] so that [benefit]")
  - Acceptance criteria (array of testable conditions)
  - Estimated effort (XS, S, M, L, XL)
  - Workstream assignment (one of the project's workstreams)
- 3-8 tasks generated per promotion
- The originating idea is marked as promoted and linked to the epic

### 4. Kanban Board

- 5 columns: Backlog, To Do, In Progress, Review, Done
- Drag-and-drop reordering within and across columns (dnd-kit)
- Workstream filter tabs — view all tasks or filter by a specific workstream
- Task cards show title, priority badge, effort estimate, and dependency status
- Priority levels: Critical (1), High (2), Medium (3), Low (4)

### 5. Task Detail & Execution

- Full task detail view with editable fields
- Claude Code CLI execution with plan-first approach:
  1. Claude generates an execution plan
  2. User reviews the plan
  3. Claude executes the plan with streaming terminal output (xterm.js)
- Session tracking: each execution creates a `ClaudeSession` record with prompt, plan, output, status, and token counts
- Task status auto-updates based on execution progress

### 6. Token Usage Dashboard

- Daily token limit enforcement (configurable, default 5M tokens)
- Per-source breakdown: API tokens (idea generation, promotion) vs CLI tokens (Claude Code execution)
- Recent sessions list with token counts
- Sidebar widget showing current daily usage at a glance

### 7. Settings & Authentication

- Anthropic API key configuration (stored locally in SQLite)
- OAuth 2.0 PKCE flow for Claude authentication (browser-based, no CLI interaction needed)
- Model selection: Claude Sonnet, Opus, or Haiku
- Configurable daily token limits
- Custom Claude Code CLI path and arguments
- Connection test endpoint to verify API key validity

### 8. Git Integration

- Auto-create git worktrees per task for isolated development
- Task-based branch naming derived from task title
- Worktree path tracking on the task record
- API endpoint for worktree creation and management

## Data Models

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **Project** | name, description, repoPath | Top-level container |
| **Workstream** | name, slug, color, projectId | Task categorization (unique per project) |
| **Idea** | title, description, category, isPromoted, projectId, epicId | AI-generated feature ideas |
| **Epic** | title, description, projectId | Groups related tasks from a promoted idea |
| **Task** | title, description, userStory, acceptanceCriteria, status, priority, estimatedEffort, sortOrder, branchName, worktreePath, projectId, epicId, workstreamId | Unit of work |
| **TaskDependency** | dependentId, dependencyId | Blocking relationship between tasks |
| **ClaudeSession** | taskId, prompt, plan, output, status, inputTokens, outputTokens | Record of a Claude Code execution |
| **TokenUsage** | source, inputTokens, outputTokens, model, sessionId, projectId | Per-request token accounting |
| **AppSettings** | anthropicApiKey, claudeCodeModel, dailyTokenLimit, OAuth fields | Singleton app configuration |

## API Surface

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:id` | Get project details |
| PATCH | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |

### Ideas
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ideas?projectId=` | List ideas for a project |
| POST | `/api/ideas` | Create an idea |
| POST | `/api/ideas/generate` | AI-generate ideas (streaming) |
| PATCH | `/api/ideas/:id` | Update an idea |
| DELETE | `/api/ideas/:id` | Delete an idea |

### Epics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/epics?projectId=` | List epics for a project |
| POST | `/api/epics` | Create an epic |
| GET | `/api/epics/:id` | Get epic details |
| DELETE | `/api/epics/:id` | Delete an epic |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks?projectId=` | List tasks for a project |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| POST | `/api/tasks/:id/execute` | Execute task with Claude Code |
| POST | `/api/tasks/reorder` | Reorder tasks (drag-and-drop) |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate-tasks` | Generate tasks from a description |
| POST | `/api/ai/promote-idea` | Promote idea to epic + tasks |
| POST | `/api/ai/refine-task` | Refine a task's description and criteria |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get app settings |
| PATCH | `/api/settings` | Update app settings |
| POST | `/api/settings/claude-auth` | Handle Claude OAuth flow |
| POST | `/api/settings/test-connection` | Test Anthropic API key |

### Usage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/usage` | Get token usage summary |
| GET | `/api/usage/sessions` | List recent Claude sessions |

### Git
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/worktree` | Create a git worktree for a task |

## Non-Functional Requirements

- **Local-first** — All data stored in SQLite via Prisma; no external database required
- **Streaming UX** — AI responses stream to the UI in real-time (idea generation, task execution)
- **Plan-first execution** — Claude Code always generates a plan before executing, ensuring safe and reviewable actions
- **Token budgeting** — Daily token limits prevent runaway costs; usage tracked per request and per session
- **No secrets in code** — API keys stored in the database, not in environment variables (env vars supported as fallback)

## Future Roadmap

- **Team collaboration** — Multi-user support with role-based access
- **GitHub/GitLab PR integration** — Auto-create PRs from completed tasks, link to issues
- **Analytics dashboards** — Velocity charts, burndown, workstream utilization
- **Task auto-prioritization** — AI-suggested priority ordering based on dependencies and business value
- **Multi-project dependencies** — Cross-project task relationships
- **Notification system** — Alerts for blocked tasks, token limit warnings, execution completions
- **Mobile-responsive UI** — Full mobile support for on-the-go task management
- **Export/Import** — Backup and restore projects as JSON or integrate with external tools
