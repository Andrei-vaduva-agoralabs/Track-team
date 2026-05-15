import { prisma } from "@/lib/prisma";
import { JiraApiError, jiraRequest } from "@/lib/jira/client";
import { getJiraEnv } from "@/lib/jira/config";
import { applyTeamMemberOverride, normalizeDisplayName } from "@/lib/team-members";
import type {
  JiraBoard,
  JiraField,
  JiraHistory,
  JiraIssue,
  JiraIssueSearchResults,
  JiraPaginated,
  JiraSprint,
  JiraUser
} from "@/lib/jira/types";

const ISSUE_TYPES = new Set(["Story", "Bug"]);
const IN_PROGRESS_STATUSES = new Set(["In Progress"]);
const DONE_STATUSES = new Set(["Done"]);
const ABANDONED_STATUSES = new Set(["Abandoned"]);
const TEAM_MEMBER_SYNC_MAX_AGE_MINUTES = 360;

type IssueAccumulator = {
  issue: JiraIssue;
  sprintIds: Set<string>;
};

type DerivedIssueMetrics = {
  firstInProgressAt: Date | null;
  finalDoneAt: Date | null;
  finalAbandonedAt: Date | null;
  leadExecutionMinutes: number | null;
  activeWorkMinutes: number | null;
  reopenedCount: number;
};

type SyncTrigger = "manual" | "cron" | "webhook";

type MemberAccumulator = {
  displayName: string;
  completedIssues: number;
  notCompletedIssues: number;
  abandonedIssues: number;
  deliveredStoryPoints: number;
  estimatorDeliveredPoints: number;
  ownerDeliveredPoints: number;
  leadTimes: number[];
  activeTimes: number[];
};

function toDate(value?: string | null) {
  return value ? new Date(value) : null;
}

function differenceInMinutes(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function byDateAsc(a: JiraHistory, b: JiraHistory) {
  return new Date(a.created).getTime() - new Date(b.created).getTime();
}

async function getFieldIds() {
  const fields = await jiraRequest<JiraField[]>("/rest/api/3/field");

  const sprintField = fields.find(
    (field) => field.schema?.custom === "com.pyxis.greenhopper.jira:gh-sprint"
  );
  const storyPointsField = fields.find((field) =>
    field.name.toLowerCase().includes("story point")
  );

  if (!sprintField || !storyPointsField) {
    throw new Error("Could not resolve Jira sprint or story points field ids.");
  }

  return {
    sprintFieldId: sprintField.id,
    storyPointsFieldId: storyPointsField.id
  };
}

async function syncTeamMembersFromJira(options?: { force?: boolean; maxAgeMinutes?: number }) {
  const force = options?.force ?? false;
  const maxAgeMinutes = options?.maxAgeMinutes ?? TEAM_MEMBER_SYNC_MAX_AGE_MINUTES;

  if (!force) {
    const latestTeamMember = await prisma.teamMember.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true }
    });

    if (
      latestTeamMember &&
      latestTeamMember.updatedAt.getTime() >= Date.now() - maxAgeMinutes * 60_000
    ) {
      return prisma.teamMember.count({
        where: { active: true }
      });
    }
  }

  const env = getJiraEnv();
  const users = await jiraRequest<JiraUser[]>(
    "/rest/api/3/user/assignable/search",
    {
      searchParams: {
        project: env.JIRA_PROJECT_KEY,
        maxResults: 200
      }
    }
  );

  for (const user of users) {
    const mapped = applyTeamMemberOverride(
      user.accountId,
      user.displayName,
      user.active
    );

    await prisma.teamMember.upsert({
      where: { accountId: user.accountId },
      update: {
        displayName: mapped.displayName,
        active: mapped.active,
        source: "jira-assignable"
      },
      create: {
        accountId: user.accountId,
        displayName: mapped.displayName,
        active: mapped.active,
        source: "jira-assignable"
      }
    });
  }

  return users.length;
}

