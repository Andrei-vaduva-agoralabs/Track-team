import Link from "next/link";
import { SprintSwitcher } from "@/components/sprint-switcher";
import { getReportsSnapshot } from "@/lib/reports";

export const dynamic = "force-dynamic";

type MetricGaugeProps = {
  label: string;
  value: string;
  percent: number;
  detail: string;
  tone: "teal" | "violet" | "amber" | "slate";
};

type IssueStackProps = {
  openIssues: number;
  doneIssues: number;
  abandonedIssues: number;
};

type ReportPanelProps = {
  badge: string;
  title: string;
  summary: string;
  highlights: string[];
  risks: string[];
  actions: string[];
  exportText: string;
  tone: "mid" | "retro";
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function MetricGauge({ label, value, percent, detail, tone }: MetricGaugeProps) {
  return (
    <article className={`report-gauge report-gauge-${tone}`}>
      <div
        className="report-gauge-ring"
        style={{ ["--gauge-value" as string]: `${clampPercent(percent)}%` }}
      >
        <div className="report-gauge-core">
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      </div>
      <p>{detail}</p>
    </article>
  );
}

function IssueStack({ openIssues, doneIssues, abandonedIssues }: IssueStackProps) {
  const total = Math.max(openIssues + doneIssues + abandonedIssues, 1);

  const segments = [
    { label: "Done", value: doneIssues, className: "done" },
    { label: "Open", value: openIssues, className: "open" },
    { label: "Abandoned", value: abandonedIssues, className: "abandoned" }
  ];

  return (
    <article className="report-visual-card">
      <div className="report-card-head">
        <div>
          <p className="eyebrow">Issue State</p>
          <h3>Sprint outcome mix</h3>
        </div>
      </div>
      <div className="report-stack-bar" aria-hidden="true">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={segment.className}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="report-stack-legend">
        {segments.map((segment) => (
          <div key={segment.label} className="report-stack-item">
            <span className={`report-stack-dot ${segment.className}`} />
            <strong>{segment.value}</strong>
            <small>{segment.label}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function SignalStrip({
  title,
  metrics
}: {
  title: string;
  metrics: Array<{ label: string; value: string; tone: "teal" | "amber" | "rose" | "slate" }>;
}) {
  return (
    <article className="report-visual-card">
      <div className="report-card-head">
        <div>
          <p className="eyebrow">Signal Strip</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="report-signal-strip">
        {metrics.map((metric) => (
          <div key={metric.label} className={`report-signal-pill report-signal-${metric.tone}`}>
            <strong>{metric.value}</strong>
            <span>{metric.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ReportChipList({
  title,
  items,
  tone
}: {
  title: string;
  items: string[];
  tone: "good" | "risk" | "action";
}) {
  return (
    <section className="report-chip-section">
      <div className="report-chip-head">
        <h4>{title}</h4>
      </div>
      <div className="report-chip-list">
        {items.map((item) => (
          <article key={item} className={`report-chip report-chip-${tone}`}>
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportPanel({
  badge,
  title,
  summary,
  highlights,
  risks,
  actions,
  exportText,
  tone
}: ReportPanelProps) {
  return (
    <article className={`report-panel report-panel-${tone}`}>
      <div className="report-panel-head">
        <div>
          <p className="eyebrow">{badge}</p>
          <h3>{title}</h3>
        </div>
      </div>

      <p className="report-panel-summary">{summary}</p>

      <div className="report-chip-grid">
        <ReportChipList title="Highlights" items={highlights} tone="good" />
        <ReportChipList title="Risks" items={risks} tone="risk" />
      </div>

      <ReportChipList title="Talking points" items={actions} tone="action" />

      <details className="report-export">
        <summary>Open copy-ready narrative</summary>
        <textarea readOnly value={exportText} rows={14} />
      </details>
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
  const currentSprintName = snapshot.currentSprint?.name ?? selectedSprintName;

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
            Review the sprint through visual signals first, then use the report drafts only
            when you need a speaking narrative for check-ins or retrospectives.
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

      <section className="report-overview-grid">
        <MetricGauge
          label="Delivery"
          value={snapshot.stats.deliveryRatioLabel}
          percent={snapshot.stats.deliveryRatioValue}
          detail={`${snapshot.stats.deliveredIssues}/${snapshot.stats.committedIssues} issues converted`}
          tone="teal"
        />
        <MetricGauge
          label="Points"
          value={snapshot.stats.pointConversionLabel}
          percent={snapshot.stats.pointConversionValue}
          detail={`${snapshot.stats.deliveredStoryPoints}/${snapshot.stats.committedStoryPoints} story points converted`}
          tone="violet"
        />
        <MetricGauge
          label="Timeline"
          value={snapshot.stats.progressLabel}
          percent={snapshot.stats.progressValue}
          detail="Elapsed sprint window based on Jira dates"
          tone="slate"
        />
        <MetricGauge
          label="Capacity"
          value={snapshot.stats.capacityGapLabel}
          percent={snapshot.stats.capacityGapLabel.startsWith("-") ? 82 : 58}
          detail={snapshot.stats.capacityPosture}
          tone="amber"
        />
      </section>

      <section className="report-visual-grid">
        <IssueStack
          openIssues={snapshot.stats.openIssues}
          doneIssues={snapshot.stats.doneIssues}
          abandonedIssues={snapshot.stats.abandonedIssues}
        />
        <SignalStrip
          title="Pressure points"
          metrics={[
            { label: "Scope added", value: String(snapshot.stats.scopeAddedIssues), tone: "amber" },
            { label: "Spillover", value: String(snapshot.stats.spilloverIssues), tone: "slate" },
            { label: "Handoffs", value: String(snapshot.stats.handoffIssues), tone: "rose" },
            { label: "Story / bug mix", value: `${snapshot.stats.storyCount}/${snapshot.stats.bugCount}`, tone: "teal" }
          ]}
        />
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Member Signals</p>
            <h2>Who to mention first</h2>
          </div>
          <p className="panel-meta">
            The cards are ranked to help you move quickly into the people most worth discussing.
          </p>
        </div>
        <div className="report-member-grid">
          {snapshot.memberSpotlights.length === 0 ? (
            <article className="report-member-card">
              <strong>No member spotlight yet</strong>
              <p>Once sprint facts are ready, this area will surface the strongest individual signals.</p>
            </article>
          ) : (
            snapshot.memberSpotlights.map((member, index) => (
              <article key={member.name} className="report-member-card">
                <div className="report-member-head">
                  <span className="report-rank">#{index + 1}</span>
                  <strong>{member.name}</strong>
                </div>
                <div className="report-member-metrics">
                  <div>
                    <span>Delivered SP</span>
                    <strong>{member.deliveredStoryPoints}</strong>
                  </div>
                  <div>
                    <span>Completed</span>
                    <strong>{member.completedIssues}</strong>
                  </div>
                  <div>
                    <span>Estimated</span>
                    <strong>{member.estimatorDeliveredPoints}</strong>
                  </div>
                  <div>
                    <span>Handoffs</span>
                    <strong>{member.handoffIssues}</strong>
                  </div>
                </div>
                <div className="report-member-footer">
                  <small>{member.leadExecutionLabel} lead</small>
                  <small>{member.capacityGapLabel} capacity gap</small>
                </div>
                <Link className="secondary-action" href={member.href}>
                  Open member detail
                </Link>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="report-panel-grid">
        <ReportPanel {...snapshot.midSprint} tone="mid" />
        <ReportPanel {...snapshot.retrospective} tone="retro" />
      </section>

      <section className="panel">
        <div className="panel-header panel-header-inline">
          <div>
            <p className="eyebrow">Callouts</p>
            <h2>Explicit review prompts</h2>
          </div>
          <p className="panel-meta">
            Use these when you need quick talking anchors during planning reviews or sprint retros.
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
