/**
 * Flat structural diff for revision comparison (NFR-007: "why did the result
 * change?"). Objects are flattened to dot paths; arrays are compared by index.
 */

export interface DiffEntry {
  path: string;
  from: unknown;
  to: unknown;
}

function flatten(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (value === null || typeof value !== "object") {
    out.set(prefix, value);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(prefix, "[]");
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
}

export function diffObjects(from: unknown, to: unknown): DiffEntry[] {
  const before = new Map<string, unknown>();
  const after = new Map<string, unknown>();
  flatten(from, "", before);
  flatten(to, "", after);

  const paths = new Set([...before.keys(), ...after.keys()]);
  const entries: DiffEntry[] = [];
  for (const path of paths) {
    const a = before.get(path);
    const b = after.get(path);
    if (!Object.is(a, b)) entries.push({ path, from: a, to: b });
  }
  return entries.sort((x, y) => x.path.localeCompare(y.path));
}
