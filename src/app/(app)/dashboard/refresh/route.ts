import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access";
import { runManualBoardRefresh } from "@/lib/jira/manual-sync";

export async function POST(request: Request) {
  await requireAdmin();

  const formData = await request.formData();
  const sprintIdEntry = formData.get("sprintId");
  const sprintId = typeof sprintIdEntry === "string" && sprintIdEntry ? sprintIdEntry : undefined;
  const result = await runManualBoardRefresh(sprintId);

  if (result.status === "success") {
    revalidatePath("/dashboard");
    revalidatePath("/capacity");
    revalidatePath("/members/[accountId]", "page");
  }

  const url = new URL("/dashboard", request.url);

  if (sprintId) {
    url.searchParams.set("sprint", sprintId);
  }

  url.searchParams.set("syncStatus", result.status);
  url.searchParams.set("syncMessage", result.message);

  return NextResponse.redirect(url, { status: 303 });
}
