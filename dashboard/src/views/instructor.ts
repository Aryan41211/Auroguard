import type { Scenario, ScenarioGenerateRequest } from "../api/types";

/** The simulator dev server owns 5173 (the dashboard owns 5174). */
export const SIMULATOR_BASE = "http://localhost:5173";

/**
 * Query keys the simulator's start panel reads to prefill a scenario. This
 * list is the dashboard <-> simulator contract; it must match
 * `client/src/ui/scenarioParams.ts`.
 */
export const PLAY_QUERY_KEYS = [
  "seed",
  "difficulty",
  "environment",
  "time_of_day",
  "threat_count",
  "trainee_id",
] as const;

/** Build the simulator URL that opens a ready-to-start, reproducible scenario. */
export function buildPlayUrl(
  request: ScenarioGenerateRequest,
  traineeId: string,
  base: string = SIMULATOR_BASE,
): string {
  const params = new URLSearchParams();
  if (request.seed !== undefined && request.seed !== null) {
    params.set("seed", String(request.seed));
  }
  params.set("difficulty", String(request.difficulty));
  params.set("environment", request.environment);
  params.set("time_of_day", request.time_of_day);
  params.set("threat_count", String(request.threat_count));
  if (traineeId) params.set("trainee_id", traineeId);
  return `${base}/?${params.toString()}`;
}

/**
 * Merge the generated scenario's seed back into the request so the Play link
 * reproduces the exact scenario, even when the instructor left the seed blank.
 */
export function reproducibleRequest(
  request: ScenarioGenerateRequest,
  scenario: Scenario,
): ScenarioGenerateRequest {
  return { ...request, seed: scenario.seed };
}
