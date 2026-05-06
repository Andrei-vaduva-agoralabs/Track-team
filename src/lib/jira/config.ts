import { z } from "zod";

const jiraEnvSchema = z.object({
  JIRA_BASE_URL: z.string().url(),
  JIRA_EMAIL: z.string().email(),
  JIRA_API_TOKEN: z.string().min(1),
  JIRA_BOARD_ID: z.string().regex(/^\d+$/),
  JIRA_PROJECT_KEY: z.string().min(1)
});

export type JiraEnv = z.infer<typeof jiraEnvSchema> & {
  JIRA_BOARD_ID: string;
};

export function getJiraEnv() {
  return jiraEnvSchema.parse({
    JIRA_BASE_URL: process.env.JIRA_BASE_URL,
    JIRA_EMAIL: process.env.JIRA_EMAIL,
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
    JIRA_BOARD_ID: process.env.JIRA_BOARD_ID,
    JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY
  });
}

export function hasJiraCredentials() {
  return Boolean(process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
}
