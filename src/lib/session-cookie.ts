import { createHmac, timingSafeEqual } from "crypto";

export type CookieSession = {
  user: {
    email: string;
    name: string;
    role: "admin" | "viewer";
  };
  expires: string;
};

export const SESSION_COOKIE = "track_team_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function getAuthSecret() {
  const secret = process.env.EMAIL_AUTH_SECRET ?? process.env.AUTH_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("EMAIL_AUTH_SECRET or AUTH_SECRET is required in production.");
  }

  return secret ?? "local-development-auth-secret";
}

export function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken(email: string, role: string, expiresAt: number) {
  const payload = Buffer.from(
    JSON.stringify({ email: email.trim().toLowerCase(), role, expiresAt })
  ).toString("base64url");

  return `${payload}.${signValue(payload)}`;
}

export function verifySessionToken(token?: string): CookieSession | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeCompare(signValue(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      role?: string;
      expiresAt?: number;
    };

    if (!parsed.email || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
      return null;
    }

    return {
      user: {
        email: parsed.email,
        name: parsed.email.split("@")[0],
        role: parsed.role === "admin" ? "admin" : "viewer"
      },
      expires: new Date(parsed.expiresAt).toISOString()
    };
  } catch {
    return null;
  }
}
