import { getDashboardSnapshot } from "@/lib/dashboard";
import { StatCard } from "@/components/stat-card";
import { SprintSwitcher } from "@/components/sprint-switcher";
import { RefreshBoardButton } from "@/components/refresh-board-button";
import { isCurrentUserAdmin } from "@/lib/access";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ sprint?: string }>;
}) {
  const params = await searchParams;
  const [snapshot, isAdmin] = await Promise.all([
    getDashboardSnapshot(params?.sprint),
    isCurrentUserAdmin()
  ]);

  const currentSprintName = snapshot.currentSprint?.name ?? "No sprint synced yet";
  const selectedSprintName =
    snapshot.selectedSprint?.name ?? currentSprintName;
  const primaryFact = snapshot.selectedTeamFact ?? snapshot.trendFacts.at(-1);
  const sprintQuery = snapshot.selectedSprint?.id
    ? `?sprint=${encodeURIComponent(snapshot.selectedSprint.id)}`
    : "";
  const maxCommittedPoints = Math.max(
    1,
    ...snapshot.trendFacts.map((fact) => fact.committedStoryPoints)
  );

  return (
    <div className="page-grid">
      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Selected Sprint</p>
          <div className="hero-title-row">
            <h2>{selectedSprintName}</h2>
            <span className="status-pill neutral">{snapshot.teamCount} team members</span>
          </div>
          <p className="hero-copy">
            Review delivery reliability, handoffs, and roster coverage for the sprint you are
            analyzing. Use member drill-downs only when the overview signals where to look.
          </p>
        </div>
        <div className="hero-focus">
          <div>
            <span>Current board context</span>
            <strong>{currentSprintName}</strong>
          </div>
          <SprintSwitcher
            sprints={snapshot.sprints}
            selectedSprintId={snapshot.selectedSprint?.id}
          />
          {isAdmin ? (
            <RefreshBoardButton sprintId={snapshot.selectedSprint?.id} />
          ) : null}
          <small>
            {snapshot.config
              ? `Board ${snapshot.config.boardId} in ${snapshot.config.projectKey}. ${snapshot.teamCount} active team members in the curated roster.`
              : "Jira connection is not configured in the local database yet."}
          </small>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Delivery rate"
          value={
            snapshot.selectedTeamFact
              ? `${snapshot.selectedTeamFact.deliveredIssues}/${snapshot.selectedTeamFact.committedIssues}`
              : "No data"
          }
          detail="Selected sprint issues delivered vs committed"
          icon="check"
          tone="green"
        />
        <StatCard
          label="Story points"
          value={
            snapshot.selectedTeamFact
              ? `${snapshot.selectedTeamFact.deliveredStoryPoints}/${snapshot.selectedTeamFact.committedStoryPoints}`
              : "No data"
          }
          detail="Delivered vs committed story points"
          icon="points"
          tone="violet"
        />
        <StatCard
          label="Delivery ratio"
          value={snapshot.selectedTeamFact?.deliveryRatio ?? "No data"}
          detail="Percentage of selected sprint issues that reached Done"
          icon="ratio"
          tone="teal"
        />
        <StatCard
          label="Point conversion"
          value={snapshot.selectedTeamFact?.pointConversion ?? "No data"}
          detail="Percentage of committed story points delivered"
          icon="target"
          tone="amber"
        />
        <StatCard
          label="Handoffs"
          value={String(snapshot.selectedTeamFact?.handoffIssues ?? 0)}
          detail="Issues reassigned after work started"
          icon="handoff"
          tone="rose"
        />
        <StatCard
          label="Lead execution"
          value={primaryFact?.avgLeadExecutionLabel ?? "No data"}
          detail="Lead execution time: first In Progress to final terminal status"
          icon="clock"
          tone="slate"
        />
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Recent Sprints</p>
            <h2>Active sprint and previous two</h2>
          </div>
          <p className="panel-meta">Committed vs delivered story points with delivery ratio trend.</p>
        </div>
        {snapshot.trendFacts.length === 0 ? (
          <p className="hint">No aggregated sprint facts yet.</p>
        ) : (
          <div className="trend-grid">
            {snapshot.trendFacts.map((fact) => {
              const committedWidth = Math.max(
                4,
                Math.round((fact.committedStoryPoints / maxCommittedPoints) * 100)
              );
              const deliveredWidth = Math.max(
                4,
                Math.round((fact.deliveredStoryPoints / maxCommittedPoints) * 100)
              );

              return (
                <article
                  key={fact.id}
                  className={`trend-card ${fact.sprintState === "active" ? "active" : ""}`}
                >
                  <div className="trend-card-header">
                    <div>
                      <strong>{fact.sprintName}</strong>
                      <span>{fact.sprintState}</span>
                    </div>
                    <span className="status-pill neutral">{fact.deliveryRatio}% delivered</span>
                  </div>
                  <div className="bar-stack">
                    <div className="bar-row">
                      <span>Committed</span>
                      <div className="bar-track">
                        <div className="bar-fill committed" style={{ width: `${committedWidth}%` }} />
                      </div>
                      <strong>{fact.committedStoryPoints} SP</strong>
                    </div>
                    <div className="bar-row">
                      <span>Delivered</span>
                      <div className="bar-track">
                        <div className="bar-fill delivered" style={{ width: `${deliveredWidth}%` }} />
                      </div>
                      <strong>{fact.deliveredStoryPoints} SP</strong>
                    </div>
                  </div>
                  <div className="trend-card-footer">
                    <span>{fact.deliveredIssues}/{fact.committedIssues} issues</span>
                    <span>{fact.handoffIssues} handoffs</span>
                    <span>{fact.avgLeadExecutionLabel} lead</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Team Roster</p>
            <h2>{selectedSprintName} team view</h2>
          </div>
          <p className="panel-meta">Select a member to open their issue-level breakdown.</p>
        </div>
        <div className="table-wrap roster-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Delivery</th>
                <th>Story points</th>
                <th>Capacity</th>
                <th>Flow</th>
                <th>Ownership</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.memberFacts.length === 0 ? (
                <tr>
                  <td colSpan={6}>No member analytics yet.</td>
                </tr>
              ) : (
                snapshot.memberFacts.map((fact) => {
                  const assignedIssues = fact.assignedIssues;
                  const completionRatio =
                    assignedIssues > 0
                      ? Math.round((fact.completedIssues / assignedIssues) * 100)
                      : 0;

                  return (
                    <tr key={fact.id}>
                      <td>
                        <Link
                          className="member-link member-profile"
                          href={`/members/${encodeURIComponent(fact.accountId)}${sprintQuery}`}
                        >
                          <span className="member-avatar" aria-hidden="true">
                            {fact.displayName.slice(0, 1)}
                          </span>
                          <span>
                            <strong>{fact.displayName}</strong>
                            <small>Open detail</small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <div className="metric-stack">
                          <strong>{fact.completedIssues}/{assignedIssues}</strong>
                          <div className="mini-track">
                            <span style={{ width: `${completionRatio}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="metric-stack">
                          <strong>{fact.assignedStoryPoints} assigned</strong>
                          <span>{fact.deliveredStoryPoints} delivered</span>
                        </div>
                      </td>
                      <td>{fact.capacityDays != null ? `${fact.capacityDays}d` : "N/A"}</td>
                      <td>
                        <div className="metric-stack">
                          <strong>{fact.avgLeadExecutionLabel}</strong>
                          <span>{fact.avgActiveWorkLabel} active</span>
                        </div>
                      </td>
                      <td>
                        {fact.notCompletedIssues > 0 ? (
                          <span className="status-pill warning">
                            {fact.notCompletedIssues} not completed
                          </span>
                        ) : (
                          <span className="status-pill available">Stable</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