async function fetchSprintIssues(
  sprintId: number,
  fields: { sprintFieldId: string; storyPointsFieldId: string }
) {
  const issues: JiraIssue[] = [];
  let startAt = 0;
  let total = 0;

  do {
    const response = await jiraRequest<JiraIssueSearchResults>(
      `/rest/agile/1.0/sprint/${sprintId}/issue`,
      {
        searchParams: {
          startAt,
          maxResults: 50,
          expand: "changelog",
          fields: [
            "summary",
            "status",
            "issuetype",
            "assignee",
            "creator",
            "reporter",
            "created",
            "updated",
            "project",
            fields.sprintFieldId,
            fields.storyPointsFieldId
          ].join(",")
        }
      }
    );

    issues.push(...response.issues);
    startAt += response.maxResults;
    total = response.total;
  } while (startAt < total);

  return issues.filter(
    (issue) =>
      ISSUE_TYPES.has(issue.fields.issuetype.name) && issue.fields.issuetype.subtask === false
  );
}

async function fetchIssueByKey(
  issueKey: string,
  fields: { sprintFieldId: string; storyPointsFieldId: string }
) {
  let issue: JiraIssue;

  try {
    issue = await jiraRequest<JiraIssue>(`/rest/api/3/issue/${issueKey}`, {
      searchParams: {
        expand: "changelog",
        fields: [
          "summary",
          "status",
          "issuetype",
          "assignee",
          "creator",
          "reporter",
          "created",
          "updated",
          "project",
          fields.sprintFieldId,
          fields.storyPointsFieldId
        ].join(",")
      }
    });
  } catch (error) {
    if (error instanceof JiraApiError && error.status === 404) {
      return null;
    }

    throw error;
  }

  if (!ISSUE_TYPES.has(issue.fields.issuetype.name) || issue.fields.issuetype.subtask) {
    return null;
  }

  return issue;
}

