import { NextRequest, NextResponse } from "next/server";
import { execSync, spawn, ChildProcess } from "child_process";
import { prisma } from "@/lib/db";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Use globalThis to survive Next.js hot reloads
const g = globalThis as unknown as {
  __claudeAuthChild?: ChildProcess | null;
  __claudeAuthCodeFile?: string | null;
};

function log(...args: unknown[]) {
  console.log(`[claude-auth ${new Date().toISOString().slice(11, 23)}]`, ...args);
}

// GET - check current auth status
export async function GET() {
  try {
    const binary = await getClaudeBinary();
    log("GET /claude-auth — checking status with binary:", binary);
    const status = getAuthStatusSync(binary);
    log("GET result:", JSON.stringify(status));
    return NextResponse.json(status);
  } catch (err) {
    log("GET error:", err);
    return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  }
}

// POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    log("POST action:", action);
    const binary = await getClaudeBinary();
    log("binary:", binary);

    // LOGOUT
    if (action === "logout") {
      log("logging out...");
      killActive();
      try {
        const out = execSync(`${binary} auth logout 2>&1`, { encoding: "utf-8", timeout: 10000 });
        log("logout output:", out.trim());
      } catch (err) {
        log("logout error (ok):", err instanceof Error ? err.message : err);
      }
      return NextResponse.json({ success: true, message: "Logged out" });
    }

    // CANCEL
    if (action === "cancel") {
      log("cancelling active login");
      killActive();
      return NextResponse.json({ success: true });
    }

    // SEND_CODE
    if (action === "send_code") {
      const { code } = body;
      log("send_code called, code length:", code?.length, "code preview:", code?.slice(0, 15) + "...");
      if (!code) {
        log("ERROR: no code provided");
        return NextResponse.json({ error: "No code provided" }, { status: 400 });
      }
      const codeFile = g.__claudeAuthCodeFile;
      log("codeFile from globalThis:", codeFile);
      log("child alive:", !!(g.__claudeAuthChild && !g.__claudeAuthChild.killed));
      if (!codeFile) {
        log("ERROR: no active login session (codeFile is null)");
        return NextResponse.json({ error: "No active login session" }, { status: 400 });
      }
      try {
        const cleanCode = code.trim().replace(/#$/, "");
        log("writing clean code to file, length:", cleanCode.length, "file:", codeFile);
        writeFileSync(codeFile, cleanCode);
        log("wrote code successfully, verifying file exists:", existsSync(codeFile));
        return NextResponse.json({ success: true });
      } catch (err) {
        log("ERROR writing code:", err);
        return NextResponse.json({ error: "Failed to send code" }, { status: 500 });
      }
    }

    // CHECK
    if (action === "check") {
      const status = getAuthStatusSync(binary);
      log("check result:", JSON.stringify(status));
      return NextResponse.json(status);
    }

    // LOGIN
    if (action === "login") {
      log("=== LOGIN START ===");
      killActive();

      const codeFilePath = join(tmpdir(), `claude-auth-code-${Date.now()}.txt`);
      g.__claudeAuthCodeFile = codeFilePath;
      log("code file path:", codeFilePath);

      const scriptPath = join(process.cwd(), "scripts", "claude-auth-pty.py");
      log("python script:", scriptPath, "exists:", existsSync(scriptPath));
      log("spawning: python3", scriptPath, binary, codeFilePath);

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (data: Record<string, unknown>) => {
            log("SSE →", JSON.stringify(data));
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch { /* closed */ }
          };

          const child = spawn("python3", [scriptPath, binary, codeFilePath], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env },
          });
          g.__claudeAuthChild = child;
          log("python spawned, pid:", child.pid);

          child.stdout?.on("data", (data: Buffer) => {
            const text = data.toString().trim();
            log("stdout:", text);

            for (const line of text.split("\n")) {
              const t = line.trim();
              if (!t) continue;
              if (t.startsWith("URL:")) {
                const url = t.slice(4);
                log("captured auth URL, length:", url.length);
                send({ type: "auth_url", url });
              } else if (t === "NEEDS_CODE") {
                log("claude is waiting for auth code");
                send({ type: "needs_code" });
              } else if (t === "CODE_SENT") {
                log("code was written to PTY stdin");
                send({ type: "code_sent" });
              } else if (t === "LOGIN_SUCCESS") {
                log("LOGIN_SUCCESS detected!");
                const status = getAuthStatusSync(binary);
                log("auth status after success:", JSON.stringify(status));
                send({
                  type: "done",
                  success: status.loggedIn,
                  message: status.loggedIn
                    ? "Successfully authenticated!"
                    : "Login process completed.",
                  account: status,
                });
              } else if (t === "LOGIN_DONE") {
                log("LOGIN_DONE — process finished");
                const status = getAuthStatusSync(binary);
                log("auth status after done:", JSON.stringify(status));
                send({
                  type: "done",
                  success: status.loggedIn,
                  message: status.loggedIn
                    ? "Successfully authenticated!"
                    : "Login process completed.",
                  account: status,
                });
              } else if (t.startsWith("ERROR:")) {
                log("ERROR from python:", t.slice(6));
                send({ type: "error", message: t.slice(6) });
              } else {
                log("unhandled stdout line:", t);
              }
            }
          });

          child.stderr?.on("data", (data: Buffer) => {
            log("stderr:", data.toString().trim());
          });

          child.on("close", (exitCode, signal) => {
            log("python process closed, exitCode:", exitCode, "signal:", signal);
            g.__claudeAuthChild = null;
            g.__claudeAuthCodeFile = null;
            const status = getAuthStatusSync(binary);
            log("final auth status:", JSON.stringify(status));
            if (status.loggedIn) {
              send({ type: "done", success: true, message: "Authenticated!", account: status });
            }
            try { controller.close(); } catch { /* ok */ }
            try { unlinkSync(codeFilePath); } catch { /* ok */ }
          });

          child.on("error", (err) => {
            log("spawn error:", err.message);
            send({ type: "error", message: err.message });
            try { controller.close(); } catch { /* ok */ }
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    log("unknown action:", action);
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    log("POST error:", error);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}

function killActive() {
  const child = g.__claudeAuthChild;
  log("killActive — child:", child?.pid, "killed:", child?.killed);
  if (child && !child.killed) {
    try { child.kill("SIGTERM"); } catch { /* ok */ }
  }
  g.__claudeAuthChild = null;
  const codeFile = g.__claudeAuthCodeFile;
  if (codeFile) {
    log("removing code file:", codeFile);
    try { unlinkSync(codeFile); } catch { /* ok */ }
  }
  g.__claudeAuthCodeFile = null;
}

async function getClaudeBinary(): Promise<string> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  const binary = settings?.claudeCodePath || "claude";
  try {
    return execSync(`which ${binary} 2>/dev/null`, { encoding: "utf-8", timeout: 3000 }).trim();
  } catch {
    return binary;
  }
}

function getAuthStatusSync(binary: string) {
  try {
    const output = execSync(`${binary} auth status 2>&1`, {
      encoding: "utf-8", timeout: 10000,
    }).trim();
    const data = JSON.parse(output);
    return {
      loggedIn: data.loggedIn === true,
      email: data.email || null,
      plan: data.subscriptionType
        ? data.subscriptionType.charAt(0).toUpperCase() + data.subscriptionType.slice(1)
        : null,
      orgId: data.orgId || null,
      orgName: data.orgName || null,
      authMethod: data.authMethod || null,
      subscriptionType: data.subscriptionType || null,
      apiProvider: data.apiProvider || null,
    };
  } catch {
    return {
      loggedIn: false, email: null, plan: null, orgId: null,
      orgName: null, authMethod: null, subscriptionType: null, apiProvider: null,
    };
  }
}
