import { prisma } from "@/lib/prisma";
import { normalizeDisplayName } from "@/lib/team-members";

export function minutesToLabel(value: number | null | undefined) {
  if (value == null) {
    return "Not enough data";
  }

  const hours = value / 60;

  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }

  return `${(hours / 24).toFixed(1)}d`;
}

function ratioLabel(numerator: number, denominator: number) {
  if (denominator === 0) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function ratioValue(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

function resolveCurrentSprint<
  T extends {
    startedAt: Date | null;
    endedAt: Date | null;
    state?: string;
  }
>(sprints: T[]) {
  const active = sprints.find((sprint) => sprint.state === "active");

  if (active) {
    return active;
  }

  const now = new Date();
  const byDate = sprints.find((sprint) => {
    if (!sprint.startedAt || !sprint.endedAt) {
      return false;
    }

    return sprint.startedAt <= now && now <= sprint.endedAt;
  });

  if (byDate) {
    return byDate;
  }

  return sprints[0] ?? null;
}

async function loadSprintContext(selectedSprintId?: string) {
  const sprints = await prisma.sprint.findMany({
    orderBy: [{ startedAt: "desc" }, { importedAt: "desc" }],
    include: {
      settings: true
    }
  });

  const sprintMap = new Map(sprints.map((sprint) => [sprint.id, sprint.name]));
  const currentSprint = resolveCurrentSprint(sprints);
  const selectedSprint =
    sprints.find((sprint) => sprint.id === selectedSprintId) ?? currentSprint ?? null;

  return {
    sprints,
    sprintMap,
    currentSprint,
    selectedSprint
  };
}

function buildInsights(input: {
  selectedSprint: { name: string; state: string } | null;
  teamFact:
    | {
        committedIssues: number;
        deliveredIssues: number;
        committedStoryPoints: number;
        deliveredStoryPoints: number;
        handoffIssues: number;
      }
    | null;
  memberFacts: Array<{
    displayName: string;
    deliveredStoryPoints: number;
    completedIssues: number;
    notCompletedIssues: number;
  }>;
}) {
  const insights: Array<{ label: string; value: string; detail: string }> = [];

  if (!input.selectedSprint) {
    return insights;
  }

  if (input.selectedSprint.state === "future") {
    insights.push({
      label: "Planning posture",
      value: "Future sprint",
      detail: "Use this view to validate roster coverage and planned story points before work starts."
    });
  }

  if (input.teamFact) {
    insights.push({
      label: "Delivery ratio",
      value: ratioLabel(input.teamFact.deliveredIssues, input.teamFact.committedIssues),
      detail: `${input.teamFact.deliveredIssues}/${input.teamFact.committedIssues} issues reached Done in the selected sprint.`
    });

    insights.push({
      label: "Point conversion",
      value: ratioLabel(
        input.teamFact.deliveredStoryPoints,
        input.teamFact.committedStoryPoints
      ),
      detail: `${input.teamFact.deliveredStoryPoints}/${input.teamFact.committedStoryPoints} committed story points were delivered.`
    });

    insights.push({
      label: "Handoffs",
      value: String(input.teamFact.handoffIssues),
      detail: "Stories reassigned after work started. These deserve review because ownership changed mid-stream."
    });
  }

  const topDriver = [...input.memberFacts]
    .filter((member) => member.deliveredStoryPoints > 0)
    .sort((a, b) => b.deliveredStoryPoints - a.deliveredStoryPoints)[0];

  if (topDriver) {
    insights.push({
      label: "Top delivered points",
      value: `${topDriver.displayName}`,
      detail: `${topDriver.deliveredStoryPoints} delivered story points across ${topDriver.completedIssues} completed issues.`
    });
  }

  const handoffRisk = [...input.memberFacts]
    .filter((member) => member.notCompletedIssues > 0)
    .sort((a, b) => b.notCompletedIssues - a.notCompletedIssues)[0];

  if (handoffRisk) {
    insights.push({
      label: "Handoff watch",
      value: handoffRisk.displayName,
      detail: `${handoffRisk.notCompletedIssues} issues started here but finished elsewhere.`
    });
  }

  return insights.slice(0, 4);
}

export async function getDashboardSnapshot(selectedSprintId?: string) {
  const [config, sprintCount, issueCount, teamCount, allFacts, sprintContext] =
    await Promise.all([
      prisma.jiraSyncConfig.findFirst(),
      prisma.sprint.count(),
      prisma.jiraIssue.count(),
      prisma.teamMember.count({ where: { active: true } }),
      prisma.teamSprintFact.findMany({
        orderBy: { updatedAt: "desc" }
      }),
      loadSprintContext(selectedSprintId)
    ]);

  const { currentSprint, selectedSprint, sprintMap, sprints } = sprintContext;
  const factMap = new Map(allFacts.map((fact) => [fact.sprintId, fact]));
  const currentSprintIndex = currentSprint
    ? sprints.findIndex((sprint) => sprint.id === currentSprint.id)
    : -1;
  const trendSprints =
    currentSprintIndex >= 0
      ? sprints.slice(currentSprintIndex, currentSprintIndex + 3)
      : sprints.slice(0, 3);

  const [selectedTeamFact, selectedMemberFacts, selectedIssueLinks] = selectedSprint
    ? await Promise.all([
        prisma.teamSprintFact.findUnique({
          where: { sprintId: selectedSprint.id }
        }),
        prisma.memberSprintFact.findMany({
          where: { sprintId: selectedSprint.id },
          orderBy: [{ deliveredStoryPoints: "desc" }, { displayName: "asc" }]
        }),
        prisma.jiraIssueSprint.findMany({
          where: {
            sprintId: selectedSprint.id,
            isLastSprint: true
          },
          include: {
            issue: true
          }
        })
      ])
    : [null, [], []];

  const assignmentMap = new Map<
    string,
    {
      assignedIssues: number;
      assignedStoryPoints: number;
    }
  >();

  for (const link of selectedIssueLinks) {
    const accountId = link.issue.finalAssigneeId;

    if (!accountId) {
      continue;
    }

    const assignment = assignmentMap.get(accountId) ?? {
      assignedIssues: 0,
      assignedStoryPoints: 0
    };

    assignment.assignedIssues += 1;
    assignment.assignedStoryPoints += link.issue.storyPointsLatest ?? 0;
    assignmentMap.set(accountId, assignment);
  }

  const mappedMemberFacts = selectedMemberFacts.map((fact) => ({
    ...fact,
    assignedIssues: assignmentMap.get(fact.accountId)?.assignedIssues ?? 0,
    assignedStoryPoints: assignmentMap.get(fact.accountId)?.assignedStoryPoints ?? 0,
    displayName: normalizeDisplayName(fact.displayName),
    sprintName: sprintMap.get(fact.sprintId) ?? fact.sprintId,
    avgLeadExecutionLabel: minutesToLabel(fact.avgLeadExecutionMinutes),
    avgActiveWorkLabel: minutesToLabel(fact.avgActiveWorkMinutes)
  }));

  const trendFacts = trendSprints
    .map((sprint) => {
      const fact = factMap.get(sprint.id);

      if (!fact) {
        return null;
      }

      return {
        ...fact,
        sprintName: sprint.name,
        sprintState: sprint.state,
        deliveryRatio: ratioValue(fact.deliveredIssues, fact.committedIssues),
        pointConversion: ratioValue(
          fact.deliveredStoryPoints,
          fact.committedStoryPoints
        ),
        avgLeadExecutionLabel: minutesToLabel(fact.avgLeadExecutionMinutes),
        avgActiveWorkLabel: minutesToLabel(fact.avgActiveWorkMinutes)
      };
    })
    .filter((fact): fact is NonNullable<typeof fact> => fact != null);

  const selectedDeliveryRatio = selectedTeamFact
    ? ratioLabel(selectedTeamFact.deliveredIssues, selectedTeamFact.committedIssues)
    : "No data";
  const selectedPointConversion = selectedTeamFact
    ? ratioLabel(selectedTeamFact.deliveredStoryPoints, selectedTeamFact.committedStoryPoints)
    : "No data";

  return {
    config,
    issueCount,
    sprintCount,
    teamCount,
    currentSprint,
    selectedSprint,
    sprints: sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state
    })),
    selectedTeamFact: selectedTeamFact
      ? {
          ...selectedTeamFact,
          sprintName: sprintMap.get(selectedTeamFact.sprintId) ?? selectedTeamFact.sprintId,
          deliveryRatio: selectedDeliveryRatio,
          pointConversion: selectedPointConversion,
          avgLeadExecutionLabel: minutesToLabel(selectedTeamFact.avgLeadExecutionMinutes),
          avgActiveWorkLabel: minutesToLabel(selectedTeamFact.avgActiveWorkMinutes)
        }
      : null,
    trendFacts,
    memberFacts: mappedMemberFacts,
    insights: buildInsights({
      selectedSprint,
      teamFact: selectedTeamFact,
      memberFacts: mappedMemberFacts
    })
  };
}

