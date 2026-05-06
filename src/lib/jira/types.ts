export type JiraBoard = {
  id: number;
  name: string;
  type: string;
};

export type JiraUser = {
  accountId: string;
  displayName: string;
  active: boolean;
};

export type JiraField = {
  id: string;
  key: string;
  name: string;
  custom?: boolean;
  schema?: {
    type?: string;
    custom?: string;
  };
};

export type JiraSprint = {
  id: number;
  self: string;
  state: string;
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
  originBoardId?: number;
};

export type JiraPaginated<T> = {
  values: T[];
  startAt: number;
  maxResults: number;
  isLast: boolean;
};

export type JiraHistoryItem = {
  field: string;
  fieldId?: string;
  from?: string | null;
  fromString?: string | null;
  to?: string | null;
  toString?: string | null;
};

export type JiraHistory = {
  id: string;
  created: string;
  author?: {
    accountId?: string;
    displayName?: string;
  };
  items: JiraHistoryItem[];
};

export type JiraIssue = {
  id: string;
  key: string;
  changelog?: {
    histories: JiraHistory[];
  };
  fields: {
    summary: string;
    created: string;
    updated: string;
    project: {
      key: string;
    };
    status: {
      name: string;
      statusCategory?: {
        name?: string;
      };
    };
    issuetype: {
      name: string;
      subtask: boolean;
    };
    assignee?: {
      accountId?: string;
      displayName?: string;
    } | null;
    creator?: {
      accountId?: string;
      displayName?: string;
    } | null;
    reporter?: {
      accountId?: string;
      displayName?: string;
    } | null;
    sprint?: JiraSprint;
    [key: string]: unknown;
  };
};

export type JiraIssueSearchResults = {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
};