function getSprintIdsFromField(issue: JiraIssue, sprintFieldId: string) {
  const sprintFieldValue = issue.fields[sprintFieldId];

  if (!Array.isArray(sprintFieldValue)) {
    return [];
  }

  return sprintFieldValue
    .map((value) => {
      if (typeof value === "object" && value && "id" in value) {
        return String((value as { id: number | string }).id);
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));
}

function deriveIssueMetrics(
  histories: JiraHistory[],
  currentStatus: string,
  issueUpdatedAt: string
): DerivedIssueMetrics {
  const sorted = [...histories].sort(byDateAsc);
  let firstInProgressAt: Date | null = null;
  let finalDoneAt: Date | null = null;
  let finalAbandonedAt: Date | null = null;
  let activeStart: Date | null = null;
  let activeMinutes = 0;
  let reopenedCount = 0;
  let doneReached = false;

  for (const history of sorted) {
    const changedAt = new Date(history.created);

    for (const item of history.items) {
      if (item.fieldId !== "status" && item.field !== "status") {
        continue;
      }

      const fromStatus = item.fromString ?? "";
      const toStatus = item.toString ?? "";

      if (DONE_STATUSES.has(fromStatus) && !DONE_STATUSES.has(toStatus)) {
        reopenedCount += 1;
        finalDoneAt = null;
      }

      if (IN_PROGRESS_STATUSES.has(toStatus) && firstInProgressAt == null) {
        firstInProgressAt = changedAt;
      }

      if (!IN_PROGRESS_STATUSES.has(fromStatus) && IN_PROGRESS_STATUSES.has(toStatus)) {
        activeStart = changedAt;
      }

      if (IN_PROGRESS_STATUSES.has(fromStatus) && !IN_PROGRESS_STATUSES.has(toStatus) && activeStart) {
        activeMinutes += differenceInMinutes(activeStart, changedAt);
        activeStart = null;
      }

      if (DONE_STATUSES.has(toStatus)) {
        finalDoneAt = changedAt;
        finalAbandonedAt = null;
        doneReached = true;
      }

      if (ABANDONED_STATUSES.has(toStatus)) {
        finalAbandonedAt = changedAt;
        finalDoneAt = null;
      }

      if (doneReached && DONE_STATUSES.has(toStatus)) {
        finalDoneAt = changedAt;
      }
    }
  }

  if (DONE_STATUSES.has(currentStatus)) {
    finalDoneAt ??= new Date(issueUpdatedAt);
    finalAbandonedAt = null;
  } else if (ABANDONED_STATUSES.has(currentStatus)) {
    finalAbandonedAt ??= new Date(issueUpdatedAt);
    finalDoneAt = null;
  } else {
    finalDoneAt = null;
    finalAbandonedAt = null;
  }

  const terminalAt = finalDoneAt ?? finalAbandonedAt;
  const leadExecutionMinutes =
    firstInProgressAt && terminalAt ? differenceInMinutes(firstInProgressAt, terminalAt) : null;

  if (activeStart && terminalAt) {
    activeMinutes += differenceInMinutes(activeStart, terminalAt);
  }

  return {
    firstInProgressAt,
    finalDoneAt,
    finalAbandonedAt,
    leadExecutionMinutes,
    activeWorkMinutes: activeMinutes > 0 ? activeMinutes : null,
    reopenedCount
  };
}

function deriveOriginalAndFinalAssignee(issue: JiraIssue, histories: JiraHistory[]) {
  const assigneeEvents = [...histories]
    .sort(byDateAsc)
    .flatMap((history) =>
      history.items
        .filter((item) => item.fieldId === "assignee" || item.field === "assignee")
        .map((item) => ({
          changedAt: history.created,
          fromAccountId: item.from ?? null,
          fromDisplayName: item.fromString ?? null,
          toAccountId: item.to ?? null,
          toDisplayName: item.toString ?? null
        }))
    );

  const earliest = assigneeEvents[0];
  const latest = assigneeEvents[assigneeEvents.length - 1];

  return {
    originalAssigneeId:
      earliest?.fromAccountId ??
      issue.fields.assignee?.accountId ??
      issue.fields.creator?.accountId ??
      null,
    originalAssigneeName:
      earliest?.fromDisplayName ??
      issue.fields.assignee?.displayName ??
      issue.fields.creator?.displayName ??
      null,
    finalAssigneeId: issue.fields.assignee?.accountId ?? latest?.toAccountId ?? null,
    finalAssigneeName: issue.fields.assignee?.displayName ?? latest?.toDisplayName ?? null,
    assigneeEvents
  };
}

function deriveStoryPointEvents(
  histories: JiraHistory[],
  storyPointsFieldId: string,
  issue: JiraIssue
) {
  const events = [...histories]
    .sort(byDateAsc)
    .flatMap((history) =>
      history.items
        .filter(
          (item) =>
            item.fieldId === storyPointsFieldId ||
            item.field.toLowerCase().includes("story point")
        )
        .map((item) => ({
          changedAt: history.created,
          fromValue: item.fromString ? Number(item.fromString) : null,
          toValue: item.toString ? Number(item.toString) : null,
          authorId: history.author?.accountId ?? null,
          authorName: history.author?.displayName ?? null
        }))
    );

  const latest = events[events.length - 1];
  const latestValue = issue.fields[storyPointsFieldId];

  return {
    storyPointsLatest:
      typeof latestValue === "number"
        ? latestValue
        : latest?.toValue ?? latest?.fromValue ?? null,
    finalEstimatorId: latest?.authorId ?? null,
    finalEstimatorName: latest?.authorName ?? null,
    events
  };
}

function deriveLastSprintId(
  issue: JiraIssue,
  sprintIds: Set<string>,
  sprintFieldId: string,
  histories: JiraHistory[]
) {
  const sprintEvents = [...histories]
    .sort(byDateAsc)
    .flatMap((history) =>
      history.items
        .filter((item) => item.fieldId === sprintFieldId || item.field === "Sprint")
        .map((item) => ({
          toSprintId: item.to ? String(item.to) : null
        }))
    );

  const latestEventSprintId = sprintEvents[sprintEvents.length - 1]?.toSprintId;

  if (latestEventSprintId) {
    return latestEventSprintId;
  }

  const currentSprintIds = getSprintIdsFromField(issue, sprintFieldId);
  if (currentSprintIds.length > 0) {
    return currentSprintIds[currentSprintIds.length - 1];
  }

  return Array.from(sprintIds).sort().at(-1) ?? null;
}

async function persistIssue(
  issue: JiraIssue,
  sprintIds: Set<string>,
  fields: { sprintFieldId: string; storyPointsFieldId: string }
) {
  const histories = issue.changelog?.histories ?? [];
  const metrics = deriveIssueMetrics(
    histories,
    issue.fields.status.name,
    issue.fields.updated
  );
  const assignee = deriveOriginalAndFinalAssignee(issue, histories);
  const storyPoints = deriveStoryPointEvents(histories, fields.storyPointsFieldId, issue);
  const allSprintIds = new Set([...sprintIds, ...getSprintIdsFromField(issue, fields.sprintFieldId)]);
  const lastSprintId = deriveLastSprintId(issue, allSprintIds, fields.sprintFieldId, histories);

  const issueData = {
    id: issue.id,
    key: issue.key,
    projectKey: issue.fields.project.key,
    issueType: issue.fields.issuetype.name,
    summary: issue.fields.summary,
    currentStatus: issue.fields.status.name,
    storyPointsLatest: storyPoints.storyPointsLatest,
    originalAssigneeId: assignee.originalAssigneeId,
    originalAssigneeName: normalizeDisplayName(assignee.originalAssigneeName),
    finalAssigneeId: assignee.finalAssigneeId,
    finalAssigneeName: normalizeDisplayName(assignee.finalAssigneeName),
    finalEstimatorId: storyPoints.finalEstimatorId,
    finalEstimatorName: normalizeDisplayName(storyPoints.finalEstimatorName),
    firstInProgressAt: metrics.firstInProgressAt,
    finalDoneAt: metrics.finalDoneAt,
    finalAbandonedAt: metrics.finalAbandonedAt,
    leadExecutionMinutes: metrics.leadExecutionMinutes,
    activeWorkMinutes: metrics.activeWorkMinutes,
    handoffDetected:
      Boolean(assignee.originalAssigneeId) &&
      Boolean(assignee.finalAssigneeId) &&
      assignee.originalAssigneeId !== assignee.finalAssigneeId,
    reopenedCount: metrics.reopenedCount,
    createdAt: new Date(issue.fields.created),
    updatedAt: new Date(issue.fields.updated)
  };

  await prisma.$transaction(async (tx) => {
    await tx.jiraIssue.upsert({
      where: { jiraIssueId: issue.id },
      update: {
        ...issueData,
        syncedAt: new Date()
      },
      create: {
        ...issueData,
        jiraIssueId: issue.id
      }
    });

    await Promise.all([
      tx.jiraIssueStatusChange.deleteMany({ where: { issueId: issue.id } }),
      tx.jiraIssueAssigneeChange.deleteMany({ where: { issueId: issue.id } }),
      tx.jiraIssueStoryPointChange.deleteMany({ where: { issueId: issue.id } }),
      tx.jiraIssueSprint.deleteMany({ where: { issueId: issue.id } })
    ]);

    if (histories.length > 0) {
      const statusEvents = histories
        .flatMap((history) =>
          history.items
            .filter((item) => item.fieldId === "status" || item.field === "status")
            .map((item) => ({
              issueId: issue.id,
              fromStatus: item.fromString ?? null,
              toStatus: item.toString ?? "",
              changedAt: new Date(history.created),
              authorId: history.author?.accountId ?? null,
              authorName: history.author?.displayName ?? null
            }))
        )
        .filter((item) => item.toStatus);

      if (statusEvents.length > 0) {
        await tx.jiraIssueStatusChange.createMany({ data: statusEvents });
      }
    }

    if (assignee.assigneeEvents.length > 0) {
      await tx.jiraIssueAssigneeChange.createMany({
        data: assignee.assigneeEvents.map((event) => ({
          issueId: issue.id,
          fromAccountId: event.fromAccountId,
          fromDisplayName: event.fromDisplayName,
          toAccountId: event.toAccountId,
          toDisplayName: event.toDisplayName,
          changedAt: new Date(event.changedAt)
        }))
      });
    }

    if (storyPoints.events.length > 0) {
      await tx.jiraIssueStoryPointChange.createMany({
        data: storyPoints.events.map((event) => ({
          issueId: issue.id,
          fromValue: event.fromValue,
          toValue: event.toValue,
          changedAt: new Date(event.changedAt),
          authorId: event.authorId,
          authorName: event.authorName
        }))
      });
    }

    if (allSprintIds.size > 0) {
      await tx.jiraIssueSprint.createMany({
        data: Array.from(allSprintIds).map((sprintId) => ({
          issueId: issue.id,
          sprintId,
          isLastSprint: sprintId === lastSprintId
        }))
      });
    }
  }, {
    maxWait: 10_000,
    timeout: 30_000
  });
}

function buildMemberMapForIssues(relevantIssues: Array<{
  finalAssigneeId: string | null;
  finalAssigneeName: string | null;
  finalDoneAt: Date | null;
  finalAbandonedAt: Date | null;
  leadExecutionMinutes: number | null;
  activeWorkMinutes: number | null;
  storyPointsLatest: number | null;
  originalAssigneeId: string | null;
  originalAssigneeName: string | null;
  finalEstimatorId: string | null;
  finalEstimatorName: string | null;
}>) {
  const memberMap = new Map<string, MemberAccumulator>();

  const ensureMember = (accountId: string, displayName: string) => {
    const existing = memberMap.get(accountId);
    if (existing) {
      return existing;
    }

    const mapped = applyTeamMemberOverride(accountId, displayName, true);
    const created: MemberAccumulator = {
      displayName: mapped.displayName,
      completedIssues: 0,
      notCompletedIssues: 0,
      abandonedIssues: 0,
      deliveredStoryPoints: 0,
      estimatorDeliveredPoints: 0,
      ownerDeliveredPoints: 0,
      leadTimes: [],
      activeTimes: []
    };

    memberMap.set(accountId, created);
    return created;
  };

  for (const issue of relevantIssues) {
    if (issue.finalAssigneeId && issue.finalAssigneeName) {
      const member = ensureMember(issue.finalAssigneeId, issue.finalAssigneeName);

      if (issue.finalDoneAt) {
        member.completedIssues += 1;
        member.deliveredStoryPoints += issue.storyPointsLatest ?? 0;
        member.ownerDeliveredPoints += issue.storyPointsLatest ?? 0;
      }

      if (issue.finalAbandonedAt) {
        member.abandonedIssues += 1;
      }

      if (issue.leadExecutionMinutes != null) {
        member.leadTimes.push(issue.leadExecutionMinutes);
      }

      if (issue.activeWorkMinutes != null) {
        member.activeTimes.push(issue.activeWorkMinutes);
      }
    }

    if (
      issue.originalAssigneeId &&
      issue.originalAssigneeName &&
      issue.originalAssigneeId !== issue.finalAssigneeId
    ) {
      const member = ensureMember(issue.originalAssigneeId, issue.originalAssigneeName);
      member.notCompletedIssues += 1;
    }

    if (issue.finalEstimatorId && issue.finalEstimatorName && issue.finalDoneAt) {
      const member = ensureMember(issue.finalEstimatorId, issue.finalEstimatorName);
      member.estimatorDeliveredPoints += issue.storyPointsLatest ?? 0;
    }
  }

  return memberMap;
}

async function rebuildSprintAnalyticsFact(
  sprintId: string,
  teamMembers?: Array<{ accountId: string; displayName: string }>
) {
  const sprint = await prisma.sprint.findUnique({
    include: {
      issueLinks: {
        include: {
          issue: true
        }
      },
      memberCapacities: true
    },
    where: { id: sprintId }
  });

  if (!sprint) {
    return false;
  }

  const activeTeamMembers =
    teamMembers ??
    (await prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" }
    }));
  const relevantIssues = sprint.issueLinks
    .filter((link) => link.isLastSprint)
    .map((link) => link.issue);
  const memberMap = buildMemberMapForIssues(relevantIssues);

  await prisma.teamSprintFact.deleteMany({
    where: { sprintId: sprint.id }
  });
  await prisma.memberSprintFact.deleteMany({
    where: { sprintId: sprint.id }
  });

  await prisma.teamSprintFact.create({
    data: {
      sprintId: sprint.id,
      committedIssues: relevantIssues.length,
      deliveredIssues: relevantIssues.filter((issue) => issue.finalDoneAt != null).length,
      abandonedIssues: relevantIssues.filter((issue) => issue.finalAbandonedAt != null).length,
      committedStoryPoints: relevantIssues.reduce(
        (sum, issue) => sum + (issue.storyPointsLatest ?? 0),
        0
      ),
      deliveredStoryPoints: relevantIssues
        .filter((issue) => issue.finalDoneAt != null)
        .reduce((sum, issue) => sum + (issue.storyPointsLatest ?? 0), 0),
      avgLeadExecutionMinutes: average(
        relevantIssues
          .map((issue) => issue.leadExecutionMinutes)
          .filter((value): value is number => value != null)
      ),
      avgActiveWorkMinutes: average(
        relevantIssues
          .map((issue) => issue.activeWorkMinutes)
          .filter((value): value is number => value != null)
      ),
      handoffIssues: relevantIssues.filter((issue) => issue.handoffDetected).length
    }
  });

  await prisma.memberSprintFact.createMany({
    data: activeTeamMembers.map((teamMember) => {
      const fact = memberMap.get(teamMember.accountId);
      const capacity = sprint.memberCapacities.find(
        (item) => item.accountId === teamMember.accountId
      );

      return {
        sprintId: sprint.id,
        accountId: teamMember.accountId,
        displayName: teamMember.displayName,
        completedIssues: fact?.completedIssues ?? 0,
        notCompletedIssues: fact?.notCompletedIssues ?? 0,
        abandonedIssues: fact?.abandonedIssues ?? 0,
        deliveredStoryPoints: fact?.deliveredStoryPoints ?? 0,
        avgLeadExecutionMinutes: average(fact?.leadTimes ?? []),
        avgActiveWorkMinutes: average(fact?.activeTimes ?? []),
        capacityDays: capacity?.capacityDays ?? null,
        personalDaysOff: capacity?.personalDaysOff ?? null,
        estimatorDeliveredPoints: fact?.estimatorDeliveredPoints ?? 0,
        ownerDeliveredPoints: fact?.ownerDeliveredPoints ?? 0
      };
    })
  });

  return true;
}

