import Link from "next/link";
import { SprintSwitcher } from "@/components/sprint-switcher";
import { StatCard } from "@/components/stat-card";
import { getReportsSnapshot } from "@/lib/reports";

export const dynamic = "force-dynamic";

type ReportBlockProps = {
  badge: string;
  title: string;
  summary: string;
  highlights: string[];
  risks: string[];
  actions: string[];
  exportText: string;
};

function ReportBlock({
  badge,
  title,
  summary,
  highlights,
  risks,
  actions,
  exportText
}: ReportBlockProps) {
  return (
    <article className="report-sheet">
      <div className="report-sheet-header">
        <div>
          <p className="eyebrow">{badge}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <p className="report-summary">{summary}</p>

      <div className="report-columns">
        <section className="report-section-block">
          <h4>Highlights</h4>
          <ul className="report-list">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="report-section-block">
          <h4>Risks</h4>
          <ul className="report-list">
            {risks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="report-section-block">
        <h4>Recommended talking points</h4>
        <ul className="report-list">
          {actions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <label className="report-output-block">
        <span>Copy-ready draft</span>
        <textarea readOnly value={exportText} rows={16} />
      </label>
    </article>
  );
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams?: Promise<{ sprint?: string }>;
}) {
  const params = await searchParams;
  const snapshot = await getReportsSnapshot(params?.sprint);

  if (!snapshot.selectedSprint) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="panel-header">
            <p className="eyebrow">Reports</p>
            <h2>No sprint data available yet</h2>
          </div>
          <p className="hero-copy">
            Import sprints and issues from Jira first, then come back here to generate
            mid-sprint and retrospective talking points.
          </p>
          <p className="panel-meta">
            <Link href="/setup">Go to setup</Link>
          </p>
        </section>
      </div>
    );
  }

  const selectedSprintName = snapshot.selectedSprint.name;
  const currentSprintName =
    snapshot.currentSprint?.name ?? snapshot.selectedSprint.name;

  if (!snapshot.stats || !snapshot.midSprint || !snapshot.retrospective) {
    return (
      <div className="page-grid">
        <section className="hero panel">
          <div className="hero-copy-block">
            <p className="eyebrow">Reports</p>
            <h2>{selectedSprintName}</h2>
            <p className="hero-copy">
              This sprint exists, but aggregated delivery facts are not ready yet.
              Run a Jira refresh first, then return here to generate report drafts.
            </p>
          </div>
          <div className="hero-focus">
            <span>Current board context</span>
            <strong>{currentSprintName}</strong>
            <SprintSwitcher
              sprints={snapshot.sprints}
              selectedSprintId={snapshot.selectedSprint.id}
              action="/reports"
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Reports</p>
          <h2>{selectedSprintName}</h2>
          <p className="hero-copy">
            Generate native sprint narratives for check-ins and retrospectives using the
            same Jira facts that power the dashboard and capacity views.
          </p>
        </div>
        <div className="hero-focus">
          <div>
            <span>Current board context</span>
            <strong>{currentSprintName}</strong>
          </div>
          <SprintSwitcher
            sprints={snapshot.sprints}
            selectedSprintId={snapshot.selectedSprint.id}
            action="/reports"
          />
          <small>{snapshot.stats.progressDetail}</small>
          <small>{snapshot.stats.capacityPosture}</small>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Sprint status"
          value={snapshot.stats.progressLabel}
          detail="Timeline posture based on Jira sprint dates"
          icon="clock"
          tone="slate"
        />
        <StatCard
          label="Delivery ratio"
          value={snapshot.stats.deliveryRatioLabel}
          detail={`Change vs previous sprint: ${snapshot.stats.deliveryDeltaLabel}`}
          icon="check"
          tone="green"
        />
        <StatCard
          label="Point conversion"
          value={snapshot.stats.pointConversionLabel}
          detail={`Change vs previous sprint: ${snapshot.stats.pointDeltaLabel}`}
          icon="target"
          tone="violet"
        />
        <StatCard
          label="Open issues"
          value={String(snapshot.stats.openIssues)}
          detail={`${snapshot.stats.doneIssues} done, ${snapshot.stats.abandonedIssues} abandoned`}
          icon="activity"
          tone="amber"
        />
        <StatCard
          label="Scope pressure"
          value={String(snapshot.stats.scopeAddedIssues)}
          detail={`${snapshot.stats.spilloverIssues} spillover issues, ${snapshot.stats.handoffIssues} handoffs`}
          icon="handoff"
          tone="rose"
        />
        <StatCard
          label="Capacity gap"
          value={snapshot.stats.capacityGapLabel}
          detail={snapshot.stats.capacityPosture}
          icon="points"
          tone="teal"
        />
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Signal Pack</p>
            <h2>What stands out in this sprint</h2>
          </div>
          <p className="panel-meta">
            Use these cards as fast context before you read the generated drafts.
          </p>
        </div>
        <div className="insight-grid">
          <article className="insight-card">
            <span>Scope mix</span>
            <strong>{snapshot.stats.storyCount} stories / {snapshot.stats.bugCount} bugs</strong>
            <p>The selected sprint currently tracks only Stories and Bugs in analytics.</p>
          </article>
          <article className="insight-card">
            <span>Top delivery signal</span>
            <strong>{snapshot.memberCallouts[0]?.name ?? "No standout yet"}</strong>
            <p>{snapshot.stats.topDriverDetail}</p>
          </article>
          <article className="insight-card">
            <span>Ownership pressure</span>
            <strong>{snapshot.stats.handoffIssues} handoffs</strong>
            <p>Ownership changes after work starts usually correlate with coordination drag.</p>
          </article>
          <article className="insight-card">
            <span>Planning posture</span>
            <strong>{snapshot.stats.capacityGapLabel}</strong>
            <p>{snapshot.stats.capacityPosture}</p>
          </article>
        </div>
      </section>

      <section className="report-grid">
        <ReportBlock {...snapshot.midSprint} />
        <ReportBlock {...snapshot.retrospective} />
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Member Callouts</p>
            <h2>People to mention in the review</h2>
          </div>
          <p className="panel-meta">
            Open the member page when one of these signals needs issue-level detail.
          </p>
        </div>
        <div className="report-callout-grid">
          {snapshot.memberCallouts.length === 0 ? (
            <article className="report-callout-card">
              <strong>No member callouts yet</strong>
              <p>Once sprint facts are available, this area will surface delivery, handoff, and capacity signals by member.</p>
            </article>
          ) : (
            snapshot.memberCallouts.map((callout) => (
              <article key={`${callout.label}-${callout.name}`} className="report-callout-card">
                <span className={`status-pill ${callout.tone}`}>{callout.label}</span>
                <strong>{callout.name}</strong>
                <p>{callout.detail}</p>
                <Link className="secondary-action" href={callout.href}>
                  Open member detail
                </Link>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
