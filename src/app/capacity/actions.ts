"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rebuildAnalyticsFacts } from "@/lib/jira/sync";
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

  const teamMembers = await prisma.teamMember.findMany({
    where: { active: true },
    orderBy: { displayName: "asc" }
  });

  await prisma.sprintSettings.upsert({
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
  });

  for (const member of teamMembers) {
    const capacityDays = parseNumericInput(formData.get(`capacity:${member.accountId}`));
    const personalDaysOff = parseNumericInput(formData.get(`daysOff:${member.accountId}`));

    await prisma.sprintMemberCapacity.upsert({
      where: {
        sprintId_accountId: {
          sprintId,
          accountId: member.accountId
        }
      },
      update: {
        displayName: member.displayName,
        capacityDays,
        personalDaysOff,
        isManualOverride: true
      },
      create: {
        sprintId,
        accountId: member.accountId,
        displayName: member.displayName,
        capacityDays,
        personalDaysOff,
        isManualOverride: true
      }
    });
  }

  await prisma.sprintMemberCapacity.deleteMany({
    where: {
      sprintId,
      accountId: {
        notIn: teamMembers.map((member) => member.accountId)
      }
    }
  });

  await rebuildAnalyticsFacts();

  revalidatePath("/capacity");
  revalidatePath("/dashboard");
  revalidatePath("/setup");

  redirect(`/capacity?sprint=${encodeURIComponent(sprintId)}&saved=1`);
}
