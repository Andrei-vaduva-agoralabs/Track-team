import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAuthEnabled } from "@/lib/auth-config";

export async function getCurrentSession() {
  return auth();
}

export async function requireSession() {
  if (!isAuthEnabled()) {
    return {
      user: {
        name: "Local Admin",
        email: "local-admin@agoralabs.tech",
        role: "admin" as const
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  const session = await auth();

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
  if (!isAuthEnabled()) {
    return true;
  }

  const session = await auth();
  return session?.user.role === "admin";
}
