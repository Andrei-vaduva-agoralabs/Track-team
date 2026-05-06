import { prisma } from "@/lib/prisma";
import { normalizeDisplayName } from "@/lib/team-members";
import { formatDayValue, referenceDaysForStoryPoints, STORY_POINT_REFERENCE } from "@/lib/story-points";

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

function businessDaysBetween(start: Date | null, end: Date | null) {
  if (!start || !end) {
    return 10;
  }

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);

  let days = 0;

  while (cursor <= finish) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      days += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export async function getCapacitySnapshot(selectedSprintId?: string) {
  const [teamMembers, sprints] = await Promise.all([
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" }
    }),
    prisma.sprint.findMany({
      orderBy: [{ startedAt: "desc" }, { importedAt: "desc" }],
      include: {
        settings: true,
        memberCapacities: true,
        issueLinks: {
          where: { isLastSprint: true },
          include: {
            issue: true
          }
        }
      }
    })
  ]);

  const currentSprint = resolveCurrentSprint(sprints);
  const selectedSprint =
    sprints.find((sprint) => sprint.id === selectedSprintId) ?? currentSprint ?? null;

  if (!selectedSprint) {
    return {
      currentSprint: null,
      selectedSprint: null,
      sprints: [],
      guide: STORY_POINT_REFERENCE,
      summary: null,
      members: []
    };
  }

  const sprintWorkDays =
    selectedSprint.settings?.sprintWorkDays ??
    businessDaysBetween(selectedSprint.startedAt, selectedSprint.endedAt);
  const globalDaysOff = selectedSprint.settings?.globalDaysOff ?? 0;
  const defaultCapacityDays = Math.max(sprintWorkDays - globalDaysOff, 0);

  const issues = selectedSprint.issueLinks.map((link) => link.issue);
  const assignmentMap = new Map<
    string,
    {
      assignedIssues: number;
      assignedStoryPoints: number;
      assignedReferenceDays: number;
      splitRequiredCount: number;
      unsupportedEstimateCount: number;
    }
  >();

  let unassignedIssues = 0;
  let unassignedStoryPoints = 0;
  let splitRequiredIssues = 0;

  for (const issue of issues) {
    const storyPoints = issue.storyPointsLatest ?? 0;

    if (storyPoints > 13) {
      splitRequiredIssues += 1;
    }

    if (!issue.finalAssigneeId) {
      unassignedIssues += 1;
      unassignedStoryPoints += storyPoints;
      continue;
    }

    const entry = assignmentMap.get(issue.finalAssigneeId) ?? {
      assignedIssues: 0,
      assignedStoryPoints: 0,
      assignedReferenceDays: 0,
      splitRequiredCount: 0,
      unsupportedEstimateCount: 0
    };

    entry.assignedIssues += 1;
    entry.assignedStoryPoints += storyPoints;

    const referenceDays = referenceDaysForStoryPoints(storyPoints);
    if (referenceDays == null) {
      if (storyPoints > 13) {
        entry.splitRequiredCount += 1;
      } else if (storyPoints !== 0) {
        entry.unsupportedEstimateCount += 1;
      }
    } else {
      entry.assignedReferenceDays += referenceDays;
    }

    assignmentMap.set(issue.finalAssigneeId, entry);
  }

  const members = teamMembers
    .map((member) => {
      const capacity = selectedSprint.memberCapacities.find(
        (item) => item.accountId === member.accountId
      );
      const assignment = assignmentMap.get(member.accountId);
      const capacityDays = capacity?.capacityDays ?? defaultCapacityDays;
      const personalDaysOff = capacity?.personalDaysOff ?? 0;
      const effectiveCapacityDays = Math.max(capacityDays - personalDaysOff, 0);
      const assignedReferenceDays = assignment?.assignedReferenceDays ?? 0;
      const capacityGap = effectiveCapacityDays - assignedReferenceDays;

      return {
        accountId: member.accountId,
        displayName: normalizeDisplayName(member.displayName),
        capacityDays,
        personalDaysOff,
        effectiveCapacityDays,
        assignedIssues: assignment?.assignedIssues ?? 0,
        assignedStoryPoints: assignment?.assignedStoryPoints ?? 0,
        assignedReferenceDays,
        capacityGap,
        splitRequiredCount: assignment?.splitRequiredCount ?? 0,
        unsupportedEstimateCount: assignment?.unsupportedEstimateCount ?? 0,
        capacityLabel: formatDayValue(capacityDays),
        daysOffLabel: formatDayValue(personalDaysOff),
        effectiveCapacityLabel: formatDayValue(effectiveCapacityDays),
        assignedReferenceLabel: formatDayValue(assignedReferenceDays),
        gapLabel: `${capacityGap >= 0 ? "+" : ""}${capacityGap.toFixed(1)}d`,
        loadStatus:
          capacityGap < 0 ? "over" : capacityGap <= 1 ? "balanced" : "available"
      };
    })
    .sort((a, b) => {
      if (a.capacityGap !== b.capacityGap) {
        return a.capacityGap - b.capacityGap;
      }

      return a.displayName.localeCompare(b.displayName);
    });

  const totalCapacityDays = members.reduce((sum, member) => sum + member.capacityDays, 0);
  const totalPersonalDaysOff = members.reduce((sum, member) => sum + member.personalDaysOff, 0);
  const totalEffectiveCapacityDays = members.reduce(
    (sum, member) => sum + member.effectiveCapacityDays,
    0
  );
  const totalAssignedStoryPoints = members.reduce(
    (sum, member) => sum + member.assignedStoryPoints,
    0
  );
  const totalAssignedReferenceDays = members.reduce(
    (sum, member) => sum + member.assignedReferenceDays,
    0
  );
  const totalGap = totalEffectiveCapacityDays - totalAssignedReferenceDays;

  return {
    currentSprint,
    selectedSprint,
    sprints: sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state
    })),
    guide: STORY_POINT_REFERENCE.map((item) => ({
      ...item,
      referenceDaysLabel: formatDayValue(item.referenceDays)
    })),
    summary: {
      sprintWorkDays,
      globalDaysOff,
      defaultCapacityDays,
      totalCapacityDays,
      totalPersonalDaysOff,
      totalEffectiveCapacityDays,
      totalAssignedStoryPoints,
      totalAssignedReferenceDays,
      totalGap,
      issuesInSprint: issues.length,
      unassignedIssues,
      unassignedStoryPoints,
      splitRequiredIssues,
      totalCapacityLabel: formatDayValue(totalCapacityDays),
      totalEffectiveLabel: formatDayValue(totalEffectiveCapacityDays),
      totalReferenceLabel: formatDayValue(totalAssignedReferenceDays),
      totalGapLabel: `${totalGap >= 0 ? "+" : ""}${totalGap.toFixed(1)}d`,
      sprintWorkDaysLabel: formatDayValue(sprintWorkDays),
      globalDaysOffLabel: formatDayValue(globalDaysOff)
    },
    members
  };
}
