import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";

const router = Router();

// TikTok OAuth endpoints (Login Kit)
const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

router.get("/tiktok", async (req, res) => {
  // Required env
  const clientKey = mustGetEnv("TIKTOK_CLIENT_KEY");

  // IMPORTANT: this MUST match what you put in TikTok Redirect URI exactly
  // Example: https://sign-bidding-arrive-solving.trycloudflare.com/oauth/tiktok/callback
  const redirectUri = mustGetEnv("TIKTOK_REDIRECT_URI");

  // Scopes you actually have available right now (you can expand later)
  // e.g. "user.info.profile,user.info.stats"
  const scope = mustGetEnv("TIKTOK_SCOPES");

  // CSRF protection
  const orgId = String(req.query.orgId || "");
  if (!orgId) return res.status(400).json({ error: "orgId required" });

  const state = Buffer.from(JSON.stringify({ orgId })).toString("base64");

  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  // If you need these later:
  // url.searchParams.set("disable_auto_auth", "1");

  return res.redirect(url.toString());
});

router.get("/tiktok/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const rawState = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;

  let orgId = "";
  try {
    if (rawState) {
      const parsed = JSON.parse(Buffer.from(rawState, "base64").toString());
      orgId = parsed.orgId;
    }
  } catch {}

  if (!orgId) {
    return res.status(400).json({ error: "orgId missing in state" });
  }
  if (error) {
    return res
      .status(400)
      .send(`TikTok OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`);
  }

  if (!code) {
    return res.status(400).send("Missing ?code in callback.");
  }

  const clientKey = mustGetEnv("TIKTOK_CLIENT_KEY");
  const clientSecret = mustGetEnv("TIKTOK_CLIENT_SECRET");
  const redirectUri = mustGetEnv("TIKTOK_REDIRECT_URI");

  // Exchange code for tokens
  const body = new URLSearchParams();
  body.set("client_key", clientKey);
  body.set("client_secret", clientSecret);
  body.set("code", code);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", redirectUri);

  const resp = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    return res.status(500).send(`Token exchange failed (${resp.status}): ${JSON.stringify(json)}`);
  }


const org = await prisma.organization.findUnique({ where: { id: orgId } });
if (!org) return res.status(400).json({ error: 'Invalid orgId' });

// TikTok account identifier (varies by API)
const providerAccountId =
  json?.open_id ||
  json?.union_id ||
  json?.data?.open_id ||
  json?.data?.union_id;

if (!providerAccountId) {
  return res.status(500).json({ error: 'Missing TikTok provider account id' });
}

const expiresIn =
  json?.expires_in ||
  json?.data?.expires_in ||
  null;

const expiresAt = expiresIn
  ? new Date(Date.now() + Number(expiresIn) * 1000)
  : null;

await prisma.socialAccount.upsert({
  where: {
    orgId_provider_providerAccountId: {
      orgId,
      provider: 'tiktok',
      providerAccountId: String(providerAccountId),
    },
  },
  update: {
    accessToken: json?.access_token || json?.data?.access_token || null,
    refreshToken: json?.refresh_token || json?.data?.refresh_token || null,
    expiresAt,
  },
  create: {
    orgId,
    provider: 'tiktok',
    providerAccountId: String(providerAccountId),
    accessToken: json?.access_token || json?.data?.access_token || null,
    refreshToken: json?.refresh_token || json?.data?.refresh_token || null,
    expiresAt,
  },
});

return res.status(200).json({ success: true });

});

export default router;
