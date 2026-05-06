async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  const { importIssuesFromJira, importSprintsFromJira } = await import("@/lib/jira/sync");

  if (!process.argv.includes("--issues-only")) {
    const sprints = await importSprintsFromJira();
    console.log(`Imported ${sprints.imported} sprints.`);
  }

  const issues = await importIssuesFromJira();
  console.log(
    `Imported ${issues.importedIssues} issues across ${issues.sprintCount} sprints for ${issues.teamCount} team members.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
