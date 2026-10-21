import { useEffect, useState } from "react";
import type { SessionHistoryEntry } from "../api/types";
import { replayUrl } from "../config";
import { formatConditions, formatDateTime, formatScore } from "../format";
import type { ViewProps } from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function HistoryView({ api, traineeId }: ViewProps): JSX.Element {
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

  return (
    <section className="panel">
      <h2>Session history</h2>
      {error && <p className="error">Failed to load history: {error}</p>}
      {sessions === null && !error && <p className="muted">Loading…</p>}
      {sessions !== null && sessions.length === 0 && (
        <p className="muted">No sessions yet. Seed demo data or run a scenario.</p>
      )}
      {sessions !== null && sessions.length > 0 && (
        <table>
          <caption className="muted" style={{ textAlign: "left", padding: "0 0 8px" }}>
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </caption>
          <thead>
            <tr>
              <th scope="col">Session</th>
              <th scope="col">Trainee</th>
              <th scope="col">Status</th>
              <th scope="col">Started</th>
              <th scope="col">Diff.</th>
              <th scope="col">Conditions</th>
              <th scope="col">Threats</th>
              <th scope="col">Final</th>
              <th scope="col">Replay</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.session_id}>
                <td>{session.session_id}</td>
                <td>{session.trainee_id}</td>
                <td>{session.status}</td>
                <td>{formatDateTime(session.started_at)}</td>
                <td>{session.difficulty}</td>
                <td>
                  {formatConditions(
                    session.time_of_day,
                    session.environment,
                    session.visibility,
                  )}
                </td>
                <td>{session.threat_count}</td>
                <td>{formatScore(session.final_score)}</td>
                <td>
                  <a
                    href={replayUrl(session.session_id)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Replay session ${session.session_id}`}
                  >
                    Watch
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
