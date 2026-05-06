# Deployment

## Production Setup

- Hosting: Vercel
- Database: Supabase Postgres
- Authentication: optional Microsoft Entra ID through Auth.js
- Jira access: one Agora Jira service account stored in Vercel environment variables

## Microsoft Entra ID

This is optional for the first deployment. If the Auth.js environment variables are missing, the app stays open.

Create an app registration in Microsoft Entra.

Use these redirect URLs:

- Local: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
- Production: `https://<your-vercel-domain>/api/auth/callback/microsoft-entra-id`

Use single-tenant access for Agora if possible.

Required Vercel environment variables:

```env
AUTH_SECRET=""
AUTH_MICROSOFT_ENTRA_ID_ID=""
AUTH_MICROSOFT_ENTRA_ID_SECRET=""
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/<tenant-id>/v2.0"
AUTH_ALLOWED_DOMAINS="agoralabs.tech"
AUTH_ALLOWED_EMAILS=""
ADMIN_EMAILS="andrei.vaduva@agoralabs.tech"
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 33
```

Access rules:

- Anyone matching `AUTH_ALLOWED_DOMAINS` can sign in as a viewer.
- Anyone listed in `AUTH_ALLOWED_EMAILS` can sign in even if they are outside the domain.
- Anyone listed in `ADMIN_EMAILS` can access setup, manual sync, and capacity editing.

## Jira Secrets

Add these in Vercel as encrypted environment variables:

```env
JIRA_BASE_URL="https://agoralabs.atlassian.net"
JIRA_BOARD_ID="1"
JIRA_PROJECT_KEY="AL"
JIRA_EMAIL=""
JIRA_API_TOKEN=""
```

Use a Jira service account token for production. Do not use a personal token long-term.

## Supabase

Prisma is already configured for Supabase Postgres:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Use the transaction pooler connection string for `DATABASE_URL` in Vercel. Use `DIRECT_URL` for schema pushes and local seed jobs.

The Supabase schema has already been pushed once with:

```bash
npx prisma db push
```

The current seed script is:

```bash
node --env-file=.env.local ./node_modules/.bin/tsx scripts/import-jira.ts --issues-only
```

## GitHub and Vercel

This folder is not currently a Git repository. To deploy from Vercel:

1. Initialize a Git repository here or move the app into the GitHub repo connected to Vercel.
2. Push the code to GitHub.
3. Import the repo in Vercel.
4. Add all environment variables above.
5. Deploy.

For the first production deploy, run the Jira import from the app setup page after logging in as an admin.
