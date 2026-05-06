"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { JiraApiError } from "@/lib/jira/client";
import {
  importIssuesFromJira,
  importSprintsFromJira,
  testJiraConnection
} from "@/lib/jira/sync";
import { hasJiraCredentials } from "@/lib/jira/config";
import { jiraSettingsSchema } from "@/lib/settings";
import { requireAdmin } from "@/lib/access";

export async function saveJiraSettings(formData: FormData) {
  await requireAdmin();

  const parsed = jiraSettingsSchema.parse({
    baseUrl: formData.get("baseUrl"),
    boardId: formData.get("boardId"),
    projectKey: formData.get("projectKey")
  });

  await prisma.jiraSyncConfig.upsert({
    where: { id: "default" },
    update: parsed,
    create: {
      id: "default",
      ...parsed
    }
  });

  revalidatePath("/setup");
}

type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function missingCredentialsState(): ActionState {
  return {
    status: "error",
    message: "Add JIRA_EMAIL and JIRA_API_TOKEN to .env.local first."
  };
}

export async function testConnectionAction(): Promise<ActionState> {
  await requireAdmin();

  if (!hasJiraCredentials()) {
    return missingCredentialsState();
  }

  try {
    const result = await testJiraConnection();

    return {
      status: "success",
      message: result.currentSprint
        ? `Connected to board ${result.board.name}. Active sprint: ${result.currentSprint.name}.`
        : `Connected to board ${result.board.name}. No active sprint found in the latest 50 results.`
    };
  } catch (error) {
    if (error instanceof JiraApiError) {
      return {
        status: "error",
        message: `Jira rejected the request (${error.status}). Check the email, token, and board permissions.`
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown Jira connection error."
    };
  }
}

export async function importSprintsAction(): Promise<ActionState> {
  await requireAdmin();

  if (!hasJiraCredentials()) {
    return missingCredentialsState();
  }

  try {
    const result = await importSprintsFromJira();
    revalidatePath("/dashboard");
    revalidatePath("/setup");

    return {
      status: "success",
      message: result.currentSprint
        ? `Imported ${result.imported} sprints. Current active sprint: ${result.currentSprint}.`
        : `Imported ${result.imported} sprints. Jira did not return an active sprint.`
    };
  } catch (error) {
    if (error instanceof JiraApiError) {
      return {
        status: "error",
        message: `Jira rejected the sprint import (${error.status}). Check token scope and board access.`
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown sprint import error."
    };
  }
}

export async function importIssuesAction(): Promise<ActionState> {
  await requireAdmin();

  if (!hasJiraCredentials()) {
    return missingCredentialsState();
  }

  try {
    const result = await importIssuesFromJira();
    revalidatePath("/dashboard");
    revalidatePath("/setup");

    return {
      status: "success",
      message: `Imported ${result.importedIssues} unique stories/bugs from ${result.sprintCount} sprints and synced ${result.teamCount} team members.`
    };
  } catch (error) {
    if (error instanceof JiraApiError) {
      return {
        status: "error",
        message: `Jira rejected the issue import (${error.status}). Check project scope and changelog access.`
      };
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown issue import error."
    };
  }
}
