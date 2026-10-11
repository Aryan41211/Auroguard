import { useEffect, useState } from "react";
import type { PerformanceProfile } from "../api/types";
import type { ViewProps } from "./types";
import { groupWeaknessCells, heatColor, weaknessCells } from "./weakness";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatCellValue(score: number | null): string {
  return score === null ? "n/a" : score.toFixed(1);
}

export function WeaknessView({ api, traineeId }: ViewProps): JSX.Element {
  const [profile, setProfile] = useState<PerformanceProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setError(null);
    api
      .getPerformance(traineeId)
      .then((response) => {
        if (active) setProfile(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [api, traineeId]);

  const groups = profile ? groupWeaknessCells(weaknessCells(profile)) : [];

  return (
    <section className="panel">
      <h2>Weakness heatmap</h2>
      {error && <p className="error">Failed to load performance: {error}</p>}
      {profile === null && !error && <p className="muted">Loading…</p>}
      {profile !== null && profile.session_count === 0 && (
        <p className="muted">No completed sessions for this trainee yet.</p>
      )}
      {profile !== null && profile.session_count > 0 && (
        <>
          {groups.map((group) => (
            <div key={group.group} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, color: "#8b98a5", margin: "8px 0" }}>{group.group}</h3>
              <div className="heatmap">
                {group.cells.map((cell) => (
                  <div
                    key={cell.id}
                    data-cell={cell.id}
                    className={`heat-cell${cell.score === null ? " is-empty" : ""}`}
                    style={{ background: heatColor(cell.score) }}
                    title={`${group.group}: ${cell.label}`}
                  >
                    <div className="label">{cell.label}</div>
                    <div className="value">{formatCellValue(cell.score)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
