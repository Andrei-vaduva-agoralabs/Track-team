"use client";

import { useActionState } from "react";
import { refreshBoardAction } from "@/app/dashboard/actions";

const initialState = {
  status: "idle" as const,
  message: ""
};

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

export function RefreshBoardButton() {
  const [state, action, pending] = useActionState(refreshBoardAction, initialState);

  return (
    <div className="sync-control">
      <form action={action}>
        <button className="secondary-action" type="submit" disabled={pending}>
          <RefreshIcon />
          <span>{pending ? "Syncing..." : "Refresh board"}</span>
        </button>
      </form>
      {state.message ? (
        <p className={`sync-message ${state.status}`}>{state.message}</p>
      ) : null}
    </div>
  );
}
