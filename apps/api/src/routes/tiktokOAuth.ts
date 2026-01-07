import { Router } from "express";
import crypto from "crypto";

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
  const state = crypto.randomBytes(16).toString("hex");

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
  const state = req.query.state as string | undefined;
  const error = req.query.error as string | undefined;
  const errorDescription = req.query.error_description as string | undefined;

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

  // For now, just show the token response so we know it works.
  // Next step will be saving this to DB (SocialAccount) tied to org/user.
  return res.status(200).json({ state, token: json });
});

export default router;
