import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SessionHistoryEntry } from "../api/types";
import type { ViewProps } from "./types";
import { buildTrendSeries } from "./trends";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function TrendsView({ api, traineeId }: ViewProps): JSX.Element {
  const [sessions, setSessions] = useState<SessionHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSessions(null);
    setError(null);
    api
      .listSessions(traineeId || undefined)
      .then((response) => {
        if (active) setSessions(response.sessions);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [api, traineeId]);

  const series = useMemo(
    () => buildTrendSeries(sessions ?? [], traineeId || undefined),
    [sessions, traineeId],
  );

  return (
    <section className="panel">
      <h2>Score trends</h2>
      {error && <p className="error">Failed to load trends: {error}</p>}
      {sessions === null && !error && <p className="muted">Loading…</p>}
      {sessions !== null && series.length === 0 && !error && (
        <p className="muted">No completed sessions for this trainee yet.</p>
      )}
      {series.length > 0 && (
        <>
          <p className="muted">
            {series.length} completed session{series.length === 1 ? "" : "s"} · final score (0-100)
          </p>
          <LineChart
            width={760}
            height={300}
            data={series}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3b4d" />
            <XAxis dataKey="label" stroke="#8b98a5" />
            <YAxis domain={[0, 100]} stroke="#8b98a5" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="score"
              name="Final score"
              stroke="#1f6feb"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </>
      )}
    </section>
  );
}
