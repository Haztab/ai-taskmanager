"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Key,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  RefreshCw,
  Shield,
  Cpu,
  Eye,
  EyeOff,
  Save,
  Trash2,
  LogIn,
  LogOut,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import dynamic from "next/dynamic";

const AuthTerminal = dynamic(
  () => import("@/components/terminal/auth-terminal").then((m) => m.AuthTerminal),
  { ssr: false }
);

interface AppSettings {
  dbMode: string;
  claudeCodeModel: string;
  dailyTokenLimit: number;
  claudeCodePath: string | null;
  claudeCodeArgs: string | null;
  anthropicKeySet: boolean;
  anthropicKeySource: "dashboard" | "env" | null;
  anthropicKeyPreview: string | null;
  claudeCodeInstalled: boolean;
  claudeCodeAvailable: boolean;
  claudeCodeLoggedIn: boolean;
  claudeCodeVersion: string | null;
  claudeCodeBinaryPath: string | null;
  claudeCodeNodeVersion: string | null;
  claudeCodePlatform: string | null;
  claudeCodeAccount: {
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
  } | null;
  databaseUrl: string;
}

interface TestResult {
  success: boolean;
  error?: string;
  message?: string;
  version?: string;
  model?: string;
}

const AI_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-haiku-4-20250414", label: "Claude Haiku 4" },
];

