import { parse as parseCookies } from "cookie";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ONE_YEAR_MS, COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const STATE_COOKIE = "shinko_google_oauth_state";
const NONCE_COOKIE = "shinko_google_oauth_nonce";

type GoogleProfile = { sub: string; email: string; name: string; nonce?: string; email_verified?: boolean };

function externalConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "";
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Login Google não configurado. Revise GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.");
  return { clientId, clientSecret, redirectUri };
}

function cookieOptions(req: Request) {
  const base = getSessionCookieOptions(req);
  return { ...base, sameSite: "lax" as const };
}

export function isAllowedExternalEmail(email: string, adminEmail: string, allowList: string) {
  const normalized = email.trim().toLocaleLowerCase("pt-BR");
  const permitted = new Set(allowList.split(",").map((value) => value.trim().toLocaleLowerCase("pt-BR")).filter(Boolean));
  return normalized === adminEmail.trim().toLocaleLowerCase("pt-BR") || permitted.has(normalized);
}

export function roleForExternalGoogleUser(email: string, adminEmail: string, currentRole?: "admin" | "user") {
  if (currentRole === "admin" || email.trim().toLocaleLowerCase("pt-BR") === adminEmail.trim().toLocaleLowerCase("pt-BR")) return "admin" as const;
  return "user" as const;
}

async function exchangeGoogleCode(code: string, expectedNonce: string): Promise<GoogleProfile> {
  const { clientId, clientSecret, redirectUri } = externalConfig();
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("O Google recusou a troca do código de acesso.");
  const token = await response.json() as { id_token?: string };
  if (!token.id_token) throw new Error("O Google não retornou a identidade da conta.");
  const verified = await jwtVerify(token.id_token, GOOGLE_JWKS, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: clientId });
  const profile = verified.payload as GoogleProfile;
  if (!profile.sub || !profile.email || profile.email_verified !== true || profile.nonce !== expectedNonce) throw new Error("A resposta de login Google não pôde ser validada.");
  return profile;
}

export function registerExternalGoogleAuthRoutes(app: Express) {
  app.get("/auth/google", (req: Request, res: Response) => {
    try {
      const { clientId, redirectUri } = externalConfig();
      const state = crypto.randomUUID();
      const nonce = crypto.randomUUID();
      const options = cookieOptions(req);
      res.cookie(STATE_COOKIE, state, { ...options, httpOnly: true, maxAge: 10 * 60 * 1000 });
      res.cookie(NONCE_COOKIE, nonce, { ...options, httpOnly: true, maxAge: 10 * 60 * 1000 });
      const redirect = new URL(GOOGLE_AUTH_URL);
      redirect.searchParams.set("client_id", clientId);
      redirect.searchParams.set("redirect_uri", redirectUri);
      redirect.searchParams.set("response_type", "code");
      redirect.searchParams.set("scope", "openid email profile");
      redirect.searchParams.set("state", state);
      redirect.searchParams.set("nonce", nonce);
      redirect.searchParams.set("prompt", "select_account");
      res.redirect(302, redirect.toString());
    } catch (error) {
      res.status(500).send(error instanceof Error ? error.message : "Não foi possível iniciar o login Google.");
    }
  });

  app.get("/auth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookies = parseCookies(req.headers.cookie || "");
    const options = cookieOptions(req);
    res.clearCookie(STATE_COOKIE, options);
    res.clearCookie(NONCE_COOKIE, options);
    if (!code || !state || state !== cookies[STATE_COOKIE] || !cookies[NONCE_COOKIE]) return res.status(403).send("A solicitação de login expirou. Tente novamente.");

    try {
      const profile = await exchangeGoogleCode(code, cookies[NONCE_COOKIE]);
      const adminEmail = process.env.GOOGLE_ADMIN_EMAIL || "";
      const allowList = process.env.GOOGLE_ALLOWED_EMAILS || "";
      if (!isAllowedExternalEmail(profile.email, adminEmail, allowList)) return res.status(403).send("Este e-mail não está autorizado a consultar a Biblioteca Shinko.");
      const openId = `google:${profile.sub}`;
      const existing = await db.getUserByOpenId(openId);
      const role = roleForExternalGoogleUser(profile.email, adminEmail, existing?.role);
      await db.upsertUser({ openId, name: profile.name || profile.email, email: profile.email, loginMethod: "google", role, lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(openId, { name: profile.name || profile.email, expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] callback failed", error);
      res.status(500).send("Não foi possível concluir o login Google.");
    }
  });
}
