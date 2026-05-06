type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon?: "users" | "check" | "points" | "clock" | "activity" | "ratio" | "handoff" | "target";
  tone?: "blue" | "green" | "amber" | "red" | "teal" | "violet" | "slate" | "rose";
};

function StatIcon({ name }: { name: NonNullable<StatCardProps["icon"]> }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  if (name === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  if (name === "points") {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M8 19v-7" />
        <path d="M12 19V9" />
        <path d="M16 19v-4" />
        <path d="M20 19V7" />
      </svg>
    );
  }

  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  }

  if (name === "activity") {
    return (
      <svg {...common}>
        <path d="M22 12h-4l-3 7L9 5l-3 7H2" />
      </svg>
    );
  }

  if (name === "handoff") {
    return (
      <svg {...common}>
        <path d="M7 7h10" />
        <path d="m14 4 3 3-3 3" />
        <path d="M17 17H7" />
        <path d="m10 14-3 3 3 3" />
      </svg>
    );
  }

  if (name === "target") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <path d="M4 6h16" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon = "target",
  tone = "blue"
}: StatCardProps) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-icon">
          <StatIcon name={icon} />
        </span>
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