export async function rebuildAnalyticsFacts() {
  const [teamMembers, sprints] = await Promise.all([
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" }
    }),
    prisma.sprint.findMany({
      select: { id: true },
      orderBy: { startedAt: "asc" }
    })
  ]);

  for (const sprint of sprints) {
    await rebuildSprintAnalyticsFact(sprint.id, teamMembers);
  }
}

export async function testJiraConnection() {
  const env = getJiraEnv();
  const board = await jiraRequest<JiraBoard>(`/rest/agile/1.0/board/${env.JIRA_BOARD_ID}`);
  const activeSprints = await jiraRequest<JiraPaginated<JiraSprint>>(
    `/rest/agile/1.0/board/${env.JIRA_BOARD_ID}/sprint`,
    {
      searchParams: {
        state: "active,future,closed",
        maxResults: 50
      }
    }
  );

  return {
    board,
    sprintCount: activeSprints.values.length,
    currentSprint:
      activeSprints.values.find((sprint) => sprint.state === "active") ?? null
  };
}

export async function importSprintsFromJira() {
  const env = getJiraEnv();
  const run = await prisma.syncRun.create({
    data: {
      trigger: "manual",
      status: "running",
      message: "Importing sprints from Jira"
    }
  });

  try {
    const response = await jiraRequest<JiraPaginated<JiraSprint>>(
      `/rest/agile/1.0/board/${env.JIRA_BOARD_ID}/sprint`,
      {
        searchParams: {
          state: "active,future,closed",
          maxResults: 100
        }
      }
    );

    await prisma.jiraSyncConfig.upsert({
      where: { id: "default" },
      update: {
        baseUrl: env.JIRA_BASE_URL,
        boardId: Number(env.JIRA_BOARD_ID),
        projectKey: env.JIRA_PROJECT_KEY
      },
      create: {
        id: "default",
        baseUrl: env.JIRA_BASE_URL,
        boardId: Number(env.JIRA_BOARD_ID),
        projectKey: env.JIRA_PROJECT_KEY
      }
    });

    for (const sprint of response.values) {
      await prisma.sprint.upsert({
        where: { jiraSprintId: sprint.id },
        update: {
          id: String(sprint.id),
          boardId: sprint.originBoardId ?? Number(env.JIRA_BOARD_ID),
          name: sprint.name,
          state: sprint.state,
          goal: sprint.goal,
          startedAt: sprint.startDate ? new Date(sprint.startDate) : null,
          endedAt: sprint.endDate ? new Date(sprint.endDate) : null,
          completedAt: sprint.completeDate ? new Date(sprint.completeDate) : null
        },
        create: {
          id: String(sprint.id),
          jiraSprintId: sprint.id,
          boardId: sprint.originBoardId ?? Number(env.JIRA_BOARD_ID),
          name: sprint.name,
          state: sprint.state,
          goal: sprint.goal,
          startedAt: sprint.startDate ? new Date(sprint.startDate) : null,
          endedAt: sprint.endDate ? new Date(sprint.endDate) : null,
          completedAt: sprint.completeDate ? new Date(sprint.completeDate) : null
        }
      });
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        sprintsFetched: response.values.length,
        message: `Imported ${response.values.length} sprints`
      }
    });

    return {
      imported: response.values.length,
      currentSprint:
        response.values.find((sprint) => sprint.state === "active")?.name ?? null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Jira import error";

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message
      }
    });

    throw error;
  }
}

