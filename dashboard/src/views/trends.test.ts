import { describe, expect, it } from "vitest";
import { sampleHistoryEntry } from "../test/fakeApi";
import { buildTrendSeries } from "./trends";

describe("buildTrendSeries", () => {
  it("drops active sessions without a final score", () => {
    const history = [
      sampleHistoryEntry({ session_id: "SES-1", final_score: 70 }),
      sampleHistoryEntry({ session_id: "SES-2", status: "active", final_score: null }),
    ];
    const series = buildTrendSeries(history);
    expect(series.map((point) => point.sessionId)).toEqual(["SES-1"]);
  });

  it("orders points oldest-first and numbers them from 1", () => {
    const history = [
      sampleHistoryEntry({ session_id: "SES-3", started_at: "2026-01-03T10:00:00", final_score: 90 }),
      sampleHistoryEntry({ session_id: "SES-1", started_at: "2026-01-01T10:00:00", final_score: 50 }),
      sampleHistoryEntry({ session_id: "SES-2", started_at: "2026-01-02T10:00:00", final_score: 70 }),
    ];
    const series = buildTrendSeries(history);
    expect(series.map((point) => point.sessionId)).toEqual(["SES-1", "SES-2", "SES-3"]);
    expect(series.map((point) => point.label)).toEqual(["#1", "#2", "#3"]);
    expect(series.map((point) => point.score)).toEqual([50, 70, 90]);
  });

  it("filters to a single trainee when one is given", () => {
    const history = [
      sampleHistoryEntry({ session_id: "SES-1", trainee_id: "TRAIN-001", final_score: 60 }),
      sampleHistoryEntry({ session_id: "SES-2", trainee_id: "TRAIN-002", final_score: 80 }),
    ];
    const series = buildTrendSeries(history, "TRAIN-002");
    expect(series).toHaveLength(1);
    expect(series[0].sessionId).toBe("SES-2");
  });

  it("tie-breaks equal timestamps by session id", () => {
    const history = [
      sampleHistoryEntry({ session_id: "SES-B", started_at: "2026-01-01T10:00:00", final_score: 10 }),
      sampleHistoryEntry({ session_id: "SES-A", started_at: "2026-01-01T10:00:00", final_score: 20 }),
    ];
    expect(buildTrendSeries(history).map((point) => point.sessionId)).toEqual(["SES-A", "SES-B"]);
  });

  it("returns an empty series for empty history", () => {
    expect(buildTrendSeries([])).toEqual([]);
  });
});
