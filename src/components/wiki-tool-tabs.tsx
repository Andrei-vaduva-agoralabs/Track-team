"use client";

import Link from "next/link";
import { useState } from "react";

type TabId = "overview" | "dashboard" | "capacity" | "members" | "access";

type WikiMetric = {
  label: string;
  formula?: string;
  detail: string;
};

const dashboardMetrics: WikiMetric[] = [
  {
    label: "Delivery rate",
    formula: "delivered issues / committed issues",
    detail:
      "Shows the raw sprint result as a fraction. Example: 2/50 means 2 issues reached Done out of 50 issues counted in that sprint."
  },
  {
    label: "Story points",
    formula: "delivered story points / committed story points",
    detail:
      "Shows the same sprint result in story points instead of issue count."
  },
  {
    label: "Delivery ratio",
    formula: "(delivered issues / committed issues) x 100",
    detail:
      "This is the percentage version of Delivery rate."
  },
  {
    label: "Point conversion",
    formula: "(delivered story points / committed story points) x 100",
    detail:
      "This shows how much of the committed point load was really delivered."
  },
  {
    label: "Handoffs",
    formula: "issues reassigned after work started",
    detail:
      "A handoff is counted when ownership changes after the story entered work. High handoffs usually mean weaker sprint continuity."
  },
  {
    label: "Lead execution",
    formula: "average time from first In Progress to final terminal status",
    detail:
      "The final terminal status is Done or Abandoned. This is a sprint-level speed signal."
  }
];

const rosterMetrics: WikiMetric[] = [
  {
    label: "Delivery",
    formula: "completed issues / total issues assigned to that member in the sprint",
    detail:
      "The first number is what the member owned to Done. The second number is the full issue load assigned to that person in the selected sprint."
  },
  {
    label: "Story points",
    formula: "delivered points as final owner + delivered points estimated by that member",
    detail:
      "The first line shows points the member delivered as final owner. The second line shows points on delivered work that this member estimated."
  },
  {
    label: "Flow",
    formula: "average lead execution + average active work",
    detail:
      "Lead execution measures full elapsed flow time. Active work measures only the time summed inside In Progress."
  },
  {
    label: "Ownership",
    formula: "issues started here but finished elsewhere",
    detail:
      "If a member has not completed items, it means they started under that person and ended with another owner."
  }
];

const capacityMetrics: WikiMetric[] = [
  {
    label: "Effective capacity",
    formula: "capacity days - personal days off",
    detail:
      "This is the real planning room left for a person after their own time off is removed."
  },
  {
    label: "Assigned SP",
    formula: "sum of story points on issues currently assigned to each member",
    detail:
      "Capacity planning uses the current assignee load in the selected sprint."
  },
  {
    label: "Reference load",
    formula: "assigned story points converted into reference days",
    detail:
      "The conversion uses the planning table: 1=0.125d, 2=0.5d, 3=1d, 5=3d, 8=5d, 13=20d."
  },
  {
    label: "Capacity gap",
    formula: "effective capacity - reference load",
    detail:
      "Positive means room is left. Negative means the member is probably overloaded."
  },
  {
    label: "Split required",
    formula: "count of issues above 13 story points",
    detail:
      "Stories above 13 SP should be split into smaller work according to the estimation rule."
  },
  {
    label: "Unassigned work",
    formula: "issues and story points without a current owner",
    detail:
      "This highlights sprint work that still has no assigned team member."
  }
];

const memberMetrics: WikiMetric[] = [
  {
    label: "Completed issues",
    formula: "issues this person owned to Done",
    detail:
      "This is only the work where the member is the final owner and the issue finished in Done."
  },
  {
    label: "Not completed",
    formula: "issues started by this person but finished elsewhere",
    detail:
      "This is the main ownership-break signal for a single member."
  },
  {
    label: "Delivered points",
    formula: "story points delivered as final owner",
    detail:
      "This is the member's delivery output, not just assigned scope."
  },
  {
    label: "Estimator points",
    formula: "delivered story points estimated by this member",
    detail:
      "This helps compare estimation responsibility against real delivered output."
  },
  {
    label: "Assigned Work table",
    formula: "issues where the member was original owner, final owner, or both",
    detail:
      "Each issue key opens the Jira ticket directly. Status colors help scan Done, In Progress, Abandoned, and neutral statuses like Code Review."
  },
  {
    label: "Lead time",
    formula: "time from first In Progress to final terminal state",
    detail:
      "This is shown per issue in the member detail table."
  }
];

const accessMetrics: WikiMetric[] = [
  {
    label: "WikiTool",
    detail:
      "This page is the built-in explanation layer for the platform. It is meant for quick onboarding and metric clarification."
  },
  {
    label: "Settings",
    detail:
      "Visible to admins after sign-in. This area stores Jira connection data and sync actions."
  },
  {
    label: "Backoffice",
    detail:
      "Visible only to admins in the footer. It manages internal users, roles, active status, and password resets."
  },
  {
    label: "Refresh board",
    detail:
      "This manually syncs Jira data again for the selected sprint so the dashboard refreshes with current board information."
  }
];

const tabs: Array<{ id: TabId; label: string; intro: string }> = [
  { id: "overview", label: "Overview", intro: "Start here to understand how the tool is structured." },
  { id: "dashboard", label: "Dashboard", intro: "Sprint-level metrics and the team roster." },
  { id: "capacity", label: "Capacity", intro: "How planning capacity and reference load are calculated." },
  { id: "members", label: "Member Detail", intro: "How each personal breakdown page is built." },
  { id: "access", label: "Access", intro: "How sync, settings, backoffice, and internal access work." }
];

