"use client";

import { useActionState } from "react";
import {
  importIssuesAction,
  importSprintsAction,
  testConnectionAction
} from "@/app/setup/actions";

type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initialState: ActionState = {
  status: "idle",
  message: ""
};

export function SetupControls() {
  const [connectionState, connectionAction, connectionPending] = useActionState(
    testConnectionAction,
    initialState
  );
  const [importState, importAction, importPending] = useActionState(
    importSprintsAction,
    initialState
  );
  const [issueState, issueAction, issuePending] = useActionState(
    importIssuesAction,
    initialState
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Live Jira Actions</p>
        <h2>Run the first integration steps</h2>
      </div>

      <div className="action-row">
        <form action={connectionAction}>
          <button type="submit" disabled={connectionPending}>
            {connectionPending ? "Testing..." : "Test Jira connection"}
          </button>
        </form>
        <form action={importAction}>
          <button type="submit" disabled={importPending}>
            {importPending ? "Importing..." : "Import sprints"}
          </button>
        </form>
        <form action={issueAction}>
          <button type="submit" disabled={issuePending}>
            {issuePending ? "Importing..." : "Import issues"}
          </button>
        </form>
      </div>

      <div className="feedback-grid">
        <div className={`feedback ${connectionState.status}`}>
          <strong>Connection test</strong>
          <p>{connectionState.message || "No test executed yet."}</p>
        </div>
        <div className={`feedback ${importState.status}`}>
          <strong>Sprint import</strong>
          <p>{importState.message || "No sprint import executed yet."}</p>
        </div>
        <div className={`feedback ${issueState.status}`}>
          <strong>Issue import</strong>
          <p>{issueState.message || "No issue import executed yet."}</p>
        </div>
      </div>
    </section>
  );
}