export async function importIssuesFromJira(trigger: SyncTrigger = "manual") {
  const run = await prisma.syncRun.create({
    data: {
      trigger,
      status: "running",
      message: "Importing issues and changelog history from Jira"
    }
  });

  try {
    const [sprints, fields, teamCount] = await Promise.all([
      prisma.sprint.findMany({ orderBy: { startedAt: "asc" } }),
      getFieldIds(),
      syncTeamMembersFromJira()
    ]);

    const issueMap = new Map<string, IssueAccumulator>();
    let fetchedCount = 0;

    for (const sprint of sprints) {
      const sprintIssues = await fetchSprintIssues(sprint.jiraSprintId, fields);
      fetchedCount += sprintIssues.length;

      for (const issue of sprintIssues) {
        const existing = issueMap.get(issue.id);

        if (existing) {
          existing.sprintIds.add(sprint.id);
          continue;
        }

        issueMap.set(issue.id, {
          issue,
          sprintIds: new Set([sprint.id])
        });
      }
    }

    for (const { issue, sprintIds } of issueMap.values()) {
      await persistIssue(issue, sprintIds, fields);
    }

    await rebuildAnalyticsFacts();

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        issuesFetched: issueMap.size,
        message: `Imported ${issueMap.size} unique issues from ${sprints.length} sprints and synced ${teamCount} team members`
      }
    });

    return {
      importedIssues: issueMap.size,
      scannedSprintIssues: fetchedCount,
      sprintCount: sprints.length,
      teamCount
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Jira issue import error";

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message
      }
    });

    throw error;
  }
}

