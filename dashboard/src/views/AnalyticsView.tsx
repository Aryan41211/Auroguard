import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ConditionsAnalyticsResponse } from "../api/types";
import type { ViewProps } from "./types";
import { buildConditionRows, formatMean, hasConditionData } from "./analytics";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AnalyticsView({ api, traineeId }: ViewProps): JSX.Element {
  const [data, setData] = useState<ConditionsAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    api
      .getConditionAnalytics(traineeId || undefined)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [api, traineeId]);

  const rows = useMemo(() => (data ? buildConditionRows(data) : []), [data]);
  const hasData = data !== null && hasConditionData(data);

  return (
    <section className="panel">
      <h2>Condition analytics</h2>
      {error && <p className="error">Failed to load analytics: {error}</p>}
      {data === null && !error && <p className="muted">Loading…</p>}
      {data !== null && !hasData && !error && (
        <p className="muted">No completed sessions to analyse yet.</p>
      )}
      {hasData && (
        <>
          <p className="muted">
            {data.total_sessions} completed session
            {data.total_sessions === 1 ? "" : "s"} · mean final score by scenario
            condition (0-100)
          </p>
          <BarChart
            width={760}
            height={300}
            data={rows}
            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a3b4d" />
            <XAxis dataKey="label" stroke="#8b98a5" interval={0} angle={-15} height={60} textAnchor="end" />
            <YAxis domain={[0, 100]} stroke="#8b98a5" />
            <Tooltip />
            <Bar
              dataKey="meanFinalScore"
              name="Mean final score"
              fill="#1f6feb"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
          <table aria-label="Condition comparison">
            <thead>
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">Bucket</th>
                <th scope="col">Sessions</th>
                <th scope="col">Final</th>
                <th scope="col">Detection</th>
                <th scope="col">Classification</th>
                <th scope="col">Response</th>
                <th scope="col">Timing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.dimensionLabel}</td>
                  <td>{row.bucket}</td>
                  <td>{row.sessionCount}</td>
                  <td>{formatMean(row.meanFinalScore)}</td>
                  <td>{formatMean(row.meanDetectionScore)}</td>
                  <td>{formatMean(row.meanClassificationScore)}</td>
                  <td>{formatMean(row.meanResponseScore)}</td>
                  <td>{formatMean(row.meanTimingScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
