type SprintOption = {
  id: string;
  name: string;
  state: string;
};

type SprintSwitcherProps = {
  sprints: SprintOption[];
  selectedSprintId?: string;
  action?: string;
};

export function SprintSwitcher({
  sprints,
  selectedSprintId,
  action = "/dashboard"
}: SprintSwitcherProps) {
  return (
    <form className="sprint-switcher" action={action} method="get">
      <label>
        Sprint
        <select name="sprint" defaultValue={selectedSprintId}>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name} ({sprint.state})
            </option>
          ))}
        </select>
      </label>
      <button type="submit">View sprint</button>
    </form>
  );
}
