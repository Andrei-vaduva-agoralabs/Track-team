"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access";
import { runManualBoardRefresh } from "@/lib/jira/manual-sync";

type SyncState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function refreshBoardAction(
  _previousState: SyncState,
  formData: FormData
): Promise<SyncState> {
  await requireAdmin();
  const sprintIdEntry = formData.get("sprintId");
  const sprintId = typeof sprintIdEntry === "string" ? sprintIdEntry : undefined;
  const result = await runManualBoardRefresh(sprintId);

  if (result.status === "success") {
    revalidatePath("/dashboard");
    revalidatePath("/capacity");
    revalidatePath("/members/[accountId]", "page");
  }

  return result;
}
