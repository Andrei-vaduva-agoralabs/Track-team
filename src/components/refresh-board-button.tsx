function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 16h5v5" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M16 8h5V3" />
    </svg>
  );
}

export function RefreshBoardButton({ sprintId }: { sprintId?: string }) {
  return (
    <div className="sync-control">
      <form action="/dashboard/refresh" method="post">
        <input type="hidden" name="sprintId" value={sprintId ?? ""} />
        <button className="secondary-action" type="submit">
          <RefreshIcon />
          <span>Refresh board</span>
        </button>
      </form>
    </div>
  );
}
