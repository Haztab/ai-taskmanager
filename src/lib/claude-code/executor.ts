import { spawn, ChildProcess } from "child_process";

export interface ClaudeExecutionOptions {
  prompt: string;
  cwd: string;
  onData: (data: string) => void;
  onError: (data: string) => void;
  onClose: (code: number | null) => void;
}

export interface PlanThenExecuteOptions {
  prompt: string;
  cwd: string;
  taskContext: {
    title: string;
    description?: string | null;
    acceptanceCriteria?: string | null;
  };
  onPlanData: (data: string) => void;
  onExecuteData: (data: string) => void;
  onError: (data: string) => void;
  onPlanComplete: (plan: string) => void;
  onClose: (code: number | null) => void;
}

const activeSessions = new Map<string, ChildProcess>();

export function executeClaudeCode(
  sessionId: string,
  options: ClaudeExecutionOptions
): void {
  const { prompt, cwd, onData, onError, onClose } = options;

  stopClaudeSession(sessionId);

  const child = spawn("claude", ["--print", prompt], {
    cwd,
    shell: true,
    env: { ...process.env },
  });

  activeSessions.set(sessionId, child);

  child.stdout?.on("data", (data: Buffer) => {
    onData(data.toString());
  });

  child.stderr?.on("data", (data: Buffer) => {
    onError(data.toString());
  });

  child.on("close", (code) => {
    activeSessions.delete(sessionId);
    onClose(code);
  });

  child.on("error", (err) => {
    activeSessions.delete(sessionId);
    onError(`Process error: ${err.message}`);
    onClose(1);
  });
}

export function planThenExecute(
  sessionId: string,
  options: PlanThenExecuteOptions
): void {
  const {
    prompt,
    cwd,
    taskContext,
    onPlanData,
    onExecuteData,
    onError,
    onPlanComplete,
    onClose,
  } = options;

  stopClaudeSession(sessionId);

  // Build a planning prompt that includes task context
  const planPrompt = buildPlanPrompt(prompt, taskContext);

  // Phase 1: Generate plan using --print (read-only, no changes)
  const planChild = spawn("claude", ["--print", planPrompt], {
    cwd,
    shell: true,
    env: { ...process.env },
  });

  activeSessions.set(sessionId, planChild);
  let planOutput = "";

  planChild.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    planOutput += text;
    onPlanData(text);
  });

  planChild.stderr?.on("data", (data: Buffer) => {
    onError(data.toString());
  });

  planChild.on("close", (planCode) => {
    activeSessions.delete(sessionId);

    if (planCode !== 0 || !planOutput.trim()) {
      onError("Plan generation failed");
      onClose(planCode);
      return;
    }

    onPlanComplete(planOutput);

    // Phase 2: Execute the plan with --yes (auto-accept all tool use)
    const executePrompt = buildExecutePrompt(prompt, planOutput);
    const execChild = spawn(
      "claude",
      ["--print", "--verbose", executePrompt],
      {
        cwd,
        shell: true,
        env: { ...process.env },
      }
    );

    activeSessions.set(sessionId, execChild);

    execChild.stdout?.on("data", (data: Buffer) => {
      onExecuteData(data.toString());
    });

    execChild.stderr?.on("data", (data: Buffer) => {
      onError(data.toString());
    });

    execChild.on("close", (code) => {
      activeSessions.delete(sessionId);
      onClose(code);
    });

    execChild.on("error", (err) => {
      activeSessions.delete(sessionId);
      onError(`Execution error: ${err.message}`);
      onClose(1);
    });
  });

  planChild.on("error", (err) => {
    activeSessions.delete(sessionId);
    onError(`Plan error: ${err.message}`);
    onClose(1);
  });
}

function buildPlanPrompt(
  userPrompt: string,
  taskContext: PlanThenExecuteOptions["taskContext"]
): string {
  let ctx = `Task: ${taskContext.title}`;
  if (taskContext.description) ctx += `\nDescription: ${taskContext.description}`;
  if (taskContext.acceptanceCriteria) {
    try {
      const criteria = JSON.parse(taskContext.acceptanceCriteria);
      if (Array.isArray(criteria)) {
        ctx += `\nAcceptance Criteria:\n${criteria.map((c: string) => `- ${c}`).join("\n")}`;
      }
    } catch {
      ctx += `\nAcceptance Criteria: ${taskContext.acceptanceCriteria}`;
    }
  }

  return `You are planning an implementation. Do NOT make any changes yet - only create a detailed plan.

Context:
${ctx}

User request: ${userPrompt}

Create a step-by-step implementation plan. For each step, specify:
1. What file(s) to create or modify
2. What changes to make
3. Why this change is needed

Be specific and actionable. This plan will be executed automatically without confirmation.`;
}

function buildExecutePrompt(userPrompt: string, plan: string): string {
  return `Execute the following implementation plan. Do NOT ask for confirmation - proceed with all changes automatically.

Original request: ${userPrompt}

Plan to execute:
${plan}

Now implement all steps in the plan. Make all file changes needed. Do not skip any steps.`;
}

export function stopClaudeSession(sessionId: string): void {
  const proc = activeSessions.get(sessionId);
  if (proc) {
    proc.kill("SIGTERM");
    activeSessions.delete(sessionId);
  }
}
