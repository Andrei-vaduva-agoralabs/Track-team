import { prisma } from "@/lib/prisma";
import { hasJiraCredentials } from "@/lib/jira/config";
import { saveJiraSettings } from "@/app/setup/actions";
import { SetupSteps } from "@/components/setup-steps";
import { SetupControls } from "@/components/setup-controls";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [config, latestRun] = await Promise.all([
    prisma.jiraSyncConfig.findFirst(),
    prisma.syncRun.findFirst({
      orderBy: { startedAt: "desc" }
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
            {latestRun.startedAt.toLocaleString()}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
