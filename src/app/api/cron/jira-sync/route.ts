import type { NextRequest } from "next/server";
import { importIssuesFromJira } from "@/lib/jira/sync";

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return Boolean(
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await importIssuesFromJira("cron");

    return Response.json({
      ok: true,
      trigger: "cron",
      importedIssues: result.importedIssues,
      sprintCount: result.sprintCount,
      teamCount: result.teamCount
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown cron sync error."
      },
      { status: 500 }
    );
  }
}
