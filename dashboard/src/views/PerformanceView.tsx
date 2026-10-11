import { useEffect, useState } from "react";
import type { PerformanceProfile, RecommendResponse } from "../api/types";
import { formatPercent, formatReactionMs } from "../format";
import type { ViewProps } from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="metric">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function PerformanceView({ api, traineeId }: ViewProps): JSX.Element {
  const [profile, setProfile] = useState<PerformanceProfile | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setRecommendation(null);
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

  async function onRecommend(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setRecommendation(await api.recommend(traineeId));
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Trainee performance</h2>
      {error && <p className="error">Failed: {error}</p>}
      {profile === null && !error && <p className="muted">Loading…</p>}
      {profile !== null && (
        <>
          <p className="muted">
            {profile.trainee_id} · {profile.session_count} completed session
            {profile.session_count === 1 ? "" : "s"} · level {profile.current_level}
          </p>
          <div className="metrics">
            <Metric label="Detection accuracy" value={formatPercent(profile.detection_accuracy)} />
            <Metric
              label="Classification accuracy"
              value={formatPercent(profile.classification_accuracy)}
            />
            <Metric label="Response accuracy" value={formatPercent(profile.response_accuracy)} />
            <Metric
              label="Average reaction time"
              value={formatReactionMs(profile.average_reaction_time_ms)}
            />
          </div>
          <button type="button" onClick={() => void onRecommend()} disabled={busy}>
            {busy ? "Recommending…" : "Recommend next scenario"}
          </button>
        </>
      )}
      {recommendation !== null && (
        <div style={{ marginTop: 12 }}>
          <p>
            Recommended: difficulty <strong>{recommendation.recommended_difficulty}</strong>,{" "}
            {recommendation.environment}, {recommendation.time_of_day},{" "}
            {recommendation.threat_count} threat{recommendation.threat_count === 1 ? "" : "s"}
          </p>
          <pre className="reason">{recommendation.reason}</pre>
        </div>
      )}
    </section>
  );
}
