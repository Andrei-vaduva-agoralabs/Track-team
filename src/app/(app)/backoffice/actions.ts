"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ensureAdminUser,
  normalizeEmail,
  setGeneratedPasswordForUser
} from "@/lib/email-code-auth";
import { requireAdmin } from "@/lib/access";

function redirectToBackoffice({
  email,
  password,
  message
}: {
  email?: string;
  password?: string;
  message: string;
}) {
  const params = new URLSearchParams({ message });

  if (email) {
    params.set("email", email);
  }

  if (password) {
    params.set("password", password);
  }

  redirect(`/backoffice?${params.toString()}`);
}

export async function addWhitelistUserAction(formData: FormData) {
  await requireAdmin();
  await ensureAdminUser();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const role = String(formData.get("role") ?? "viewer") === "admin" ? "admin" : "viewer";

  if (!email) {
    redirectToBackoffice({ message: "Enter an email to create access credentials." });
  }

  const password = await setGeneratedPasswordForUser({
    email,
    role,
    active: true
  });

  revalidatePath("/backoffice");
  redirectToBackoffice({
    email,
    password,
    message: "Password generated successfully."
  });
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();

  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!email) {
    redirectToBackoffice({ message: "Select a valid user before resetting the password." });
  }

  const user = await prisma.authUser.findUnique({ where: { email } });

  if (!user) {
    redirectToBackoffice({ message: "User not found." });
    return;
  }

  const existingUser = user!;

  const password = await setGeneratedPasswordForUser({
    email,
    role: existingUser.role === "admin" ? "admin" : "viewer",
    active: existingUser.active
  });

  revalidatePath("/backoffice");
  redirectToBackoffice({
    email,
    password,
    message: "Password reset successfully."
  });
}

export async function setWhitelistUserStatusAction(formData: FormData) {
  await requireAdmin();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const active = String(formData.get("active") ?? "false") === "true";

  if (!email || email === "andrei.vaduva@agoralabs.tech") {
    return;
  }

  await prisma.authUser.update({
    where: { email },
    data: { active }
  });

  revalidatePath("/backoffice");
}
