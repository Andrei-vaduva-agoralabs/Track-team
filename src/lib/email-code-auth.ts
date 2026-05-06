import "server-only";

import { randomInt } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  safeCompare,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signValue,
  verifySessionToken
} from "@/lib/session-cookie";

const CODE_TTL_MINUTES = 10;
const ADMIN_EMAIL = "andrei.vaduva@agoralabs.tech";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(email: string, code: string) {
  return signValue(`${normalizeEmail(email)}:${code}`);
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

async function sendLoginEmail(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM ?? "Agora Team Analytics <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured.");
    }

    console.log(`[TrackTeam login code] ${email}: ${code}`);
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Agora Team Analytics login code",
      text: `Your login code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`
    })
  });

  if (!response.ok) {
    throw new Error(`Could not send login code: ${await response.text()}`);
  }

  return true;
}

export async function requestLoginCode(email: string) {
  const normalizedEmail = normalizeEmail(email);

  await ensureAdminUser();

  const user = await prisma.authUser.findUnique({ where: { email: normalizedEmail } });

  if (!user?.active) {
    return { ok: false, message: "This email is not allowed. Ask an admin for access." };
  }

  await prisma.loginCode.updateMany({
    where: {
      email: normalizedEmail,
      consumedAt: null
    },
    data: {
      consumedAt: new Date()
    }
  });

  const code = String(randomInt(100000, 999999));

  const loginCode = await prisma.loginCode.create({
    data: {
      email: normalizedEmail,
      codeHash: hashCode(normalizedEmail, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
    }
  });

  try {
    const delivered = await sendLoginEmail(normalizedEmail, code);

    return {
      ok: true,
      message: delivered
        ? "We sent a 6-digit code to your email."
        : "Email delivery is not configured locally. Your code was written to the server logs."
    };
  } catch {
    await prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { consumedAt: new Date() }
    });

    return {
      ok: false,
      message: "Could not send the login code. Ask an admin to configure email delivery."
    };
  }
}

export async function verifyLoginCode(email: string, code: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = code.trim();

  const loginCode = await prisma.loginCode.findFirst({
    where: {
      email: normalizedEmail,
      consumedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!loginCode) {
    return { ok: false, message: "Code expired. Request a new code." };
  }

  if (loginCode.attempts >= 5) {
    return { ok: false, message: "Too many attempts. Request a new code." };
  }

  const matches = safeCompare(loginCode.codeHash, hashCode(normalizedEmail, normalizedCode));

  if (!matches) {
    await prisma.loginCode.update({
      where: { id: loginCode.id },
      data: { attempts: { increment: 1 } }
    });

    return { ok: false, message: "Invalid code. Try again or request a new code." };
  }

  await prisma.loginCode.update({
    where: { id: loginCode.id },
    data: { consumedAt: new Date() }
  });
  await createSession(normalizedEmail);

  return { ok: true, message: "Signed in." };
}

export { SESSION_COOKIE };
