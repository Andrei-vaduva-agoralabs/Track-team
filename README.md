# Agora Team Analytics

Desktop web dashboard for Jira-backed sprint performance analytics.

## Stack

- Next.js App Router
- TypeScript
- Prisma
- SQLite for local development

## Local setup

1. Copy `.env.example` to `.env.local`
2. Fill Jira credentials
3. Install dependencies
4. Run `npm run prisma:generate`
5. Run `npm run db:push`
6. Run `npm run dev`

## Current scope

- Jira connection settings
- Data schema for sprints, issues, capacities, and analytics facts
- Initial dashboard shell
- Initial setup shell
