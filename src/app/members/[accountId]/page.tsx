import Link from "next/link";
import { notFound } from "next/navigation";
import { SprintSwitcher } from "@/components/sprint-switcher";
import { StatCard } from "@/components/stat-card";
import { getMemberDetailSnapshot } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ accountId: string }>;
  searchParams?: Promise<{ sprint?: string }>;
}) {
  const routeParams = await params;
  const query = await searchParams;
  const accountId = decodeURIComponent(routeParams.accountId);
  const snapshot = await getMemberDetailSnapshot(accountId, query?.sprint);

  if (!snapshot) {
    notFound();
  }

  const selectedSprintName =
    snapshot.selectedSprint?.name ?? snapshot.currentSprint?.name ?? "No sprint";
  const sprintQuery = snapshot.selectedSprint?.id
    ? `?sprint=${encodeURIComponent(snapshot.selectedSprint.id)}`
    : "";

  return (
    <div className="page-grid">
      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Member Detail</p>
          <h2>{snapshot.member.displayName}</h2>
          <p className="hero-copy">
            Drill down from the sprint overview into assigned work, delivery outcomes,
            and cycle-time signals for this person.
          </p>
        </div>
        <div className="hero-focus">
          <span>Selected sprint</span>
          <strong>{selectedSprintName}</strong>
          <small>
            <Link href={`/dashboard${sprintQuery}`}>Back to sprint overview</Link>
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Sprint Scope</p>
          <h2>Switch sprint without leaving the member context</h2>
        </div>
        <SprintSwitcher
          sprints={snapshot.sprints}
          selectedSprintId={snapshot.selectedSprint?.id}
          action={`/members/${encodeURIComponent(accountId)}`}
        />
      </section>

      <section className="stats-grid member-stats-grid">
        <StatCard
          label="Completed issues"
          value={String(snapshot.stats?.completedIssues ?? 0)}
          detail="Issues this person owned to Done in the selected sprint"
        />
        <StatCard
          label="Not completed"
          value={String(snapshot.stats?.notCompletedIssues ?? 0)}
          detail="Issues that started here and finished with someone else"
        />
        <StatCard
          label="Delivered points"
          value={String(snapshot.stats?.deliveredStoryPoints ?? 0)}
          detail="Story points delivered as final owner"
        />
        <StatCard
          label="Estimator points"
          value={String(snapshot.stats?.estimatorDeliveredPoints ?? 0)}
          detail="Delivered story points this person estimated"
        />
        <StatCard
          label="Capacity days"
          value={String(snapshot.stats?.capacityDays ?? 0)}
          detail="Manual sprint capacity available for this member"
        />
        <StatCard
          label="Lead execution"
          value={snapshot.stats?.avgLeadExecutionLabel ?? "No data"}
          detail="Average first-start to terminal-state duration"
        />
        <StatCard
          label="Active work time"
          value={snapshot.stats?.avgActiveWorkLabel ?? "No data"}
          detail="Average summed In Progress time across involved issues"
        />
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Assigned Work</p>
            <h2>{selectedSprintName} issue list</h2>
          </div>
          <p className="panel-meta">
            Showing issues where this person was the original owner, final owner, or both.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Role</th>
                <th>Status</th>
                <th>SP</th>
                <th>Lead time</th>
                <th>Active work</th>
                <th>Started</th>
                <th>Terminal</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.issues.length === 0 ? (
                <tr>
                  <td colSpan={8}>No issue involvement found for this sprint.</td>
                </tr>
              ) : (
                snapshot.issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>
                      <div className="issue-cell">
                        <strong>{issue.key}</strong>
                        <span>{issue.summary}</span>
                      </div>
                    </td>
                    <td>{issue.role}</td>
                    <td>{issue.currentStatus}</td>
                    <td>{issue.storyPointsLatest}</td>
                    <td>{issue.leadExecutionLabel}</td>
                    <td>{issue.activeWorkLabel}</td>
                    <td>{issue.startedAt}</td>
                    <td>{issue.terminalAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
