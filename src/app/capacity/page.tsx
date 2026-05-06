import Link from "next/link";
import { SprintSwitcher } from "@/components/sprint-switcher";
import { StatCard } from "@/components/stat-card";
import { CapacityBulkInputs } from "@/components/capacity-bulk-inputs";
import { getCapacitySnapshot } from "@/lib/capacity";
import { saveCapacityAction } from "@/app/capacity/actions";
import { isCurrentUserAdmin } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function CapacityPage({
  searchParams
}: {
  searchParams?: Promise<{ sprint?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const [snapshot, isAdmin] = await Promise.all([
    getCapacitySnapshot(params?.sprint),
    isCurrentUserAdmin()
  ]);

  if (!snapshot.selectedSprint || !snapshot.summary) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="panel-header">
            <p className="eyebrow">Capacity Planning</p>
            <h2>No sprint data available yet</h2>
          </div>
          <p className="hero-copy">
            Import sprints and issues from Jira first, then come back here to configure
            sprint capacity and compare it with assigned story points.
          </p>
          <p className="panel-meta">
            <Link href="/setup">Go to setup</Link>
          </p>
        </section>
      </div>
    );
  }

  const { selectedSprint, currentSprint, summary } = snapshot;

  return (
    <div className="page-grid">
      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Capacity Planning</p>
          <h2>{selectedSprint.name}</h2>
          <p className="hero-copy">
            Set manual capacity for each team member, account for days off, and compare
            the sprint load against manually planned capacity.
          </p>
        </div>
        <div className="hero-focus">
          <span>Current board context</span>
          <strong>{currentSprint?.name ?? selectedSprint.name}</strong>
          <small>
            Primary comparison uses assigned story points translated into reference days.
            Use this before or during planning, then validate later against real delivery.
          </small>
        </div>
      </section>

      {params?.saved === "1" ? (
        <section className="feedback success">
          <strong>Capacity saved</strong>
          <p>
            Sprint settings and member capacities were stored, and the dashboard metrics
            were recalculated.
          </p>
        </section>
      ) : null}

      <section className="stats-grid">
        <StatCard
          label="Effective capacity"
          value={summary.totalEffectiveLabel}
          detail="Team capacity days after personal days off"
        />
        <StatCard
          label="Assigned SP"
          value={String(summary.totalAssignedStoryPoints)}
          detail="Story points currently assigned in the selected sprint"
        />
        <StatCard
          label="Reference load"
          value={summary.totalReferenceLabel}
          detail="Approximate days from the selected Fibonacci reference"
        />
        <StatCard
          label="Capacity gap"
          value={summary.totalGapLabel}
          detail="Positive means room left. Negative means likely overload."
        />
        <StatCard
          label="Split required"
          value={String(summary.splitRequiredIssues)}
          detail="Issues above 13 story points should be broken down"
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Sprint Scope</p>
          <h2>Pick the sprint you want to plan</h2>
        </div>
        <SprintSwitcher
          sprints={snapshot.sprints}
          selectedSprintId={selectedSprint.id}
          action="/capacity"
        />
        <div className="insight-grid">
          <article className="insight-card">
            <span>Sprint work days</span>
            <strong>{summary.sprintWorkDaysLabel}</strong>
            <p>Baseline workdays for the sprint before global holidays and per-person days off.</p>
          </article>
          <article className="insight-card">
            <span>Global days off</span>
            <strong>{summary.globalDaysOffLabel}</strong>
            <p>Shared holidays or company-wide time off applied to the whole sprint.</p>
          </article>
          <article className="insight-card">
            <span>Unassigned work</span>
            <strong>{summary.unassignedIssues}</strong>
            <p>{summary.unassignedStoryPoints} story points still have no current owner in this sprint.</p>
          </article>
          <article className="insight-card">
            <span>Issues in sprint</span>
            <strong>{summary.issuesInSprint}</strong>
            <p>All stories and bugs currently counted in the selected sprint cluster.</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Capacity Editor</p>
            <h2>Set sprint capacity by member</h2>
          </div>
          <p className="panel-meta">
            The comparison uses current assignee load in the selected sprint and translates story points into reference days.
          </p>
        </div>

        <form action={saveCapacityAction} className="page-grid">
          <input type="hidden" name="sprintId" value={selectedSprint.id} />

          <div className="capacity-settings-grid">
            <CapacityBulkInputs
              sprintWorkDays={summary.sprintWorkDays}
              globalDaysOff={summary.globalDaysOff}
              disabled={!isAdmin}
            />
            <label className="notes-field">
              Sprint notes
              <input
                name="notes"
                defaultValue={snapshot.selectedSprint.settings?.notes ?? ""}
                placeholder="Planning notes, holidays, constraints, releases"
                disabled={!isAdmin}
              />
            </label>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Capacity days</th>
                  <th>Days off</th>
                  <th>Effective</th>
                  <th>Assigned issues</th>
                  <th>Assigned SP</th>
                  <th>Reference days</th>
                  <th>Gap</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.members.map((member) => (
                  <tr key={member.accountId}>
                    <td>
                      <Link
                        className="member-link"
                        href={`/members/${encodeURIComponent(member.accountId)}?sprint=${encodeURIComponent(selectedSprint.id)}`}
                      >
                        <span>{member.displayName}</span>
                        <small>Open detail</small>
                      </Link>
                    </td>
                    <td>
                      <input
                        className="table-input"
                        name={`capacity:${member.accountId}`}
                        type="number"
                        min="0"
                        step="0.5"
                        data-member-capacity-input="true"
                        defaultValue={member.capacityDays}
                        disabled={!isAdmin}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        name={`daysOff:${member.accountId}`}
                        type="number"
                        min="0"
                        step="0.5"
                        defaultValue={member.personalDaysOff}
                        disabled={!isAdmin}
                      />
                    </td>
                    <td>{member.effectiveCapacityLabel}</td>
                    <td>{member.assignedIssues}</td>
                    <td>{member.assignedStoryPoints}</td>
                    <td>{member.assignedReferenceLabel}</td>
                    <td>
                      <span className={`status-pill ${member.loadStatus}`}>{member.gapLabel}</span>
                    </td>
                    <td>
                      <div className="flag-stack">
                        {member.splitRequiredCount > 0 ? (
                          <span className="status-pill warning">
                            {member.splitRequiredCount} over 13 SP
                          </span>
                        ) : null}
                        {member.unsupportedEstimateCount > 0 ? (
                          <span className="status-pill neutral">
                            {member.unsupportedEstimateCount} non-standard SP
                          </span>
                        ) : null}
                        {member.splitRequiredCount === 0 && member.unsupportedEstimateCount === 0 ? (
                          <span className="status-pill neutral">No flags</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin ? (
            <div className="action-row">
              <button type="submit">Save sprint capacity</button>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}
