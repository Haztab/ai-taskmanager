import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

async function getOrCreateSettings() {
  let settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    settings = await prisma.appSettings.create({
      data: { id: "singleton" },
    });
  }
  return settings;
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    const hasDbKey = !!settings.anthropicApiKey;
    const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;
    const activeKey = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

    // Check Claude Code CLI
    const cliInfo = await getClaudeCodeInfo(settings.claudeCodePath);

    return NextResponse.json({
      dbMode: settings.dbMode,
      claudeCodeModel: settings.claudeCodeModel,
      dailyTokenLimit: settings.dailyTokenLimit,
      claudeCodePath: settings.claudeCodePath,
      claudeCodeArgs: settings.claudeCodeArgs,
      // API Key
      anthropicKeySet: !!activeKey,
      anthropicKeySource: hasDbKey ? "dashboard" : hasEnvKey ? "env" : null,
      anthropicKeyPreview: activeKey ? `sk-ant-...${activeKey.slice(-6)}` : null,
      // CLI
      claudeCodeInstalled: cliInfo.available,
      claudeCodeAvailable: cliInfo.available && !!(cliInfo.account?.hasProFeatures),
      claudeCodeLoggedIn: !!(cliInfo.account?.hasProFeatures),
      claudeCodeVersion: cliInfo.version,
      claudeCodeBinaryPath: cliInfo.binaryPath,
      claudeCodeNodeVersion: cliInfo.nodeVersion,
      claudeCodePlatform: cliInfo.platform,
      claudeCodeAccount: cliInfo.account,
      // DB
      databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
    });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.dbMode !== undefined) data.dbMode = body.dbMode;
    if (body.claudeCodeModel !== undefined) data.claudeCodeModel = body.claudeCodeModel;
    if (body.dailyTokenLimit !== undefined) data.dailyTokenLimit = body.dailyTokenLimit;
    if (body.anthropicApiKey !== undefined) data.anthropicApiKey = body.anthropicApiKey || null;
    if (body.claudeCodePath !== undefined) data.claudeCodePath = body.claudeCodePath || null;
    if (body.claudeCodeArgs !== undefined) data.claudeCodeArgs = body.claudeCodeArgs || null;

    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    return NextResponse.json({
      success: true,
      anthropicKeySet: !!settings.anthropicApiKey || !!process.env.ANTHROPIC_API_KEY,
      anthropicKeySource: settings.anthropicApiKey ? "dashboard" : process.env.ANTHROPIC_API_KEY ? "env" : null,
      anthropicKeyPreview: (settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY)
        ? `sk-ant-...${(settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY)!.slice(-6)}`
        : null,
    });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

interface ClaudeCodeAccount {
  email: string | null;
  plan: string | null;
  orgId: string | null;
  orgName: string | null;
  userId: string | null;
  maxModel: string | null;
  hasProFeatures: boolean;
  configDir: string | null;
  authMethod: string | null;
  subscriptionType: string | null;
  apiProvider: string | null;
}

interface ClaudeCodeInfo {
  available: boolean;
  version: string | null;
  binaryPath: string | null;
  nodeVersion: string | null;
  platform: string | null;
  account: ClaudeCodeAccount | null;
}