export default function GlobalSettingsPage() {
  const queryClient = useQueryClient();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [testingCli, setTestingCli] = useState(false);
  const [apiResult, setApiResult] = useState<TestResult | null>(null);
  const [cliResult, setCliResult] = useState<TestResult | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAuthTerminal, setShowAuthTerminal] = useState(false);

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["app-settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const saveSettings = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
  });

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;

    // Test the key first
    setTestingApi(true);
    try {
      const testRes = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "anthropic", apiKey: apiKeyInput.trim() }),
      });
      const result: TestResult = await testRes.json();
      setApiResult(result);

      if (result.success) {
        // Key is valid, save it
        await saveSettings.mutateAsync({ anthropicApiKey: apiKeyInput.trim() });
        setApiKeyInput("");
        toast.success("API key saved and verified!");
      } else {
        toast.error(`Invalid key: ${result.error}`);
      }
    } catch {
      toast.error("Failed to verify key");
    } finally {
      setTestingApi(false);
    }
  };

  const handleRemoveApiKey = async () => {
    await saveSettings.mutateAsync({ anthropicApiKey: "" });
    setApiResult(null);
    toast.success("API key removed from dashboard");
  };

  const handleDisconnectCli = async () => {
    await saveSettings.mutateAsync({ claudeCodePath: "", claudeCodeArgs: "" });
    setCliResult(null);
    queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    toast.success("Claude Code connection removed");
  };

  const handleAuthSuccess = async () => {
    setShowAuthTerminal(false);
    await queryClient.refetchQueries({ queryKey: ["app-settings"] });
    toast.success("Successfully authenticated!");
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/settings/claude-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Logged out of Claude Code");
        await queryClient.refetchQueries({ queryKey: ["app-settings"] });
      } else {
        toast.error(data.error || "Logout failed");
      }
    } catch {
      toast.error("Logout failed");
    } finally {
      setLoggingOut(false);
      setCliResult(null);
    }
  };

  const testConnection = async (type: "anthropic" | "claude-code") => {
    if (type === "anthropic") setTestingApi(true);
    else setTestingCli(true);

    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const result: TestResult = await res.json();

      if (type === "anthropic") setApiResult(result);
      else setCliResult(result);

      toast[result.success ? "success" : "error"](
        result.message || result.error || "Done"
      );
    } catch {
      const fail = { success: false, error: "Request failed" };
      if (type === "anthropic") setApiResult(fail);
      else setCliResult(fail);
    } finally {
      if (type === "anthropic") setTestingApi(false);
      else setTestingCli(false);
    }
  };

  const handleModelChange = (model: string) => {
    saveSettings.mutate({ claudeCodeModel: model });
    toast.success("Model updated");
  };

  const handleLimitChange = (limit: string) => {
    const num = parseInt(limit.replace(/,/g, ""), 10);
    if (!isNaN(num) && num > 0) {
      saveSettings.mutate({ dailyTokenLimit: num });
      toast.success("Token limit updated");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Settings" breadcrumbs={[{ label: "Settings" }]} />
        <div className="flex-1 p-8">
          <div className="max-w-2xl space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-[#e4e4e7] h-40 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" breadcrumbs={[{ label: "Settings" }]} />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl space-y-5">

          {/* Anthropic API Key */}
          <section className="bg-white rounded-xl border border-[#e4e4e7] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0f0f3]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#5b5bd6]/10 flex items-center justify-center">
                  <Key className="w-4 h-4 text-[#5b5bd6]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-[#0a0a0a] tracking-[-0.01em]">
                    Anthropic API Key
                  </h3>
                  <p className="text-[13px] text-[#6e6e80]">
                    Connect to Claude API for idea generation and task refinement
                  </p>
                </div>
                {settings?.anthropicKeySet && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] bg-[#30a46c]/10 text-[#30a46c] border border-[#30a46c]/20"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Current key status */}
              {settings?.anthropicKeySet && (
                <div className="flex items-center justify-between bg-[#fafafa] rounded-lg px-4 py-3 border border-[#f0f0f3]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#30a46c]" />
                    <code className="text-[13px] font-mono text-[#6e6e80]">
                      {settings.anthropicKeyPreview}
                    </code>
                    <Badge variant="outline" className="text-[10px]">
                      {settings.anthropicKeySource === "dashboard" ? "Dashboard" : "ENV"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => testConnection("anthropic")}
                      disabled={testingApi}
                      className="gap-1"
                    >
                      {testingApi ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Test
                    </Button>
                    {settings.anthropicKeySource === "dashboard" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={handleRemoveApiKey}
                        className="text-[#e5484d] hover:text-[#e5484d] hover:bg-[#e5484d]/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Input new key */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#0a0a0a]">
                  {settings?.anthropicKeySet ? "Update API Key" : "Enter API Key"}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="sk-ant-api03-..."
                      className="pr-10 font-mono text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a0a0a8] hover:text-[#6e6e80]"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim() || testingApi}
                    className="gap-1.5"
                  >
                    {testingApi ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {testingApi ? "Verifying..." : "Save & Verify"}
                  </Button>
                </div>
                <p className="text-[11px] text-[#a0a0a8]">
                  Key is verified before saving. Stored in the local database.
                </p>
              </div>

              {/* Test result */}
              {apiResult && (
                <div
                  className={`rounded-lg px-4 py-3 text-[13px] flex items-center gap-2 ${
                    apiResult.success
                      ? "bg-[#30a46c]/8 text-[#30a46c] border border-[#30a46c]/15"
                      : "bg-[#e5484d]/8 text-[#e5484d] border border-[#e5484d]/15"
                  }`}
                >
                  {apiResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Connected to <strong>{apiResult.model}</strong>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 shrink-0" />
                      {apiResult.error}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Claude Code Connection */}
          <section className="bg-white rounded-xl border border-[#e4e4e7] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0f0f3]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f76b15]/10 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-[#f76b15]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-[#0a0a0a] tracking-[-0.01em]">
                    Claude Code Connection
                  </h3>
                  <p className="text-[13px] text-[#6e6e80]">
                    Connect to Claude Code CLI for executing code in worktrees
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={`text-[11px] border ${
                    settings?.claudeCodeLoggedIn
                      ? "bg-[#30a46c]/10 text-[#30a46c] border-[#30a46c]/20"
                      : "bg-[#e5484d]/10 text-[#e5484d] border-[#e5484d]/20"
                  }`}
                >
                  {settings?.claudeCodeLoggedIn ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" />Connected</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" />Disconnected</>
                  )}
                </Badge>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Connection status + account info */}
              {settings?.claudeCodeLoggedIn ? (
                <div className="bg-[#fafafa] rounded-lg border border-[#f0f0f3] overflow-hidden">
                  {/* Account info header */}
                  <div className="px-4 py-3 border-b border-[#f0f0f3] flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#6e6e80] uppercase tracking-wide">
                      Account Details
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => testConnection("claude-code")}
                        disabled={testingCli}
                        className="gap-1"
                      >
                        {testingCli ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Refresh
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="text-[#e5484d] hover:text-[#e5484d] hover:bg-[#e5484d]/10 gap-1"
                      >
                        {loggingOut ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <LogOut className="w-3 h-3" />
                        )}
                        Logout
                      </Button>
                    </div>
                  </div>

                  {/* Account grid */}
                  <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                    <div>
                      <span className="text-[11px] text-[#a0a0a8]">Status</span>
                      <p className="font-medium text-[#30a46c] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#30a46c] animate-pulse" />
                        Active
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#a0a0a8]">Plan</span>
                      <p className="font-medium flex items-center gap-1.5">
                        {settings.claudeCodeAccount?.hasProFeatures && (
                          <Shield className="w-3.5 h-3.5 text-[#5b5bd6]" />
                        )}
                        {settings.claudeCodeAccount?.plan || "Claude Max"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#a0a0a8]">CLI Version</span>
                      <p className="font-medium font-mono text-[12px]">
                        {settings.claudeCodeVersion || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#a0a0a8]">Binary Path</span>
                      <p className="font-mono text-[12px] text-[#6e6e80] truncate" title={settings.claudeCodeBinaryPath || ""}>
                        {settings.claudeCodeBinaryPath || "—"}
                      </p>
                    </div>
                    {settings.claudeCodeAccount?.email && (
                      <div className="col-span-2">
                        <span className="text-[11px] text-[#a0a0a8]">Account Email</span>
                        <p className="font-medium">{settings.claudeCodeAccount.email}</p>
                      </div>
                    )}
                    {settings.claudeCodeAccount?.subscriptionType && (
                      <div>
                        <span className="text-[11px] text-[#a0a0a8]">Subscription</span>
                        <p className="font-medium capitalize">{settings.claudeCodeAccount.subscriptionType}</p>
                      </div>
                    )}
                    {settings.claudeCodeAccount?.authMethod && (
                      <div>
                        <span className="text-[11px] text-[#a0a0a8]">Auth Method</span>
                        <p className="text-[12px]">{settings.claudeCodeAccount.authMethod}</p>
                      </div>
                    )}
                    {settings.claudeCodeAccount?.orgName && (
                      <div className="col-span-2">
                        <span className="text-[11px] text-[#a0a0a8]">Organization</span>
                        <p className="text-[13px]">{settings.claudeCodeAccount.orgName}</p>
                      </div>
                    )}
                    {settings.claudeCodeAccount?.orgId && (
                      <div className="col-span-2">
                        <span className="text-[11px] text-[#a0a0a8]">Organization ID</span>
                        <p className="font-mono text-[12px] text-[#6e6e80] truncate">
                          {settings.claudeCodeAccount.orgId}
                        </p>
                      </div>
                    )}
                    {settings.claudeCodeAccount?.apiProvider && (
                      <div>
                        <span className="text-[11px] text-[#a0a0a8]">API Provider</span>
                        <p className="text-[12px]">{settings.claudeCodeAccount.apiProvider}</p>
                      </div>
                    )}
                    {settings.claudeCodeAccount?.maxModel && (
                      <div>
                        <span className="text-[11px] text-[#a0a0a8]">Default Model</span>
                        <p className="font-mono text-[12px]">
                          {settings.claudeCodeAccount.maxModel}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] text-[#a0a0a8]">Node.js</span>
                      <p className="font-mono text-[12px] text-[#6e6e80]">
                        {settings.claudeCodeNodeVersion || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#a0a0a8]">Platform</span>
                      <p className="text-[12px] text-[#6e6e80]">
                        {settings.claudeCodePlatform || "—"}
                      </p>
                    </div>
                    {settings.claudeCodeAccount?.configDir && (
                      <div className="col-span-2">
                        <span className="text-[11px] text-[#a0a0a8]">Config Directory</span>
                        <p className="font-mono text-[12px] text-[#6e6e80]">
                          {settings.claudeCodeAccount.configDir}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {!showAuthTerminal ? (
                    <div className="text-center py-6 space-y-4">
                      <div className="w-14 h-14 rounded-xl bg-[#f0f0f3] flex items-center justify-center mx-auto">
                        <Terminal className="w-7 h-7 text-[#a0a0a8]" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">
                          Connect Claude Code
                        </p>
                        <p className="text-[13px] text-[#6e6e80] max-w-sm mx-auto">
                          Sign in with your Anthropic account to enable AI code execution in worktrees.
                        </p>
                      </div>
                      <Button onClick={() => setShowAuthTerminal(true)} className="gap-2">
                        <LogIn className="w-4 h-4" />
                        Login with Anthropic
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] text-[#6e6e80]">
                          Complete the login in the terminal below. A browser window will open for authentication.
                        </p>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setShowAuthTerminal(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <AuthTerminal
                        onSuccess={handleAuthSuccess}
                        onClose={() => setShowAuthTerminal(false)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Custom path input */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#0a0a0a]">
                  CLI Binary Path
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    defaultValue={settings?.claudeCodePath || ""}
                    placeholder="claude (uses PATH default)"
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      saveSettings.mutate(
                        { claudeCodePath: val || "" },
                        { onSuccess: () => toast.success("CLI path updated") }
                      );
                    }}
                    className="font-mono text-[13px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection("claude-code")}
                    disabled={testingCli}
                    className="gap-1.5 shrink-0"
                  >
                    {testingCli ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Connect
                  </Button>
                </div>
                <p className="text-[11px] text-[#a0a0a8]">
                  Leave blank to use <code className="bg-[#f0f0f3] px-1 rounded">claude</code> from PATH.
                  Or set a custom path like <code className="bg-[#f0f0f3] px-1 rounded">/usr/local/bin/claude</code>.
                </p>
              </div>

              {/* Extra CLI args */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#0a0a0a]">
                  Extra CLI Arguments
                </label>
                <Input
                  type="text"
                  defaultValue={settings?.claudeCodeArgs || ""}
                  placeholder="e.g. --model opus --verbose"
                  onBlur={(e) => {
                    saveSettings.mutate(
                      { claudeCodeArgs: e.target.value.trim() || "" },
                      { onSuccess: () => toast.success("CLI args updated") }
                    );
                  }}
                  className="font-mono text-[13px]"
                />
                <p className="text-[11px] text-[#a0a0a8]">
                  Additional arguments passed to every <code className="bg-[#f0f0f3] px-1 rounded">claude --print</code> call.
                </p>
              </div>

              {/* Test result */}
              {cliResult && (
                <div
                  className={`rounded-lg px-4 py-3 text-[13px] flex items-center gap-2 ${
                    cliResult.success
                      ? "bg-[#30a46c]/8 text-[#30a46c] border border-[#30a46c]/15"
                      : "bg-[#e5484d]/8 text-[#e5484d] border border-[#e5484d]/15"
                  }`}
                >
                  {cliResult.success ? (
                    <><CheckCircle2 className="w-4 h-4 shrink-0" />Connected — {cliResult.version}</>
                  ) : (
                    <><XCircle className="w-4 h-4 shrink-0" />{cliResult.error}</>
                  )}
                </div>
              )}

              {/* Install instructions */}
              {!settings?.claudeCodeLoggedIn && (
                <div className="bg-[#fafafa] rounded-lg px-4 py-3 border border-[#f0f0f3] space-y-2">
                  <p className="text-[13px] text-[#6e6e80]">Install Claude Code CLI:</p>
                  <div className="bg-[#111113] rounded-md px-4 py-3 font-mono text-[12px] text-[#eeeeef]">
                    npm install -g @anthropic-ai/claude-code
                  </div>
                  <p className="text-[11px] text-[#a0a0a8]">
                    Requires a Claude Code Max subscription at claude.ai/code.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Model & Limits */}
          <section className="bg-white rounded-xl border border-[#e4e4e7] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0f0f3]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0090ff]/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#0090ff]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#0a0a0a] tracking-[-0.01em]">
                    AI Configuration
                  </h3>
                  <p className="text-[13px] text-[#6e6e80]">
                    Model selection and usage limits
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Model selector */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#0a0a0a]">
                  Default AI Model
                </label>
                <Select
                  value={settings?.claudeCodeModel || "claude-sonnet-4-20250514"}
                  onValueChange={(v) => v && handleModelChange(v)}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#a0a0a8]">
                  Used for idea generation, task refinement, and other AI features.
                </p>
              </div>

              {/* Daily limit */}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#0a0a0a]">
                  Daily Token Limit
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    defaultValue={settings?.dailyTokenLimit || 5000000}
                    onBlur={(e) => handleLimitChange(e.target.value)}
                    className="w-40 font-mono text-[13px]"
                  />
                  <span className="text-[13px] text-[#a0a0a8]">tokens / day</span>
                </div>
                <p className="text-[11px] text-[#a0a0a8]">
                  Usage tracking resets daily. Shown in the sidebar widget.
                </p>
              </div>
            </div>
          </section>

          {/* Database & System */}
          <section className="bg-white rounded-xl border border-[#e4e4e7] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0f0f3]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#6e6e80]/10 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-[#6e6e80]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#0a0a0a] tracking-[-0.01em]">
                    System
                  </h3>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
                <div>
                  <span className="text-[#a0a0a8] text-[12px]">Database</span>
                  <p className="font-medium flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-[#30a46c]" />
                    SQLite
                    <code className="text-[11px] font-mono text-[#a0a0a8] bg-[#f0f0f3] px-1.5 py-0.5 rounded ml-1">
                      {settings?.databaseUrl || "file:./dev.db"}
                    </code>
                  </p>
                </div>
                <div>
                  <span className="text-[#a0a0a8] text-[12px]">Mode</span>
                  <p className="font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#30a46c]" />
                    {settings?.dbMode === "real" ? "Production" : "Development"}
                  </p>
                </div>
                <div>
                  <span className="text-[#a0a0a8] text-[12px]">App Version</span>
                  <p className="font-medium">0.1.0</p>
                </div>
                <div>
                  <span className="text-[#a0a0a8] text-[12px]">Framework</span>
                  <p className="font-medium">Next.js 16 + Prisma</p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
