"use server";

import { redirect } from "next/navigation";
import { signInWithPassword } from "@/lib/email-code-auth";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  const result = await signInWithPassword(email, password);

  if (result.ok) {
    redirect(callbackUrl);
  }

  const params = new URLSearchParams({
    email,
    callbackUrl,
    message: result.message
  });

  redirect(`/signin?${params.toString()}`);
}
