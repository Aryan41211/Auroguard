/** Display helpers shared by the dashboard views. Pure and locale-independent. */

/** Score on the 0-100 scale, or an em dash when the session is still active. */
export function formatScore(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(1);
}

/** Naive ISO timestamp -> "YYYY-MM-DD HH:MM", deterministic across locales. */
export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

/** Accuracy percentages are already 0-100; null means "no data for this bucket". */
export function formatPercent(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(1) + "%";
}

export function formatReactionMs(value: number | null): string {
  return value === null ? "n/a" : Math.round(value) + " ms";
}

/** Compact condition summary, e.g. "day · urban · clear". */
export function formatConditions(
  timeOfDay: string,
  environment: string,
  visibility: string,
): string {
  return `${timeOfDay} · ${environment} · ${visibility}`;
}
