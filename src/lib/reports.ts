import { getCapacitySnapshot } from "@/lib/capacity";
import { minutesToLabel } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { normalizeDisplayName } from "@/lib/team-members";

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

function formatDelta(delta: number, suffix = "pp") {
  if (delta === 0) {
    return `0${suffix}`;
  }

  return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
}

function formatSignedDayDelta(value: number) {
  if (value === 0) {
    return "0.0d";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}d`;
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString() : "Unknown";
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

function describeSprintProgress(sprint: {
  state: string;
  startedAt: Date | null;
  endedAt: Date | null;
}) {
  if (sprint.state === "future") {
    return {
      label: "Future sprint",
      detail: "Sprint has not started yet."
    };
  }

  if (!sprint.startedAt || !sprint.endedAt) {
    return {
      label: sprint.state === "closed" ? "Closed sprint" : "Live sprint",
      detail: "Sprint dates are incomplete in Jira."
    };
  }

  const now = Date.now();
  const startedAt = sprint.startedAt.getTime();
  const endedAt = sprint.endedAt.getTime();
  const totalDuration = Math.max(endedAt - startedAt, 1);
  const elapsedRatio = Math.min(Math.max((now - startedAt) / totalDuration, 0), 1);
  const elapsedPercent = Math.round(elapsedRatio * 100);

  if (sprint.state === "closed" || now >= endedAt) {
    return {
      label: "100% elapsed",
      detail: `Sprint window ran from ${formatDate(sprint.startedAt)} to ${formatDate(sprint.endedAt)}.`
    };
  }

  return {
    label: `${elapsedPercent}% elapsed`,
    detail: `Sprint window runs from ${formatDate(sprint.startedAt)} to ${formatDate(sprint.endedAt)}.`
  };
}

function buildNarrativeList(items: string[]) {
  return items.filter(Boolean).slice(0, 5);
}

export async function getReportsSnapshot(selectedSprintId?: string) {
  const [sprints, capacitySnapshot] = await Promise.all([
    prisma.sprint.findMany({
      orderBy: [{ startedAt: "desc" }, { importedAt: "desc" }]
    }),
    getCapacitySnapshot(selectedSprintId)
  ]);

  const currentSprint = resolveCurrentSprint(sprints);
  const selectedSprint =
    sprints.find((sprint) => sprint.id === selectedSprintId) ?? currentSprint ?? null;

  if (!selectedSprint) {
    return {
      currentSprint: null,
      selectedSprint: null,
      sprints: [],
      stats: null,
      midSprint: null,
      retrospective: null,
      memberCallouts: []
    };
  }

  const selectedSprintIndex = sprints.findIndex((sprint) => sprint.id === selectedSprint.id);
  const previousSprint =
    selectedSprintIndex >= 0
      ? sprints.slice(selectedSprintIndex + 1).find((sprint) => sprint.state !== "future") ?? null
      : null;

  const [selectedTeamFact, previousTeamFact, selectedMemberFacts, selectedIssueLinks] =
    await Promise.all([
      prisma.teamSprintFact.findUnique({
        where: { sprintId: selectedSprint.id }
      }),
      previousSprint
        ? prisma.teamSprintFact.findUnique({
            where: { sprintId: previousSprint.id }
          })
        : Promise.resolve(null),
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
    ]);

  if (!selectedTeamFact) {
    return {
      currentSprint,
      selectedSprint,
      sprints: sprints.map((sprint) => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state
      })),
      stats: null,
      midSprint: null,
      retrospective: null,
      memberCallouts: []
    };
  }

  const sprintParticipantIds = new Set<string>();
  let openIssues = 0;
  let doneIssues = 0;
  let abandonedIssues = 0;
  let bugCount = 0;
  let storyCount = 0;

  for (const link of selectedIssueLinks) {
    if (link.issue.originalAssigneeId) {
      sprintParticipantIds.add(link.issue.originalAssigneeId);
    }

    if (link.issue.finalAssigneeId) {
      sprintParticipantIds.add(link.issue.finalAssigneeId);
    }

    const normalizedType = link.issue.issueType.trim().toLowerCase();
    if (normalizedType === "bug") {
      bugCount += 1;
    } else if (normalizedType === "story") {
      storyCount += 1;
    }

    if (link.issue.finalDoneAt) {
      doneIssues += 1;
    } else if (link.issue.finalAbandonedAt) {
      abandonedIssues += 1;
    } else {
      openIssues += 1;
    }
  }

  const memberFacts = selectedMemberFacts
    .filter((fact) => sprintParticipantIds.has(fact.accountId))
    .map((fact) => ({
      ...fact,
      displayName: normalizeDisplayName(fact.displayName),
      avgLeadExecutionLabel: minutesToLabel(fact.avgLeadExecutionMinutes),
      avgActiveWorkLabel: minutesToLabel(fact.avgActiveWorkMinutes)
    }));

  const deliveryRatio = ratioValue(
    selectedTeamFact.deliveredIssues,
    selectedTeamFact.committedIssues
  );
  const pointConversion = ratioValue(
    selectedTeamFact.deliveredStoryPoints,
    selectedTeamFact.committedStoryPoints
  );
  const previousDeliveryRatio = previousTeamFact
    ? ratioValue(previousTeamFact.deliveredIssues, previousTeamFact.committedIssues)
    : null;
  const previousPointConversion = previousTeamFact
    ? ratioValue(previousTeamFact.deliveredStoryPoints, previousTeamFact.committedStoryPoints)
    : null;
  const deliveryDelta =
    previousDeliveryRatio == null ? null : deliveryRatio - previousDeliveryRatio;
  const pointDelta =
    previousPointConversion == null ? null : pointConversion - previousPointConversion;
  const progress = describeSprintProgress(selectedSprint);
  const capacitySummary = capacitySnapshot.summary;
  const overCapacityMembers = capacitySnapshot.members.filter((member) => member.capacityGap < 0);
  const balancedMembers = capacitySnapshot.members.filter(
    (member) => member.capacityGap >= 0 && member.capacityGap <= 1
  );
  const topFinisher = [...memberFacts]
    .filter((member) => member.deliveredStoryPoints > 0)
    .sort((a, b) => b.deliveredStoryPoints - a.deliveredStoryPoints)[0];
  const estimationLead = [...memberFacts]
    .filter((member) => member.estimatorDeliveredPoints > 0)
    .sort((a, b) => b.estimatorDeliveredPoints - a.estimatorDeliveredPoints)[0];
  const handoffWatch = [...memberFacts]
    .filter((member) => member.notCompletedIssues > 0)
    .sort((a, b) => b.notCompletedIssues - a.notCompletedIssues)[0];
  const loadWatch = [...capacitySnapshot.members]
    .filter((member) => member.assignedStoryPoints > 0)
    .sort((a, b) => a.capacityGap - b.capacityGap)[0];

  const stats = {
    progressLabel: progress.label,
    progressDetail: progress.detail,
    deliveryRatioLabel: ratioLabel(
      selectedTeamFact.deliveredIssues,
      selectedTeamFact.committedIssues
    ),
    pointConversionLabel: ratioLabel(
      selectedTeamFact.deliveredStoryPoints,
      selectedTeamFact.committedStoryPoints
    ),
    openIssues,
    doneIssues,
    abandonedIssues,
    bugCount,
    storyCount,
    deliveryDeltaLabel:
      deliveryDelta == null ? "No comparison" : formatDelta(deliveryDelta),
    pointDeltaLabel: pointDelta == null ? "No comparison" : formatDelta(pointDelta),
    scopeAddedIssues: selectedTeamFact.scopeAddedIssues,
    spilloverIssues: selectedTeamFact.spilloverIssues,
    handoffIssues: selectedTeamFact.handoffIssues,
    capacityGapLabel: capacitySummary
      ? formatSignedDayDelta(capacitySummary.totalGap)
      : "No capacity plan",
    capacityPosture:
      capacitySummary == null
        ? "No manual capacity saved for this sprint yet."
        : capacitySummary.totalGap < 0
          ? `${Math.abs(capacitySummary.totalGap).toFixed(1)}d over planned capacity.`
          : `${capacitySummary.totalGap.toFixed(1)}d still available in the current plan.`,
    topDriverDetail: topFinisher
      ? `${topFinisher.displayName} delivered ${topFinisher.deliveredStoryPoints} SP across ${topFinisher.completedIssues} completed issues.`
      : "No delivery leader stands out yet.",
    previousSprintName: previousSprint?.name ?? null
  };

  const midSprintHighlights =
    selectedSprint.state === "future"
      ? buildNarrativeList([
          `${selectedSprint.name} is still in planning mode, so use this page to sanity-check roster shape before kickoff.`,
          capacitySummary
            ? `${capacitySnapshot.members.length} sprint participants are already visible from current ownership data.`
            : "Capacity has not been saved yet, so planning load has no manual baseline."
        ])
      : buildNarrativeList([
          `${selectedTeamFact.deliveredIssues}/${selectedTeamFact.committedIssues} committed issues are done, with ${selectedTeamFact.deliveredStoryPoints}/${selectedTeamFact.committedStoryPoints} committed story points converted.`,
          `${openIssues} issues are still open in the sprint, while ${selectedTeamFact.scopeAddedIssues} issues were added after sprint start.`,
          capacitySummary
            ? `Capacity model currently shows ${formatSignedDayDelta(capacitySummary.totalGap)} against the assigned reference workload.`
            : "Capacity has not been entered yet, so load-vs-capacity is still blind.",
          topFinisher
            ? `${topFinisher.displayName} is leading delivered points so far with ${topFinisher.deliveredStoryPoints} SP.`
            : "",
          balancedMembers.length > 0
            ? `${balancedMembers.length} members are within 1 day of their reference load, which usually indicates a realistic plan.`
            : ""
        ]);

  const midSprintRisks = buildNarrativeList([
    selectedTeamFact.handoffIssues > 0
      ? `${selectedTeamFact.handoffIssues} issues changed ownership after work started, so review why work moved and whether pairing or clearer ownership would reduce churn.`
      : "Ownership churn is currently low, which reduces coordination overhead.",
    overCapacityMembers.length > 0
      ? `${overCapacityMembers.length} members are overloaded in the capacity view; the tightest gap is ${overCapacityMembers[0]?.displayName} at ${overCapacityMembers[0]?.gapLabel}.`
      : "No members are currently over the planned capacity baseline.",
    capacitySummary && capacitySummary.unassignedIssues > 0
      ? `${capacitySummary.unassignedIssues} issues are still unassigned in this sprint, representing ${capacitySummary.unassignedStoryPoints} story points with unclear ownership.`
      : "",
    capacitySummary && capacitySummary.splitRequiredIssues > 0
      ? `${capacitySummary.splitRequiredIssues} issues are above 13 story points and should be split before they distort delivery forecasting.`
      : "",
    selectedTeamFact.spilloverIssues > 0
      ? `${selectedTeamFact.spilloverIssues} issues are counted as spillover, so carry-over pressure is already visible in this sprint.`
      : ""
  ]);

  const midSprintActions = buildNarrativeList([
    overCapacityMembers.length > 0
      ? `Rebalance work away from ${overCapacityMembers[0]?.displayName} or lower the sprint commitment by at least ${Math.abs(overCapacityMembers[0]?.capacityGap ?? 0).toFixed(1)} reference days.`
      : "Keep current ownership stable and focus on finishing started work instead of introducing new scope.",
    selectedTeamFact.scopeAddedIssues > 0
      ? `Challenge the ${selectedTeamFact.scopeAddedIssues} scope additions and mark which ones are truly mandatory for this sprint.`
      : "Protect the sprint boundary and keep new work out unless it displaces lower-priority scope.",
    selectedTeamFact.handoffIssues > 0
      ? "Use standup to confirm single-threaded ownership for items already in progress."
      : "Continue keeping ownership direct so progress does not depend on handoffs.",
    capacitySummary && capacitySummary.unassignedIssues > 0
      ? "Assign every in-sprint item to a visible owner before the next checkpoint."
      : ""
  ]);

  const retrospectiveHighlights = buildNarrativeList([
    `${selectedSprint.name} closed with ${selectedTeamFact.deliveredIssues}/${selectedTeamFact.committedIssues} committed issues delivered and ${selectedTeamFact.deliveredStoryPoints}/${selectedTeamFact.committedStoryPoints} committed story points converted.`,
    deliveryDelta != null && stats.previousSprintName
      ? `Compared with ${stats.previousSprintName}, delivery ratio moved ${formatDelta(deliveryDelta)} and point conversion moved ${formatDelta(pointDelta ?? 0)}.`
      : "No previous sprint comparison is available yet.",
    topFinisher
      ? `${topFinisher.displayName} finished as the top delivery driver with ${topFinisher.deliveredStoryPoints} SP.`
      : "",
    estimationLead
      ? `${estimationLead.displayName} estimated the most delivered scope at ${estimationLead.estimatorDeliveredPoints} SP.`
      : ""
  ]);

  const retrospectiveRisks = buildNarrativeList([
    selectedTeamFact.handoffIssues > 0
      ? `${selectedTeamFact.handoffIssues} issues were handed off after work began, which is a strong candidate for retro discussion.`
      : "Ownership stayed relatively stable through the sprint.",
    selectedTeamFact.scopeAddedIssues > 0
      ? `${selectedTeamFact.scopeAddedIssues} issues were added mid-sprint; that should be reviewed against planning discipline and interrupt policy.`
      : "Scope stayed mostly stable after the sprint started.",
    selectedTeamFact.spilloverIssues > 0
      ? `${selectedTeamFact.spilloverIssues} issues spilled into this sprint, so carry-over pressure needs root-cause analysis.`
      : "Carry-over from previous sprint was limited.",
    handoffWatch
      ? `${handoffWatch.displayName} had ${handoffWatch.notCompletedIssues} issues started here but finished elsewhere.`
      : "",
    capacitySummary
      ? `Capacity plan ended at ${formatSignedDayDelta(capacitySummary.totalGap)} against the reference workload.`
      : "No manual capacity baseline was saved, so planning accuracy cannot be reviewed."
  ]);

  const retrospectiveActions = buildNarrativeList([
    selectedTeamFact.handoffIssues > 0
      ? "Define one owner per story from start to finish unless the handoff is intentionally planned."
      : "Keep the same ownership model next sprint because it minimized churn.",
    capacitySummary && capacitySummary.splitRequiredIssues > 0
      ? "Break down oversized items during planning so the board carries fewer 13+ point tickets."
      : "Preserve the current sizing discipline; there were no oversized items flagged by the capacity model.",
    selectedTeamFact.scopeAddedIssues > 0
      ? "Log why each mid-sprint addition entered the sprint and decide which triggers are acceptable."
      : "Keep using the current intake discipline because scope stayed contained.",
    loadWatch
      ? `Review whether ${loadWatch.displayName} carried too much of the sprint load relative to the rest of the team.`
      : ""
  ]);

  const midSprintSummary =
    selectedSprint.state === "future"
      ? `${selectedSprint.name} has not started yet. Use this draft to review roster balance, oversized tickets, and missing ownership before kickoff.`
      : `${selectedSprint.name} is currently ${progress.label.toLowerCase()}. Delivery stands at ${stats.deliveryRatioLabel} for issues and ${stats.pointConversionLabel} for story points, with ${openIssues} items still open.`;

  const retrospectiveSummary =
    selectedSprint.state === "closed"
      ? `${selectedSprint.name} is closed. This draft focuses the retro on delivery conversion, ownership churn, and whether the manual capacity plan matched actual sprint load.`
      : `${selectedSprint.name} is not closed yet, so treat this retrospective as an evolving draft rather than a final sprint readout.`;

  const midSprintExport = [
    `Mid-sprint report: ${selectedSprint.name}`,
    "",
    `Status: ${progress.label}`,
    `Delivery: ${selectedTeamFact.deliveredIssues}/${selectedTeamFact.committedIssues} issues (${stats.deliveryRatioLabel})`,
    `Story points: ${selectedTeamFact.deliveredStoryPoints}/${selectedTeamFact.committedStoryPoints} (${stats.pointConversionLabel})`,
    `Scope added: ${selectedTeamFact.scopeAddedIssues}`,
    `Handoffs: ${selectedTeamFact.handoffIssues}`,
    `Capacity posture: ${stats.capacityPosture}`,
    "",
    "Highlights:",
    ...midSprintHighlights.map((item) => `- ${item}`),
    "",
    "Risks:",
    ...midSprintRisks.map((item) => `- ${item}`),
    "",
    "Actions:",
    ...midSprintActions.map((item) => `- ${item}`)
  ].join("\n");

  const retrospectiveExport = [
    `Retrospective report: ${selectedSprint.name}`,
    "",
    `Delivery: ${selectedTeamFact.deliveredIssues}/${selectedTeamFact.committedIssues} issues (${stats.deliveryRatioLabel})`,
    `Story points: ${selectedTeamFact.deliveredStoryPoints}/${selectedTeamFact.committedStoryPoints} (${stats.pointConversionLabel})`,
    `Scope added: ${selectedTeamFact.scopeAddedIssues}`,
    `Spillover: ${selectedTeamFact.spilloverIssues}`,
    `Handoffs: ${selectedTeamFact.handoffIssues}`,
    `Capacity posture: ${stats.capacityPosture}`,
    "",
    "Highlights:",
    ...retrospectiveHighlights.map((item) => `- ${item}`),
    "",
    "Risks:",
    ...retrospectiveRisks.map((item) => `- ${item}`),
    "",
    "Actions:",
    ...retrospectiveActions.map((item) => `- ${item}`)
  ].join("\n");

  const memberCallouts = [
    topFinisher
      ? {
          label: "Top delivery driver",
          name: topFinisher.displayName,
          detail: `${topFinisher.deliveredStoryPoints} delivered SP, ${topFinisher.completedIssues} completed issues, ${topFinisher.avgLeadExecutionLabel} average lead execution.`,
          href: `/members/${encodeURIComponent(topFinisher.accountId)}?sprint=${encodeURIComponent(selectedSprint.id)}`,
          tone: "available"
        }
      : null,
    handoffWatch
      ? {
          label: "Handoff watch",
          name: handoffWatch.displayName,
          detail: `${handoffWatch.notCompletedIssues} issues started here but finished elsewhere.`,
          href: `/members/${encodeURIComponent(handoffWatch.accountId)}?sprint=${encodeURIComponent(selectedSprint.id)}`,
          tone: "warning"
        }
      : null,
    loadWatch
      ? {
          label: "Capacity watch",
          name: loadWatch.displayName,
          detail: `${loadWatch.assignedStoryPoints} assigned SP with a ${loadWatch.gapLabel} capacity gap in the planning model.`,
          href: `/members/${encodeURIComponent(loadWatch.accountId)}?sprint=${encodeURIComponent(selectedSprint.id)}`,
          tone: loadWatch.capacityGap < 0 ? "over" : "balanced"
        }
      : null
  ].filter((item): item is NonNullable<typeof item> => item != null);

  return {
    currentSprint,
    selectedSprint,
    sprints: sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state
    })),
    stats,
    midSprint: {
      badge: selectedSprint.state === "future" ? "Planning draft" : "Checkpoint draft",
      title: "Mid-sprint update",
      summary: midSprintSummary,
      highlights: midSprintHighlights,
      risks: midSprintRisks,
      actions: midSprintActions,
      exportText: midSprintExport
    },
    retrospective: {
      badge: selectedSprint.state === "closed" ? "Retro draft" : "Retro in progress",
      title: "Sprint retrospective",
      summary: retrospectiveSummary,
      highlights: retrospectiveHighlights,
      risks: retrospectiveRisks,
      actions: retrospectiveActions,
      exportText: retrospectiveExport
    },
    memberCallouts
  };
}
