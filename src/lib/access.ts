import { redirect } from "next/navigation";
import { getEmailSession } from "@/lib/email-code-auth";

export async function getCurrentSession() {
  return getEmailSession();
}

export async function requireSession() {
  const session = await getEmailSession();

  if (!session?.user) {
    redirect("/signin");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireSession();

  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return session;
}

export async function isCurrentUserAdmin() {
  const session = await getEmailSession();
  return session?.user.role === "admin";
}
