import { redirect } from "next/navigation";
import { getEmailSession } from "@/lib/email-code-auth";
import { signInAction } from "@/app/signin/actions";

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<{
    callbackUrl?: string;
    email?: string;
    message?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getEmailSession();
  const callbackUrl = params?.callbackUrl ?? "/dashboard";
  const email = params?.email ?? "";

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="signin-shell">
      <section className="signin-card">
        <p className="eyebrow">Agora Team Analytics</p>
        <h1>Sign in with your internal account</h1>
        <p>
          Access is limited to emails enabled by an admin. Use the password generated
          for your account in the internal backoffice.
        </p>
        {params?.message ? <p className="form-message">{params.message}</p> : null}
        <form action={signInAction} className="form-grid">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <label>
            Email
            <input
              name="email"
              type="email"
              defaultValue={email}
              placeholder="name@agoralabs.tech"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter the password given by your admin"
              required
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </section>
    </div>
  );
}
