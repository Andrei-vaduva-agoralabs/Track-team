"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureAdminUser } from "@/lib/email-code-auth";
import { requireAdmin } from "@/lib/access";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function addWhitelistUserAction(formData: FormData) {
  await requireAdmin();
  await ensureAdminUser();

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const role = String(formData.get("role") ?? "viewer") === "admin" ? "admin" : "viewer";

  if (!email) {
    return;
  }

  await prisma.authUser.upsert({
    where: { email },
    update: {
      role,
      active: true
    },
    create: {
      email,
      role,
      active: true
    }
  });

  revalidatePath("/backoffice");
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
