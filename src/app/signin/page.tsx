import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { isAuthEnabled } from "@/lib/auth-config";

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  if (!isAuthEnabled()) {
    redirect(params?.callbackUrl ?? "/dashboard");
  }

  const session = await auth();

  if (session?.user) {
    redirect(params?.callbackUrl ?? "/dashboard");
  }

  return (
    <div className="signin-shell">
      <section className="signin-card">
        <p className="eyebrow">Agora Team Analytics</p>
        <h1>Sign in with Microsoft</h1>
        <p>
          Use your Microsoft work account to access sprint delivery, capacity, and
          member analytics.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", {
              redirectTo: params?.callbackUrl ?? "/dashboard"
            });
          }}
        >
          <button type="submit">Continue with Microsoft</button>
        </form>
      </section>
    </div>
  );
}