function MetricCard({ metric }: { metric: WikiMetric }) {
  return (
    <article className="wiki-card">
      <div className="wiki-card-header">
        <h3>{metric.label}</h3>
        {metric.formula ? <code>{metric.formula}</code> : null}
      </div>
      <p>{metric.detail}</p>
    </article>
  );
}

export function WikiToolTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="wiki-tabs">
      <div className="wiki-tab-list" role="tablist" aria-label="WikiTool sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`wiki-tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.intro}</small>
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="wiki-panel">
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">How To Read The Tool</p>
              <h2>Four main areas</h2>
            </div>
            <div className="wiki-grid">
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Dashboard</h3>
                  <code>team view</code>
                </div>
                <p>Best for checking sprint health, team output, handoffs, and the member roster.</p>
              </article>
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Capacity</h3>
                  <code>planning view</code>
                </div>
                <p>Best for sprint planning. It compares manual capacity against a story-point-to-days reference.</p>
              </article>
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Member Detail</h3>
                  <code>person view</code>
                </div>
                <p>Best for understanding one member&apos;s assigned issues, ownership outcomes, and Jira-linked work.</p>
              </article>
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Setup and Backoffice</h3>
                  <code>admin view</code>
                </div>
                <p>Used by admins to connect Jira, sync data, and manage internal users and permissions.</p>
              </article>
            </div>
          </section>

          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Status Colors</p>
              <h2>Quick visual reading</h2>
            </div>
            <div className="wiki-inline-pills">
              <span className="status-pill status-pill-compact available">Done / healthy</span>
              <span className="status-pill status-pill-compact balanced">In Progress / attention</span>
              <span className="status-pill status-pill-compact warning">Abandoned / risk</span>
              <span className="status-pill status-pill-compact neutral">Neutral / review / other</span>
            </div>
            <p className="wiki-note">
              Use the pills as a fast scan layer first. Then open the member page or Jira ticket for detail.
            </p>
          </section>

          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Fast Navigation</p>
              <h2>Where to go next</h2>
            </div>
            <div className="wiki-link-row">
              <Link href="/dashboard" className="secondary-action">Open Dashboard</Link>
              <Link href="/capacity" className="secondary-action">Open Capacity</Link>
              <Link href="/setup" className="secondary-action">Open Settings</Link>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "dashboard" ? (
        <div className="wiki-panel">
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Dashboard Metrics</p>
              <h2>Selected sprint cards</h2>
            </div>
            <div className="wiki-grid">
              {dashboardMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Roster Logic</p>
              <h2>How member rows are built</h2>
            </div>
            <div className="wiki-grid">
              {rosterMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "capacity" ? (
        <div className="wiki-panel">
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Capacity Logic</p>
              <h2>Planning formulas</h2>
            </div>
            <div className="wiki-grid">
              {capacityMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Story Point Reference</p>
              <h2>Current conversion table</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SP</th>
                    <th>Reference days</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>1</td><td>0.125d</td><td>Minimum effort, a few minutes</td></tr>
                  <tr><td>2</td><td>0.5d</td><td>Minimum effort, a few hours</td></tr>
                  <tr><td>3</td><td>1d</td><td>Mild effort, around one day</td></tr>
                  <tr><td>5</td><td>3d</td><td>Moderate effort, a few days</td></tr>
                  <tr><td>8</td><td>5d</td><td>Severe effort, around one week</td></tr>
                  <tr><td>13</td><td>20d</td><td>Maximum effort, should be reviewed carefully</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "members" ? (
        <div className="wiki-panel">
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Member Detail</p>
              <h2>Personal metrics and assigned work</h2>
            </div>
            <div className="wiki-grid">
              {memberMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Issue Table</p>
              <h2>How to read each row</h2>
            </div>
            <div className="wiki-grid">
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Issue</h3>
                  <code>direct Jira link</code>
                </div>
                <p>The issue key opens the ticket in Jira. The summary stays below it for quick context.</p>
              </article>
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Role</h3>
                  <code>ownership interpretation</code>
                </div>
                <p>Labels like <code>Owned to done</code> or <code>Started here, finished elsewhere</code> explain the ownership path.</p>
              </article>
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Status</h3>
                  <code>current Jira status</code>
                </div>
                <p>The colored pill shows the current Jira status, not a custom dashboard status.</p>
              </article>
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Started and Terminal</h3>
                  <code>time anchors</code>
                </div>
                <p>Started is the first time the issue entered In Progress. Terminal is the final Done or Abandoned date. Open issues stay marked as Open.</p>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "access" ? (
        <div className="wiki-panel">
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Access And Admin</p>
              <h2>Internal use flow</h2>
            </div>
            <div className="wiki-grid">
              {accessMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>
          </section>
          <section className="wiki-section">
            <div className="wiki-section-header">
              <p className="eyebrow">Practical Rule</p>
              <h2>Who should use what</h2>
            </div>
            <div className="wiki-grid">
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Team members</h3>
                  <code>read and inspect</code>
                </div>
                <p>Use Dashboard, Member Detail, Capacity read-only, and WikiTool.</p>
              </article>
              <article className="wiki-card">
                <div className="wiki-card-header">
                  <h3>Admins</h3>
                  <code>configure and sync</code>
                </div>
                <p>Use Settings for Jira connection and sync, and Backoffice for internal access management.</p>
              </article>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
