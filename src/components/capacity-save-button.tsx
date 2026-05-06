"use client";

import { useFormStatus } from "react-dom";

export function CapacitySaveButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save sprint capacity"}
    </button>
  );
}
