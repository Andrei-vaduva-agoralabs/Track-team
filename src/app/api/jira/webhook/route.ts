import { createHmac, timingSafeEqual } from "crypto";
import { deleteIssueFromAnalytics, syncIssueByKeyFromJira } from "@/lib/jira/sync";

type JiraWebhookPayload = {
  webhookEvent?: string;
  issue?: {
    id?: string;
    key?: string;
  };
};

function verifyWebhookSignature(body: string, signatureHeader: string | null) {
  const secret = process.env.JIRA_WEBHOOK_SECRET;

  if (!secret || !signatureHeader) {
    return false;
  }

  const [method, providedDigest] = signatureHeader.split("=");

  if (method !== "sha256" || !providedDigest) {
    return false;
  }

  const expectedDigest = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expectedDigest, "hex");
  const providedBuffer = Buffer.from(providedDigest, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature");

  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    return Response.json({ ok: false, message: "Invalid webhook signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as JiraWebhookPayload;
  const event = payload.webhookEvent ?? "unknown";
  const issueKey = payload.issue?.key ?? null;
  const issueId = payload.issue?.id ?? null;

  if (!issueKey && !issueId) {
    return Response.json({ ok: true, ignored: true, reason: "No issue payload" });
  }

  try {
    if (event === "jira:issue_deleted") {
      const result = await deleteIssueFromAnalytics({ issueId, issueKey }, "webhook");
      return Response.json({ ok: true, trigger: "webhook", event, ...result });
    }

    if (event === "jira:issue_created" || event === "jira:issue_updated") {
      const result = await syncIssueByKeyFromJira(issueKey ?? "", "webhook");
      return Response.json({ ok: true, trigger: "webhook", event, ...result });
    }

    return Response.json({ ok: true, ignored: true, event });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        event,
        message: error instanceof Error ? error.message : "Unknown Jira webhook sync error."
      },
      { status: 500 }
    );
  }
}
