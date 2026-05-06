type TeamMemberOverride = {
  active?: boolean;
  preferredName?: string;
};

const TEAM_MEMBER_OVERRIDES: Record<string, TeamMemberOverride> = {
  "712020:d7daa7c4-dbbe-49e0-b505-548dcccf2776": {
    preferredName: "Diego Di Roberto"
  },
  "712020:a43b3bab-22ac-4c15-b0b9-1389646aee50": {
    active: false
  },
  "712020:b3db2e58-164c-4c6a-a668-d008c6621143": {
    active: false
  },
  "712020:a52da54c-1e8e-4e80-acb9-bc1acb0e717a": {
    active: false
  },
  "712020:251e5df2-bfb0-454b-afdc-86ac1b223771": {
    active: false
  },
  "712020:7ef856b3-9e63-444b-9a58-0a9af3118896": {
    active: false
  },
  "712020:4539243b-38df-4e63-9362-54da8878fe4f": {
    active: false
  }
};

export function normalizeDisplayName(name: string | null | undefined) {
  return (name ?? "").replace(/\s+/g, " ").trim();
}

export function applyTeamMemberOverride(accountId: string, displayName: string, active: boolean) {
  const override = TEAM_MEMBER_OVERRIDES[accountId];

  return {
    displayName: override?.preferredName ?? normalizeDisplayName(displayName),
    active: override?.active ?? active
  };
}
