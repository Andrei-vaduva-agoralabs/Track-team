export const STORY_POINT_REFERENCE = [
  {
    points: 1,
    effort: "Minimum effort",
    time: "A few minutes",
    complexity: "Little complexity",
    risk: "None",
    referenceDays: 0.125
  },
  {
    points: 2,
    effort: "Minimum effort",
    time: "A few hours",
    complexity: "Little complexity",
    risk: "None",
    referenceDays: 0.5
  },
  {
    points: 3,
    effort: "Mild effort",
    time: "A day",
    complexity: "Low complexity",
    risk: "Low",
    referenceDays: 1
  },
  {
    points: 5,
    effort: "Moderate effort",
    time: "A few days",
    complexity: "Medium complexity",
    risk: "Moderate",
    referenceDays: 3
  },
  {
    points: 8,
    effort: "Severe effort",
    time: "A week",
    complexity: "Medium complexity",
    risk: "Moderate",
    referenceDays: 5
  },
  {
    points: 13,
    effort: "Maximum effort",
    time: "A month",
    complexity: "High complexity",
    risk: "High",
    referenceDays: 20
  }
] as const;

const REFERENCE_DAY_MAP = new Map<number, number>(
  STORY_POINT_REFERENCE.map((item) => [item.points, item.referenceDays])
);

export function referenceDaysForStoryPoints(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return REFERENCE_DAY_MAP.get(value) ?? null;
}

export function formatDayValue(value: number | null | undefined) {
  if (value == null) {
    return "N/A";
  }

  return `${value.toFixed(1)}d`;
}