async function getClaudeCodeInfo(customPath?: string | null): Promise<ClaudeCodeInfo> {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const binary = customPath || "claude";
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const empty: ClaudeCodeInfo = {
    available: false,
    version: null,
    binaryPath: null,
    nodeVersion: null,
    platform: null,
    account: null,
  };

  try {
    // 1. Find binary
    const binaryPath = execSync(`which ${binary} 2>/dev/null || echo ""`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    if (!binaryPath) return empty;

    // 2. Version
    let version: string | null = null;
    try {
      version = execSync(`${binaryPath} --version 2>&1`, {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
    } catch { /* ignore */ }

    // 3. Node version
    let nodeVersion: string | null = null;
    try {
      nodeVersion = execSync("node --version 2>&1", {
        encoding: "utf-8",
        timeout: 3000,
      }).trim();
    } catch { /* ignore */ }

    // 4. Platform info
    const platform = `${process.platform} ${process.arch}`;

    // 5. Account info - first try `claude auth status`
    const account: ClaudeCodeAccount = {
      email: null,
      plan: null,
      orgId: null,
      orgName: null,
      userId: null,
      maxModel: null,
      hasProFeatures: false,
      configDir: null,
      authMethod: null,
      subscriptionType: null,
      apiProvider: null,
    };

    try {
      const authOutput = execSync(`${binaryPath} auth status 2>&1`, {
        encoding: "utf-8",
        timeout: 10000,
      }).trim();
      console.log("[settings] auth status output:", authOutput.slice(0, 100));
      const authData = JSON.parse(authOutput);
      console.log("[settings] loggedIn:", authData.loggedIn);
      if (authData.loggedIn) {
        account.email = authData.email || null;
        account.orgId = authData.orgId || null;
        account.orgName = authData.orgName || null;
        account.userId = authData.userId || null;
        account.authMethod = authData.authMethod || null;
        account.subscriptionType = authData.subscriptionType || null;
        account.apiProvider = authData.apiProvider || null;
        account.hasProFeatures = true;
        account.configDir = path.join(homeDir, ".claude");
        account.plan = authData.subscriptionType
          ? authData.subscriptionType.charAt(0).toUpperCase() + authData.subscriptionType.slice(1)
          : "Claude Max";
      }
    } catch (e) {
      console.error("[settings] auth status FAILED:", e instanceof Error ? e.message.slice(0, 200) : e);
    }

    // Read Claude config files
    const claudeDir = path.join(homeDir, ".claude");
    if (fs.existsSync(claudeDir)) {
      account.configDir = claudeDir;

      // Read settings.json
      const settingsPath = path.join(claudeDir, "settings.json");
      if (fs.existsSync(settingsPath)) {
        try {
          const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
          if (!account.email) account.email = settings.email || settings.user?.email || null;
          if (!account.plan) account.plan = settings.plan || settings.tier || null;
          if (!account.orgId) account.orgId = settings.orgId || settings.organization_id || null;
          if (!account.userId) account.userId = settings.userId || settings.user_id || settings.user?.id || null;
          if (!account.maxModel) account.maxModel = settings.model || settings.default_model || null;
          if (!account.hasProFeatures) account.hasProFeatures = settings.hasProFeatures || settings.pro || false;
        } catch { /* ignore */ }
      }

      // Read config.json
      const configPath = path.join(claudeDir, "config.json");
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          if (!account.email) account.email = config.email || config.user?.email || null;
          if (!account.plan) account.plan = config.plan || config.subscription?.plan || null;
          if (!account.orgId) account.orgId = config.orgId || config.organization_id || null;
          if (!account.userId) account.userId = config.userId || config.user_id || config.user?.id || null;
        } catch { /* ignore */ }
      }

      // Read credentials.json for auth info
      const credsPath = path.join(claudeDir, "credentials.json");
      if (fs.existsSync(credsPath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
          if (!account.email) account.email = creds.email || null;
          if (!account.orgId) account.orgId = creds.orgId || creds.organizationId || null;
          account.hasProFeatures = true; // has credentials = authenticated
        } catch { /* ignore */ }
      }

      // Read .auth.json
      const authPath = path.join(claudeDir, ".auth.json");
      if (fs.existsSync(authPath)) {
        try {
          const auth = JSON.parse(fs.readFileSync(authPath, "utf-8"));
          if (!account.email) account.email = auth.email || auth.user_email || null;
          if (!account.userId) account.userId = auth.user_id || auth.userId || null;
          if (!account.orgId) account.orgId = auth.org_id || auth.orgId || auth.organizationId || null;
          account.hasProFeatures = true;
        } catch { /* ignore */ }
      }
    }

    // 6. Try `claude config list` as fallback
    if (!account.email) {
      try {
        const configOutput = execSync(`${binaryPath} config list 2>&1`, {
          encoding: "utf-8",
          timeout: 5000,
        }).trim();

        const lines = configOutput.split("\n");
        for (const line of lines) {
          const match = line.match(/^\s*(\w[\w.]*)\s*[:=]\s*(.+)\s*$/);
          if (match) {
            const key = match[1].toLowerCase();
            const val = match[2].trim();
            if (key === "email" || key === "user") account.email = account.email || val;
            if (key === "plan" || key === "tier") account.plan = account.plan || val;
            if (key === "orgid" || key === "org" || key === "organization_id") account.orgId = account.orgId || val;
            if (key === "model" || key === "default_model") account.maxModel = account.maxModel || val;
          }
        }
      } catch { /* ignore */ }
    }

    // Default plan name if authenticated but no plan info
    if (account.hasProFeatures && !account.plan) {
      account.plan = "Claude Max";
    }

    return {
      available: true,
      version,
      binaryPath,
      nodeVersion,
      platform,
      account: (account.hasProFeatures || account.configDir) ? account : null,
    };
  } catch {
    return empty;
  }
}
