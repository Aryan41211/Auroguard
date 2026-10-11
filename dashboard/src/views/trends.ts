import type { SessionHistoryEntry } from "../api/types";

export interface TrendPoint {
  /** 1-based position in chronological order, used as the x-axis label. */
  label: string;
  /** Final score on the 0-100 scale. */
  score: number;
  sessionId: string;
  startedAt: string;
}

/**
 * Build a chronological score series for one trainee.
 *
 * Active sessions (no final score) are dropped. The history endpoint returns
 * newest-first, so the series is sorted oldest-first for a left-to-right trend.
 */
export function buildTrendSeries(
  history: SessionHistoryEntry[],
  traineeId?: string,
): TrendPoint[] {
  return history
    .filter((entry) => entry.final_score !== null)
    .filter((entry) => !traineeId || entry.trainee_id === traineeId)
    .slice()
    .sort(
      (a, b) =>
        a.started_at.localeCompare(b.started_at) ||
        a.session_id.localeCompare(b.session_id),
    )
    .map((entry, index) => ({
      label: `#${index + 1}`,
      score: entry.final_score as number,
      sessionId: entry.session_id,
      startedAt: entry.started_at,
    }));
}
