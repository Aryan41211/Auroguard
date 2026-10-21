import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import type { PerformanceProfile, Scenario, SessionHistoryResponse } from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createApiClient", () => {
  it("lists all sessions without a filter", async () => {
    const payload: SessionHistoryResponse = { sessions: [] };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(payload));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    const result = await api.listSessions();

    expect(result).toEqual(payload);
    expect(fetchFn.mock.calls[0][0]).toBe("/api/v1/sessions");
  });

  it("url-encodes the trainee_id filter for listSessions", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ sessions: [] }));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    await api.listSessions("TRAIN 001");

    expect(fetchFn.mock.calls[0][0]).toBe("/api/v1/sessions?trainee_id=TRAIN%20001");
  });

  it("GETs condition analytics without a filter", async () => {
    const payload = { total_sessions: 0, dimensions: [] };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(payload));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    const result = await api.getConditionAnalytics();

    expect(result).toEqual(payload);
    expect(fetchFn.mock.calls[0][0]).toBe("/api/v1/analytics/conditions");
  });

  it("url-encodes the trainee_id filter for condition analytics", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ total_sessions: 0, dimensions: [] }));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    await api.getConditionAnalytics("TRAIN 001");

    expect(fetchFn.mock.calls[0][0]).toBe(
      "/api/v1/analytics/conditions?trainee_id=TRAIN%20001",
    );
  });

  it("GETs the trainee performance profile", async () => {
    const profile = { trainee_id: "TRAIN-001", session_count: 3 } as PerformanceProfile;
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(profile));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    const result = await api.getPerformance("TRAIN-001");

    expect(result).toEqual(profile);
    expect(fetchFn.mock.calls[0][0]).toBe("/api/v1/trainees/TRAIN-001/performance");
  });

  it("POSTs a recommend request with the trainee_id body", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ recommended_difficulty: 4, reason: "r" }));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    await api.recommend("TRAIN-001");

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/v1/training/recommend");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ trainee_id: "TRAIN-001" });
  });

  it("POSTs a scenario generate request", async () => {
    const scenario = { scenario_id: "SCN-1" } as Scenario;
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(scenario));
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    const result = await api.generateScenario({
      difficulty: 3,
      environment: "urban",
      time_of_day: "day",
      threat_count: 1,
    });

    expect(result).toEqual(scenario);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("/api/v1/scenarios/generate");
    expect(init.method).toBe("POST");
  });

  it("throws with status and detail on a non-2xx response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ detail: "unknown trainee_id: TRAIN-X" }, 404),
    );
    const api = createApiClient("/api/v1", fetchFn as unknown as typeof fetch);

    await expect(api.getPerformance("TRAIN-X")).rejects.toThrow(/404.*unknown trainee_id/);
  });
});
