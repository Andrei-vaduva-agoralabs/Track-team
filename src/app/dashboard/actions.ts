"use server";

import { revalidatePath } from "next/cache";
import { hasJiraCredentials } from "@/lib/jira/config";
import { JiraApiError } from "@/lib/jira/client";
import { importIssuesFromJira } from "@/lib/jira/sync";
import { requireAdmin } from "@/lib/access";

type SyncState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function refreshBoardAction(_previousState: SyncState): Promise<SyncState> {
  await requireAdmin();

  if (!hasJiraCredentials()) {
    return {
      status: "error",
      message: "Missing Jira credentials in .env.local."
    };
  }

  try {
    const result = await importIssuesFromJira();

    revalidatePath("/dashboard");
    revalidatePath("/capacity");
    revalidatePath("/members/[accountId]", "page");

    return {
      status: "success",
      message: `Synced ${result.importedIssues} stories and bugs across ${result.sprintCount} sprints.`
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