function issueOwnershipRole(
  issue: {
    originalAssigneeId: string | null;
    finalAssigneeId: string | null;
    finalDoneAt: Date | null;
    finalAbandonedAt: Date | null;
  },
  accountId: string
) {
  const isOriginal = issue.originalAssigneeId === accountId;
  const isFinal = issue.finalAssigneeId === accountId;

  if (isOriginal && isFinal) {
    return issue.finalDoneAt ? "Owned to done" : issue.finalAbandonedAt ? "Owned then abandoned" : "Current owner";
  }

  if (isFinal) {
    return issue.finalDoneAt ? "Completed after handoff" : "Took over ownership";
  }

  if (isOriginal) {
    return "Started here, finished elsewhere";
  }

  return "Involved";
}

function terminalDateLabel(issue: { finalDoneAt: Date | null; finalAbandonedAt: Date | null }) {
  const terminal = issue.finalDoneAt ?? issue.finalAbandonedAt;
  return terminal ? terminal.toLocaleDateString() : "Open";
}

function jiraIssueUrl(issueKey: string) {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/browse/${issueKey}`;
}

function statusTone(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "done") {
    return "available";
  }

  if (normalized === "abandoned") {
    return "warning";
  }

  if (normalized === "in progress") {
    return "balanced";
  }

  return "neutral";
}

export async function getMemberDetailSnapshot(accountId: string, selectedSprintId?: string) {
  const [member, sprintContext] = await Promise.all([
    prisma.teamMember.findUnique({
      where: { accountId }
    }),
    loadSprintContext(selectedSprintId)
  ]);

  if (!member) {
    return null;
  }

  const { currentSprint, selectedSprint, sprintMap, sprints } = sprintContext;

  const [memberFact, issueLinks] = selectedSprint
    ? await Promise.all([
        prisma.memberSprintFact.findUnique({
          where: {
            sprintId_accountId: {
              sprintId: selectedSprint.id,
              accountId
            }
          }
        }),
        prisma.jiraIssueSprint.findMany({
          where: {
            sprintId: selectedSprint.id,
            isLastSprint: true,
            issue: {
              OR: [
                { originalAssigneeId: accountId },
                { finalAssigneeId: accountId }
              ]
            }
          },
          include: {
            issue: true
          },
          orderBy: [{ issue: { storyPointsLatest: "desc" } }, { issue: { key: "asc" } }]
        })
      ])
    : [null, []];

  const issues = issueLinks.map((link) => ({
    id: link.issue.id,
    key: link.issue.key,
    summary: link.issue.summary,
    jiraUrl: jiraIssueUrl(link.issue.key),
    currentStatus: link.issue.currentStatus,
    statusTone: statusTone(link.issue.currentStatus),
    storyPointsLatest: link.issue.storyPointsLatest ?? 0,
    role: issueOwnershipRole(link.issue, accountId),
    leadExecutionLabel: minutesToLabel(link.issue.leadExecutionMinutes),
    startedAt: link.issue.firstInProgressAt?.toLocaleDateString() ?? "Not started",
    terminalAt: terminalDateLabel(link.issue)
  }));

  return {
    member: {
      ...member,
      displayName: normalizeDisplayName(member.displayName)
    },
    currentSprint,
    selectedSprint,
    sprints: sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state
    })),
    stats: memberFact
      ? {
          ...memberFact,
          displayName: normalizeDisplayName(memberFact.displayName),
          sprintName: sprintMap.get(memberFact.sprintId) ?? memberFact.sprintId,
          avgLeadExecutionLabel: minutesToLabel(memberFact.avgLeadExecutionMinutes),
          avgActiveWorkLabel: minutesToLabel(memberFact.avgActiveWorkMinutes)
        }
      : null,
    issues
  };
}
