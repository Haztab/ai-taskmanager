export const IDEA_GENERATION_PROMPT = `You are a senior product manager and software architect. Given a project description, generate 10-15 feature ideas that would make this project successful.

For each idea, provide:
- title: A concise feature name
- description: 2-3 sentences explaining the feature and its value
- category: One of: Core, Enhancement, UX, Performance, Security, Analytics, Integration

Return as a JSON array. Example format:
[{"title": "User Authentication", "description": "Implement secure login with OAuth2...", "category": "Core"}]

Project: {projectDescription}

Return ONLY the JSON array, no other text.`;

export const PROMOTE_IDEA_PROMPT = `You are a senior software architect. Given a feature idea, break it down into an epic with concrete development tasks and their dependencies.

Feature Idea:
Title: {ideaTitle}
Description: {ideaDescription}

Available workstreams: {workstreams}

Generate an epic with 3-8 tasks. Tasks are ordered by index (0, 1, 2, ...). For each task provide:
- title: Clear, actionable task name
- description: What needs to be implemented
- userStory: "As a [role], I want [feature] so that [benefit]"
- acceptanceCriteria: Array of testable criteria
- estimatedEffort: One of XS, S, M, L, XL
- workstream: One of the available workstream slugs
- priority: 1 (critical), 2 (high), 3 (medium), or 4 (low)
- dependsOn: Array of task indexes (0-based) that must be completed before this task can start. Use [] for tasks with no dependencies. Foundational tasks should come first with no dependencies.

Example: if task at index 2 depends on tasks at index 0 and 1, set "dependsOn": [0, 1]

Return as JSON:
{
  "epic": { "title": "...", "description": "..." },
  "tasks": [...]
}

Return ONLY the JSON, no other text.`;

export const REFINE_TASK_PROMPT = `You are a senior developer. Improve this task's description, add or refine acceptance criteria, and suggest a user story if missing.

Current task:
Title: {title}
Description: {description}
User Story: {userStory}
Acceptance Criteria: {acceptanceCriteria}

Return as JSON:
{
  "description": "improved description",
  "userStory": "improved or new user story",
  "acceptanceCriteria": ["criterion 1", "criterion 2", ...]
}

Return ONLY the JSON, no other text.`;

export const GENERATE_TASKS_PROMPT = `You are a senior software architect. Given a description of work needed, generate concrete development tasks.

Description: {description}

Available workstreams: {workstreams}

Generate 3-8 tasks. For each task provide:
- title: Clear, actionable task name
- description: What needs to be implemented
- userStory: "As a [role], I want [feature] so that [benefit]"
- acceptanceCriteria: Array of testable criteria
- estimatedEffort: One of XS, S, M, L, XL
- workstream: One of the available workstream slugs
- priority: 1 (critical), 2 (high), 3 (medium), or 4 (low)

Return as JSON array. Return ONLY the JSON array, no other text.`;

export const PRIORITIZE_TASKS_PROMPT = `You are a senior engineering manager. Given a list of tasks with their dependencies, suggest a priority ordering.

Tasks:
{tasks}

Consider:
1. Dependencies (blocked tasks should be lower priority)
2. Business value
3. Technical risk
4. Effort vs impact

Return as JSON array of objects with taskId and suggestedPriority (1-4):
[{"taskId": "...", "suggestedPriority": 1}]

Return ONLY the JSON array, no other text.`;
