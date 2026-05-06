const steps = [
  {
    title: "1. Create a Jira API token",
    body:
      "Use the Atlassian account that can read board 1, sprint history, and issue changelogs."
  },
  {
    title: "2. Add local credentials",
    body:
      "Copy .env.example to .env.local and fill JIRA_EMAIL and JIRA_API_TOKEN before the first sync."
  },
  {
    title: "3. Set sprint capacities",
    body:
      "After sync imports the sprint list, configure work days, global holidays, and per-member days off."
  }
];

export function SetupSteps() {
  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Operator Flow</p>
        <h2>What you will do in order</h2>
      </div>
      <div className="step-list">
        {steps.map((step) => (
          <article key={step.title} className="step-card">
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
