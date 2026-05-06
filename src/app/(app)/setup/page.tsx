import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hasJiraCredentials } from "@/lib/jira/config";
import { saveJiraSettings } from "@/app/setup/actions";
import { SetupSteps } from "@/components/setup-steps";
import { SetupControls } from "@/components/setup-controls";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const host = headerStore.get("host");
  const appOrigin =
    forwardedProto && host ? `${forwardedProto}://${host}` : host ? `https://${host}` : "";
  const [config, latestRun, latestSuccessfulRun] = await Promise.all([
    prisma.jiraSyncConfig.findFirst(),
    prisma.syncRun.findFirst({
      orderBy: { startedAt: "desc" }
    }),
    prisma.syncRun.findFirst({
      where: { status: "success" },
      orderBy: { finishedAt: "desc" }
    })
  ]);
  const credentialsReady = hasJiraCredentials();

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Connection</p>
          <h2>Jira source configuration</h2>
        </div>
        <form action={saveJiraSettings} className="form-grid">
          <label>
            Jira base URL
            <input
              name="baseUrl"
              defaultValue={config?.baseUrl ?? "https://agoralabs.atlassian.net"}
              placeholder="https://agoralabs.atlassian.net"
              required
            />
          </label>
          <label>
            Board ID
            <input
              name="boardId"
              type="number"
              defaultValue={config?.boardId ?? 1}
              required
            />
          </label>
          <label>
            Project key
            <input
              name="projectKey"
              defaultValue={config?.projectKey ?? "AL"}
              placeholder="AL"
              required
            />
          </label>
          <button type="submit">Save local Jira settings</button>
        </form>
        <p className="hint">
          Credentials stay in <code>.env.local</code>. This form only stores non-secret
          connection metadata in the local database.
        </p>
        <p className="hint">
          Credential status: <strong>{credentialsReady ? "present" : "missing"}</strong>
        </p>
      </section>

      <SetupSteps />
      <SetupControls />

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Hybrid Sync</p>
          <h2>Automatic refresh setup</h2>
        </div>
        <div className="wiki-grid">
          <article className="wiki-card">
            <div className="wiki-card-header">
              <h3>Scheduled full sync</h3>
              <code>2-hour cron ready</code>
            </div>
            <p>
              The app is ready to call <code>/api/cron/jira-sync</code> every 2 hours via
              Vercel Cron, but your current Vercel Hobby plan blocks sub-daily cron jobs.
              Upgrade to Pro to activate the 2-hour full refresh.
            </p>
          </article>
          <article className="wiki-card">
            <div className="wiki-card-header">
              <h3>Webhook push sync</h3>
              <code>issue changes</code>
            </div>
            <p>
              Configure a Jira webhook that points to <code>{appOrigin || "https://your-app-domain"}/api/jira/webhook</code>.
              Issue create, update, and delete events will refresh the affected issue data immediately.
            </p>
          </article>
          <article className="wiki-card">
            <div className="wiki-card-header">
              <h3>Last successful sync</h3>
              <code>visible timestamp</code>
            </div>
            <p>
              {latestSuccessfulRun?.finishedAt
                ? `${latestSuccessfulRun.finishedAt.toLocaleString()} via ${latestSuccessfulRun.trigger}.`
                : "No successful automatic or manual sync has completed yet."}
            </p>
          </article>
        </div>
        <ol className="instruction-list">
          <li>Add `CRON_SECRET` and `JIRA_WEBHOOK_SECRET` to Vercel and `.env.local`.</li>
          <li>Upgrade the Vercel project to Pro if you want the 2-hour cron fallback.</li>
          <li>In Jira admin, create a webhook for `jira:issue_created`, `jira:issue_updated`, and `jira:issue_deleted` pointing to <code>{appOrigin || "https://your-app-domain"}/api/jira/webhook</code>.</li>
          <li>Set the webhook secret to the same value as `JIRA_WEBHOOK_SECRET`.</li>
        </ol>
      </section>

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Next Integration Step</p>
          <h2>What I need from you after the install</h2>
        </div>
        <ol className="instruction-list">
          <li>Create an Atlassian API token for the Jira account that should read Agora board data.</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code>.</li>
          <li>Fill <code>JIRA_EMAIL</code> and <code>JIRA_API_TOKEN</code>.</li>
          <li>Press <code>Test Jira connection</code>, then <code>Import sprints</code>, then <code>Import issues</code>.</li>
        </ol>
        {latestRun ? (
          <p className="hint">
            Last sync run: <strong>{latestRun.status}</strong> at{" "}
            {latestRun.startedAt.toLocaleString()}
            {latestRun.trigger ? ` via ${latestRun.trigger}` : ""}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
