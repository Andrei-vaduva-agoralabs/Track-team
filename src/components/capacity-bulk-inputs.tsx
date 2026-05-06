"use client";

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function applyDefaultCapacity(workDays: number, globalDaysOff: number) {
  const defaultCapacity = Math.max(workDays - globalDaysOff, 0);
  const capacityInputs = document.querySelectorAll<HTMLInputElement>(
    "[data-member-capacity-input='true']"
  );

  for (const input of capacityInputs) {
    input.value = Number.isInteger(defaultCapacity)
      ? String(defaultCapacity)
      : String(defaultCapacity);
  }
}

export function CapacityBulkInputs({
  sprintWorkDays,
  globalDaysOff,
  disabled
}: {
  sprintWorkDays: number;
  globalDaysOff: number;
  disabled: boolean;
}) {
  return (
    <>
      <label>
        Sprint work days
        <input
          name="sprintWorkDays"
          type="number"
          min="0"
          step="0.5"
          defaultValue={sprintWorkDays}
          disabled={disabled}
          onChange={(event) => {
            const globalInput = document.querySelector<HTMLInputElement>(
              "input[name='globalDaysOff']"
            );
            applyDefaultCapacity(
              parseNumber(event.currentTarget.value),
              parseNumber(globalInput?.value ?? "0")
            );
          }}
        />
      </label>
      <label>
        Global days off
        <input
          name="globalDaysOff"
          type="number"
          min="0"
          step="0.5"
          defaultValue={globalDaysOff}
          disabled={disabled}
          onChange={(event) => {
            const workDaysInput = document.querySelector<HTMLInputElement>(
              "input[name='sprintWorkDays']"
            );
            applyDefaultCapacity(
              parseNumber(workDaysInput?.value ?? "0"),
              parseNumber(event.currentTarget.value)
            );
          }}
        />
      </label>
    </>
  );
}
