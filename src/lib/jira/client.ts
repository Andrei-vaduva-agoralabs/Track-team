import { getJiraEnv } from "@/lib/jira/config";

type JiraRequestOptions = RequestInit & {
  searchParams?: Record<string, string | number | boolean | undefined>;
};

export class JiraApiError extends Error {
  status: number;
  details: string;

  constructor(status: number, details: string) {
    super(`Jira request failed with status ${status}`);
    this.status = status;
    this.details = details;
  }
}

export async function jiraRequest<T>(
  path: string,
  options: JiraRequestOptions = {}
): Promise<T> {
  const env = getJiraEnv();
  const url = new URL(path, env.JIRA_BASE_URL);

  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value != null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const auth = Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64");

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      ...(options.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new JiraApiError(response.status, details);
  }

  return response.json() as Promise<T>;
}
