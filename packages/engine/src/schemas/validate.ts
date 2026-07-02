import { scenarioInputSchema, type ScenarioInput } from "./scenario-input";
import { quickInputSchema, type QuickInput } from "./quick-input";

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface ValidationIssue {
  /** Dot-joined path into the input object, e.g. `"financing.downPayment"`. */
  path: string;
  message: string;
}

function toIssues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/** Boundary validation (NFR-008): past this point the engine assumes valid data. */
export function validateScenario(raw: unknown): Result<ScenarioInput, ValidationIssue[]> {
  const parsed = scenarioInputSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: toIssues(parsed.error) };
}

export function validateQuickInput(raw: unknown): Result<QuickInput, ValidationIssue[]> {
  const parsed = quickInputSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: toIssues(parsed.error) };
}