export async function refreshSprintFromJira(
  sprintId: string,
  trigger: SyncTrigger = "manual"
) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      issueLinks: {
        where: { isLastSprint: true },
        include: { issue: true }
      }
    }
  });

  if (!sprint) {
    throw new Error("Selected sprint was not found.");
  }

  const run = await prisma.syncRun.create({
    data: {
      trigger,
      status: "running",
      message: `Refreshing sprint ${sprint.name} from Jira`
    }
  });

  try {
    const [fields, teamCount] = await Promise.all([
      getFieldIds(),
      syncTeamMembersFromJira()
    ]);

    const sprintIssues = await fetchSprintIssues(sprint.jiraSprintId, fields);
    const existingIssueMap = new Map(
      sprint.issueLinks.map((link) => [link.issue.id, link.issue])
    );
    const fetchedIssueIds = new Set(sprintIssues.map((issue) => issue.id));
    const staleIssueKeys = sprint.issueLinks
      .filter((link) => !fetchedIssueIds.has(link.issue.id))
      .map((link) => link.issue.key);
    let changedIssueCount = 0;
    let skippedIssueCount = 0;

    for (const issue of sprintIssues) {
      const existingIssue = existingIssueMap.get(issue.id);
      const issueUpdatedAt = new Date(issue.fields.updated).getTime();

      if (existingIssue && existingIssue.updatedAt.getTime() === issueUpdatedAt) {
        skippedIssueCount += 1;
        continue;
      }

      changedIssueCount += 1;
      await persistIssue(
        issue,
        new Set(getSprintIdsFromField(issue, fields.sprintFieldId)),
        fields
      );
    }

    for (const staleIssueKey of staleIssueKeys) {
      const latestIssue = await fetchIssueByKey(staleIssueKey, fields);

      if (!latestIssue) {
        await prisma.jiraIssue.deleteMany({
          where: { key: staleIssueKey }
        });
        changedIssueCount += 1;
        continue;
      }

      changedIssueCount += 1;
      await persistIssue(
        latestIssue,
        new Set(getSprintIdsFromField(latestIssue, fields.sprintFieldId)),
        fields
      );
    }

    if (changedIssueCount > 0) {
      await rebuildSprintAnalyticsFact(sprint.id);
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        issuesFetched: sprintIssues.length,
        sprintsFetched: 1,
        message: `Refreshed sprint ${sprint.name}: ${changedIssueCount} changed, ${skippedIssueCount} unchanged, ${staleIssueKeys.length} stale checks, ${teamCount} team members synced`
      }
    });

    return {
      importedIssues: sprintIssues.length,
      scannedSprintIssues: sprintIssues.length,
      sprintCount: 1,
      teamCount,
      staleIssues: staleIssueKeys.length,
      changedIssues: changedIssueCount,
      skippedIssues: skippedIssueCount
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Jira sprint refresh error";

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message
      }
    });

    throw error;
  }
}

