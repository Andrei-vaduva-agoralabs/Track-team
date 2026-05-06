import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken
} from "@/lib/session-cookie";

const ADMIN_EMAIL = "andrei.vaduva@agoralabs.tech";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPasswordHash(password: string, passwordHash: string) {
  const [salt, storedDigest] = passwordHash.split(":");

  if (!salt || !storedDigest) {
    return false;
  }

  const digest = scryptSync(password, salt, 64).toString("hex");
  const digestBuffer = Buffer.from(digest, "hex");
  const storedBuffer = Buffer.from(storedDigest, "hex");

  if (digestBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(digestBuffer, storedBuffer);
}

export function generatePassword(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export async function getEmailSession() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return null;
  }

  const user = await prisma.authUser.findUnique({
    where: { email: session.user.email }
  });

  if (!user?.active) {
    return null;
  }

  return {
    ...session,
    user: {
      ...session.user,
      role: user.role === "admin" ? "admin" as const : "viewer" as const
    }
  };
}

export async function createSession(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.authUser.findUnique({ where: { email: normalizedEmail } });

  if (!user?.active) {
    throw new Error("Email is not allowed.");
  }

  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, createSessionToken(normalizedEmail, user.role, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });

  await prisma.authUser.update({
    where: { email: normalizedEmail },
    data: { lastLoginAt: new Date() }
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function ensureAdminUser() {
  await prisma.authUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      role: "admin",
      active: true
    },
    create: {
      email: ADMIN_EMAIL,
      role: "admin",
      active: true
    }
  });
}

export async function setGeneratedPasswordForUser({
  email,
  role,
  active = true
}: {
  email: string;
  role: "admin" | "viewer";
  active?: boolean;
}) {
  const normalizedEmail = normalizeEmail(email);
  const password = generatePassword();
  const passwordHash = hashPassword(password);

  await ensureAdminUser();

  await prisma.authUser.upsert({
    where: { email: normalizedEmail },
    update: {
      role,
      active,
      passwordHash,
      passwordUpdatedAt: new Date()
    },
    create: {
      email: normalizedEmail,
      role,
      active,
      passwordHash,
      passwordUpdatedAt: new Date()
    }
  });

  return password;
}

export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return { ok: false, message: "Enter both email and password." };
  }

  await ensureAdminUser();
  const user = await prisma.authUser.findUnique({ where: { email: normalizedEmail } });

  if (!user?.active || !user.passwordHash || !verifyPasswordHash(password, user.passwordHash)) {
    return { ok: false, message: "Invalid email or password." };
  }

  await createSession(normalizedEmail);

  return { ok: true, message: "Signed in." };
}

export { SESSION_COOKIE, normalizeEmail };
