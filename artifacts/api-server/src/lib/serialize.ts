/**
 * Recursively convert Date objects to ISO strings so Zod response schemas
 * (which expect `string` for datetime fields) parse without errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeDates(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeDates);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = serializeDates(value[key]);
    }
    return out;
  }
  return value;
}
