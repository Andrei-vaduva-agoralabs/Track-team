import { hasJiraCredentials } from "@/lib/jira/config";
import { JiraApiError } from "@/lib/jira/client";
import { importIssuesFromJira, refreshSprintFromJira } from "@/lib/jira/sync";
import { prisma } from "@/lib/prisma";

export type ManualSyncResult = {
  status: "success" | "error";
  message: string;
};

const ACTIVE_SYNC_WINDOW_MS = 5 * 60 * 1000;

async function ensureManualSyncAvailability() {
  const staleCutoff = new Date(Date.now() - ACTIVE_SYNC_WINDOW_MS);
  const now = new Date();

  await prisma.syncRun.updateMany({
    where: {
      status: "running",
      startedAt: {
        lt: staleCutoff
      }
    },
    data: {
      status: "failed",
      finishedAt: now,
      message: "Sync interrupted before completion."
    }
  });

  const activeRun = await prisma.syncRun.findFirst({
    where: {
      status: "running",
      startedAt: {
        gte: staleCutoff
      }
    },
    orderBy: {
      startedAt: "desc"
    }
  });

  if (activeRun) {
    throw new Error("A Jira sync is already running. Wait for it to finish before starting another refresh.");
  }
}

export async function runManualBoardRefresh(sprintId?: string): Promise<ManualSyncResult> {
  if (!hasJiraCredentials()) {
    return {
      status: "error",
      message: "Missing Jira credentials in .env.local."
    };
  }

  try {
    await ensureManualSyncAvailability();

    const result = sprintId ? await refreshSprintFromJira(sprintId) : await importIssuesFromJira();

    return {
      status: "success",
      message: `Synced ${result.importedIssues} stories and bugs across ${result.sprintCount} sprint${result.sprintCount === 1 ? "" : "s"}.`
    };
  } catch (error) {
    if (error instanceof JiraApiError) {
      return {
        status: "error",
        message: `Jira rejected the sync (${error.status}).`
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown Jira sync error."
    };
  }
}
