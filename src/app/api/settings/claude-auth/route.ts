import { NextRequest, NextResponse } from "next/server";
import { execSync, spawn, ChildProcess } from "child_process";
import { prisma } from "@/lib/db";
import { existsSync } from "fs";
import { join } from "path";

// Use globalThis to survive Next.js hot reloads
const g = globalThis as unknown as {
  __claudeAuthChild?: ChildProcess | null;
};

function log(...args: unknown[]) {
  console.log(`[claude-auth ${new Date().toISOString().slice(11, 23)}]`, ...args);
}

// GET - check current auth status
export async function GET() {
  try {
    const binary = await getClaudeBinary();
    const status = getAuthStatusSync(binary);
    log("GET status:", status.loggedIn ? "logged in" : "not logged in");
    return NextResponse.json(status);
  } catch {
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

    // LOGOUT
    if (action === "logout") {
      log("logging out...");
      killActive();
      try {
        execSync(`${binary} auth logout 2>&1`, { encoding: "utf-8", timeout: 10000 });
      } catch { /* ok */ }
      return NextResponse.json({ success: true, message: "Logged out" });
    }

    // CANCEL
    if (action === "cancel") {
      log("cancelling");
      killActive();
      return NextResponse.json({ success: true });
    }

    // CHECK
    if (action === "check") {
      const status = getAuthStatusSync(binary);
      log("check:", status.loggedIn);
      return NextResponse.json(status);
    }

    // LOGIN — spawn claude auth login, it polls server automatically
    // No code paste needed — claude detects browser auth completion via polling
    if (action === "login") {
      log("=== LOGIN START ===");
      killActive();

      const scriptPath = join(process.cwd(), "scripts", "claude-auth-pty.py");
      log("script:", scriptPath, "exists:", existsSync(scriptPath));

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const send = (data: Record<string, unknown>) => {
            log("SSE →", data.type);
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch { /* closed */ }
          };

          const child = spawn("python3", [scriptPath, binary], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env },
          });
          g.__claudeAuthChild = child;
          log("spawned pid:", child.pid);

          child.stdout?.on("data", (data: Buffer) => {
            const text = data.toString().trim();
            for (const line of text.split("\n")) {
              const t = line.trim();
              if (!t) continue;
              if (t.startsWith("URL:")) {
                log("auth URL captured");
                send({ type: "auth_url", url: t.slice(4) });
              } else if (t === "LOGIN_SUCCESS" || t === "LOGIN_DONE") {
                log(t, "— checking auth status...");
                const status = getAuthStatusSync(binary);
                log("auth status:", status.loggedIn);
                send({
                  type: "done",
                  success: status.loggedIn,
                  message: status.loggedIn
                    ? "Successfully authenticated!"
                    : "Login process completed.",
                  account: status,
                });
              } else if (t.startsWith("ERROR:")) {
                log("error:", t.slice(6));
                send({ type: "error", message: t.slice(6) });
              } else if (t.startsWith("DEBUG:")) {
                log("py:", t.slice(6));
              }
            }
          });

          child.stderr?.on("data", (data: Buffer) => {
            log("stderr:", data.toString().trim());
          });

          child.on("close", (exitCode) => {
            log("process exited:", exitCode);
            g.__claudeAuthChild = null;
            const status = getAuthStatusSync(binary);
            if (status.loggedIn) {
              send({ type: "done", success: true, message: "Authenticated!", account: status });
            }
            try { controller.close(); } catch { /* ok */ }
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

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    log("error:", error);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}

function killActive() {
  const child = g.__claudeAuthChild;
  if (child && !child.killed) {
    try { child.kill("SIGTERM"); } catch { /* ok */ }
  }
  g.__claudeAuthChild = null;
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
