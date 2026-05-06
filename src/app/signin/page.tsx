import { redirect } from "next/navigation";
import { getEmailSession } from "@/lib/email-code-auth";
import { requestCodeAction, verifyCodeAction } from "@/app/signin/actions";

export default async function SignInPage({
  searchParams
}: {
  searchParams?: Promise<{
    callbackUrl?: string;
    email?: string;
    message?: string;
    step?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getEmailSession();
  const callbackUrl = params?.callbackUrl ?? "/dashboard";
  const email = params?.email ?? "";
  const step = params?.step === "code" ? "code" : "email";

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <div className="signin-shell">
      <section className="signin-card">
        <p className="eyebrow">Agora Team Analytics</p>
        <h1>{step === "code" ? "Enter your login code" : "Sign in with email"}</h1>
        <p>
          Access is limited to emails whitelisted by an admin. We will send a
          6-digit code to your email.
        </p>
        {params?.message ? <p className="form-message">{params.message}</p> : null}

        {step === "code" ? (
          <form action={verifyCodeAction} className="form-grid">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <label>
              Email
              <input name="email" type="email" defaultValue={email} required />
            </label>
            <label>
              Login code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                required
              />
            </label>
            <button type="submit">Verify code</button>
            <button formAction={requestCodeAction} type="submit" className="secondary-action">
              Request a new code
            </button>
          </form>
        ) : (
          <form action={requestCodeAction} className="form-grid">
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
            <button type="submit">Send login code</button>
          </form>
        )}
      </section>
    </div>
  );
}