export async function syncIssueByKeyFromJira(
  issueKey: string,
  trigger: SyncTrigger = "webhook"
) {
  const normalizedKey = issueKey.trim().toUpperCase();
  const run = await prisma.syncRun.create({
    data: {
      trigger,
      status: "running",
      message: `Syncing issue ${normalizedKey} from Jira`
    }
  });

  try {
    const fields = await getFieldIds();
    const issue = await fetchIssueByKey(normalizedKey, fields);

    if (!issue) {
      await prisma.jiraIssue.deleteMany({
        where: {
          key: normalizedKey
        }
      });
    } else {
      await persistIssue(
        issue,
        new Set(getSprintIdsFromField(issue, fields.sprintFieldId)),
        fields
      );
    }

    await rebuildAnalyticsFacts();

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        issuesFetched: 1,
        message: issue
          ? `Synced issue ${normalizedKey} from Jira`
          : `Removed issue ${normalizedKey} from local analytics`
      }
    });

    return {
      issueKey: normalizedKey,
      removed: issue == null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Jira issue sync error";

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message
      }
    });

    throw error;
  }
}

export async function deleteIssueFromAnalytics(
  input: {
    issueId?: string | null;
    issueKey?: string | null;
  },
  trigger: SyncTrigger = "webhook"
) {
  const issueLabel = input.issueKey?.trim().toUpperCase() ?? input.issueId ?? "unknown issue";
  const run = await prisma.syncRun.create({
    data: {
      trigger,
      status: "running",
      message: `Removing ${issueLabel} from local analytics`
    }
  });

  try {
    if (input.issueId) {
      await prisma.jiraIssue.deleteMany({
        where: { id: input.issueId }
      });
    } else if (input.issueKey) {
      await prisma.jiraIssue.deleteMany({
        where: { key: input.issueKey.trim().toUpperCase() }
      });
    }

    await rebuildAnalyticsFacts();

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        issuesFetched: 1,
        message: `Removed ${issueLabel} from local analytics`
      }
    });

    return {
      removed: true,
      issueLabel
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Jira issue removal error";

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message
      }
    });

    throw error;
  }
}
