import { z } from "zod";

export const jiraSettingsSchema = z.object({
  baseUrl: z.string().url().includes("atlassian.net"),
  boardId: z.coerce.number().int().positive(),
  projectKey: z.string().min(1).max(12)
});

export type JiraSettingsInput = z.infer<typeof jiraSettingsSchema>;
