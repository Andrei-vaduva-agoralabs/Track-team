"use server";

import { redirect } from "next/navigation";
import { requestLoginCode, verifyLoginCode } from "@/lib/email-code-auth";

export async function requestCodeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  const result = await requestLoginCode(email);
  const params = new URLSearchParams({
    email,
    callbackUrl,
    message: result.message,
    step: result.ok ? "code" : "email"
  });

  redirect(`/signin?${params.toString()}`);
}

export async function verifyCodeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  const result = await verifyLoginCode(email, code);

  if (result.ok) {
    redirect(callbackUrl);
  }

  const params = new URLSearchParams({
    email,
    callbackUrl,
    message: result.message,
    step: "code"
  });

  redirect(`/signin?${params.toString()}`);
}
