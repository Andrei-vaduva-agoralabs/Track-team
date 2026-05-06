"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";

function parseNumericInput(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function saveCapacityAction(formData: FormData) {
  await requireAdmin();

  const sprintId = String(formData.get("sprintId") ?? "");

  if (!sprintId) {
    redirect("/capacity");
  }

  const sprintWorkDays = parseNumericInput(formData.get("sprintWorkDays"));
  const globalDaysOff = parseNumericInput(formData.get("globalDaysOff"));
  const notesEntry = formData.get("notes");
  const notes = typeof notesEntry === "string" && notesEntry.trim() ? notesEntry.trim() : null;

  const sprintIssueLinks = await prisma.jiraIssueSprint.findMany({
    where: {
      sprintId,
      isLastSprint: true
    },
    include: {
      issue: {
        select: {
          originalAssigneeId: true,
          finalAssigneeId: true
        }
      }
    }
  });

  const sprintParticipantIds = new Set<string>();

  for (const link of sprintIssueLinks) {
    if (link.issue.originalAssigneeId) {
      sprintParticipantIds.add(link.issue.originalAssigneeId);
    }

    if (link.issue.finalAssigneeId) {
      sprintParticipantIds.add(link.issue.finalAssigneeId);
    }
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: {
      active: true,
      accountId: {
        in: Array.from(sprintParticipantIds)
      }
    },
    orderBy: { displayName: "asc" }
  });

  const capacityRows = teamMembers.map((member) => ({
    sprintId,
    accountId: member.accountId,
    displayName: member.displayName,
    capacityDays: parseNumericInput(formData.get(`capacity:${member.accountId}`)),
    personalDaysOff: parseNumericInput(formData.get(`daysOff:${member.accountId}`)),
    isManualOverride: true
  }));

  const factCapacityUpdate =
    capacityRows.length > 0
      ? prisma.$executeRaw`
          UPDATE "MemberSprintFact" AS fact
          SET
            "capacityDays" = capacity."capacityDays",
            "personalDaysOff" = capacity."personalDaysOff",
            "updatedAt" = NOW()
          FROM (
            VALUES ${Prisma.join(
              capacityRows.map((row) =>
                Prisma.sql`(${row.accountId}, ${row.capacityDays}, ${row.personalDaysOff})`
              )
            )}
          ) AS capacity("accountId", "capacityDays", "personalDaysOff")
          WHERE fact."sprintId" = ${sprintId}
            AND fact."accountId" = capacity."accountId"
        `
      : null;

  await prisma.$transaction([
    prisma.sprintSettings.upsert({
      where: { sprintId },
      update: {
        sprintWorkDays,
        globalDaysOff,
        notes
      },
      create: {
        sprintId,
        sprintWorkDays,
        globalDaysOff,
        notes
      }
    }),
    prisma.sprintMemberCapacity.deleteMany({ where: { sprintId } }),
    prisma.sprintMemberCapacity.createMany({ data: capacityRows }),
    ...(factCapacityUpdate ? [factCapacityUpdate] : [])
  ]);

  if (capacityRows.length === 0) {
    await prisma.sprintMemberCapacity.deleteMany({ where: { sprintId } });
  }

  await prisma.sprintMemberCapacity.deleteMany({
    where: {
      sprintId,
      accountId: {
        notIn: teamMembers.map((member) => member.accountId)
      }
    }
  });

  revalidatePath("/capacity");
  revalidatePath("/dashboard");
  revalidatePath("/setup");

  redirect(`/capacity?sprint=${encodeURIComponent(sprintId)}&saved=1`);
}
