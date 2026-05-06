import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

type AppRole = "admin" | "viewer";

declare module "next-auth" {
  interface Session {
    user: {
      role: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: AppRole;
  }
}

function listFromEnv(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function emailDomain(email: string) {
  return email.toLowerCase().split("@").at(1) ?? "";
}

const allowedDomains = listFromEnv(
  process.env.AUTH_ALLOWED_DOMAINS ?? "agoralabs.tech"
);
const allowedEmails = listFromEnv(process.env.AUTH_ALLOWED_EMAILS);
const adminEmails = listFromEnv(
  process.env.ADMIN_EMAILS ?? "andrei.vaduva@agoralabs.tech"
);

function isAllowedEmail(email: string) {
  const normalized = email.toLowerCase();

  return allowedEmails.has(normalized) || allowedDomains.has(emailDomain(normalized));
}

function roleForEmail(email: string): AppRole {
  return adminEmails.has(email.toLowerCase()) ? "admin" : "viewer";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/signin",
    error: "/signin"
  },
  session: {
    strategy: "jwt"
  },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
    })
  ],
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email && isAllowedEmail(user.email));
    },
    async jwt({ token }) {
      if (token.email) {
        token.role = roleForEmail(token.email);
      }

      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role ?? "viewer";
      return session;
    }
  }
});
