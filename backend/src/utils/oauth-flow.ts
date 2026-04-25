import { randomUUID } from "node:crypto";
import { Request, Response } from "express";
import { normalizeEnvValue } from "./env";

type OAuthProvider = "google" | "github";

type OAuthStatePayload = {
  state: string;
  provider: OAuthProvider;
  returnTo: string;
  createdAt: number;
};

const OAUTH_COOKIE_PREFIX = "versafic_oauth";
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

const getAllowedFrontendOrigins = (): string[] => {
  const configuredOrigins = [
    process.env.FRONTEND_BASE_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.CORS_ORIGINS || "").split(","),
  ]
    .map((value) => normalizeEnvValue(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(configuredOrigins));
};

const isAllowedFrontendOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    const allowedOrigins = getAllowedFrontendOrigins();

    if (allowedOrigins.includes(parsed.origin)) {
      return true;
    }

    if (
      parsed.protocol === "https:" &&
      (parsed.hostname.endsWith(".vercel.app") || parsed.hostname.endsWith(".onrender.com"))
    ) {
      return true;
    }

    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const getDefaultFrontendReturnUrl = (): string => {
  const vercelUrl = normalizeEnvValue(process.env.FRONTEND_VERCEL_URL);
  const fallbackOrigin =
    getAllowedFrontendOrigins()[0] ||
    (vercelUrl ? `https://${vercelUrl}` : "") ||
    (process.env.NODE_ENV === "production" ? "https://frontend-anandh0us-projects.vercel.app" : "http://localhost:3000");

  return `${fallbackOrigin.replace(/\/+$/, "")}/auth/callback`;
};

const serializeCookie = (name: string, value: string, maxAgeSeconds: number) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/auth",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
};

const clearCookieValue = (name: string) => serializeCookie(name, "", 0);

const getCookieName = (provider: OAuthProvider) => `${OAUTH_COOKIE_PREFIX}_${provider}`;

const readCookie = (req: Request, name: string): string | null => {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }

  const cookies = header.split(";").map((part) => part.trim());
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
};

const encodeStatePayload = (payload: OAuthStatePayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const decodeStatePayload = (value: string): OAuthStatePayload | null => {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!parsed?.state || !parsed?.provider || !parsed?.returnTo || !parsed?.createdAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const resolveFrontendReturnUrl = (rawValue?: string | string[]): string => {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (!value) {
    return getDefaultFrontendReturnUrl();
  }

  const parsed = new URL(value);
  if (!isAllowedFrontendOrigin(parsed.origin)) {
    throw new Error("Frontend return URL is not allowed");
  }

  if (parsed.pathname !== "/auth/callback") {
    throw new Error("Frontend return URL must point to /auth/callback");
  }

  return parsed.toString();
};

export const createOAuthState = (provider: OAuthProvider, returnTo: string): OAuthStatePayload => ({
  state: randomUUID(),
  provider,
  returnTo,
  createdAt: Date.now(),
});

export const storeOAuthState = (res: Response, payload: OAuthStatePayload): void => {
  const cookieValue = encodeStatePayload(payload);
  res.append("Set-Cookie", serializeCookie(getCookieName(payload.provider), cookieValue, OAUTH_STATE_TTL_SECONDS));
};

export const clearOAuthState = (res: Response, provider: OAuthProvider): void => {
  res.append("Set-Cookie", clearCookieValue(getCookieName(provider)));
};

export const readOAuthState = (req: Request, provider: OAuthProvider): OAuthStatePayload | null => {
  const cookieValue = readCookie(req, getCookieName(provider));
  if (!cookieValue) {
    return null;
  }

  const decoded = decodeStatePayload(cookieValue);
  if (!decoded || decoded.provider !== provider) {
    return null;
  }

  const expiresAt = decoded.createdAt + OAUTH_STATE_TTL_SECONDS * 1000;
  if (expiresAt < Date.now()) {
    return null;
  }

  return decoded;
};

export const buildFrontendAuthSuccessUrl = (
  returnTo: string,
  payload: {
    accessToken: string;
    refreshToken: string;
    provider: OAuthProvider;
    isNewUser: boolean;
  }
): string => {
  const url = new URL(returnTo);
  url.hash = new URLSearchParams({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    provider: payload.provider,
    isNewUser: String(payload.isNewUser),
  }).toString();

  return url.toString();
};

export const buildFrontendAuthErrorUrl = (returnTo: string, message: string): string => {
  const url = new URL(returnTo);
  url.searchParams.set("error", message);
  return url.toString();
};
