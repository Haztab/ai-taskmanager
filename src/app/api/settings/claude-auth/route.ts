import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

const CLAUDE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_AUTH_URL = "https://claude.ai/oauth/authorize";
const CLAUDE_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const CLAUDE_REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
const SCOPES = "org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";

// Store PKCE verifier + state in globalThis to survive hot reloads
const g = globalThis as unknown as { __pkceVerifier?: string; __pkceState?: string };

function log(...args: unknown[]) {
  console.log(`[claude-auth ${new Date().toISOString().slice(11, 23)}]`, ...args);
}

// Generate PKCE pair
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// GET — check FE auth status (independent from CLI)
export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    const hasToken = !!settings?.claudeOAuthAccessToken;
    const expired = settings?.claudeOAuthExpiresAt
      ? new Date(settings.claudeOAuthExpiresAt) < new Date()
      : false;

    return NextResponse.json({
      loggedIn: hasToken && !expired,
      email: settings?.claudeOAuthEmail || null,
      expired,
    });
  } catch {
    return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  }
}

// POST
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    log("action:", action);

    // LOGIN — generate OAuth URL with PKCE
    if (action === "login") {
      const pkce = generatePKCE();
      const state = crypto.randomBytes(32).toString("base64url");
      g.__pkceVerifier = pkce.verifier;
      g.__pkceState = state;
      log("generated PKCE, challenge:", pkce.challenge.slice(0, 20) + "...");

      // Build URL to match CLI's exact format (+ for scope spaces)
      const scopeEncoded = SCOPES.split(" ").map(s => encodeURIComponent(s)).join("+");
      const authUrl = `${CLAUDE_AUTH_URL}?code=true`
        + `&client_id=${CLAUDE_CLIENT_ID}`
        + `&response_type=code`
        + `&redirect_uri=${encodeURIComponent(CLAUDE_REDIRECT_URI)}`
        + `&scope=${scopeEncoded}`
        + `&code_challenge=${pkce.challenge}`
        + `&code_challenge_method=S256`
        + `&state=${state}`;
      log("auth URL generated");

      return NextResponse.json({ authUrl, state });
    }

    // EXCHANGE — exchange auth code for tokens
    if (action === "exchange") {
      const { code } = body;
      if (!code) {
        return NextResponse.json({ error: "No code provided" }, { status: 400 });
      }

      const verifier = g.__pkceVerifier;
      const state = g.__pkceState;
      if (!verifier || !state) {
        return NextResponse.json({ error: "No PKCE session. Start login again." }, { status: 400 });
      }

      // Strip trailing # and URL hash (browser sometimes appends #state=...)
      const cleanCode = code.trim().replace(/#.*$/, "");
      log("exchanging code, length:", cleanCode.length, "state:", state.slice(0, 10) + "...");

      // Exchange code for tokens — must match CLI format exactly
      const tokenBody = {
        grant_type: "authorization_code",
        code: cleanCode,
        redirect_uri: CLAUDE_REDIRECT_URI,
        client_id: CLAUDE_CLIENT_ID,
        code_verifier: verifier,
        state,
      };
      log("token request body keys:", Object.keys(tokenBody).join(", "));

      const tokenRes = await fetch(CLAUDE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
      });

      const tokenText = await tokenRes.text();
      log("token response status:", tokenRes.status);
      log("token response:", tokenText.slice(0, 300));

      if (!tokenRes.ok) {
        g.__pkceVerifier = undefined;
        g.__pkceState = undefined;
        return NextResponse.json(
          { error: `Token exchange failed (${tokenRes.status}): ${tokenText.slice(0, 200)}` },
          { status: 400 }
        );
      }

      const tokens = JSON.parse(tokenText);
      log("got tokens, access_token:", tokens.access_token?.slice(0, 15) + "...");

      // Calculate expiry
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000); // default 1 hour

      // Fetch user profile
      let email: string | null = null;
      try {
        const profileRes = await fetch("https://platform.claude.com/v1/oauth/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          email = profile.email || null;
          log("profile email:", email);
        }
      } catch {
        log("couldn't fetch profile, continuing without email");
      }

      // Provision an API key using the OAuth token
      let apiKey: string | null = null;
      try {
        log("provisioning API key via OAuth token...");
        const keyRes = await fetch("https://api.anthropic.com/v1/organizations/api_keys", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${tokens.access_token}`,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            name: `TaskFlow AI (${new Date().toISOString().slice(0, 10)})`,
          }),
        });

        if (keyRes.ok) {
          const keyData = await keyRes.json();
          apiKey = keyData.api_key || keyData.key || keyData.secret || null;
          log("API key provisioned successfully");
        } else {
          const keyErr = await keyRes.text();
          log("API key provisioning failed:", keyRes.status, keyErr.slice(0, 200));
        }
      } catch (e) {
        log("API key provisioning error:", e instanceof Error ? e.message : e);
      }

      // Store in DB
      const updateData: Record<string, unknown> = {
        claudeOAuthAccessToken: tokens.access_token,
        claudeOAuthRefreshToken: tokens.refresh_token || null,
        claudeOAuthExpiresAt: expiresAt,
        claudeOAuthEmail: email,
      };
      // If we got an API key, store it so the SDK can use it directly
      if (apiKey) {
        updateData.anthropicApiKey = apiKey;
      }

      await prisma.appSettings.upsert({
        where: { id: "singleton" },
        update: updateData,
        create: {
          id: "singleton",
          ...updateData,
        },
      });

      g.__pkceVerifier = undefined;
      g.__pkceState = undefined;
      log("tokens stored in DB, login complete");

      return NextResponse.json({
        success: true,
        email,
        apiKeyProvisioned: !!apiKey,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // LOGOUT — clear FE tokens only (doesn't touch CLI)
    if (action === "logout") {
      log("FE logout — clearing DB tokens");
      await prisma.appSettings.update({
        where: { id: "singleton" },
        data: {
          claudeOAuthAccessToken: null,
          claudeOAuthRefreshToken: null,
          claudeOAuthExpiresAt: null,
          claudeOAuthEmail: null,
        },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    log("error:", error);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}
