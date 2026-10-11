import type { Environment, ThreatCount, TimeOfDay } from "../api/types";

/** Validated subset of simulator query params; absent keys fall back to defaults. */
export interface ScenarioQuery {
  trainee_id?: string;
  difficulty?: number;
  environment?: Environment;
  time_of_day?: TimeOfDay;
  threat_count?: ThreatCount;
  seed?: number;
}

const ENVIRONMENTS: Environment[] = ["urban", "rural"];
const TIMES: TimeOfDay[] = ["day", "night"];
const THREAT_COUNTS: ThreatCount[] = [1, 2, 3, 5];

function integer(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

/**
 * Parse the simulator's query string into a validated prefill. Unknown or
 * invalid values are dropped so the form falls back to its defaults; this is
 * the receiving half of the dashboard's Play-link contract.
 */
export function parseScenarioParams(search: string): ScenarioQuery {
  const params = new URLSearchParams(search);
  const query: ScenarioQuery = {};

  const traineeId = params.get("trainee_id");
  if (traineeId) query.trainee_id = traineeId;

  const difficulty = integer(params.get("difficulty"));
  if (difficulty !== null && difficulty >= 1 && difficulty <= 10) {
    query.difficulty = difficulty;
  }

  const environment = params.get("environment");
  if (environment && (ENVIRONMENTS as string[]).includes(environment)) {
    query.environment = environment as Environment;
  }

  const timeOfDay = params.get("time_of_day");
  if (timeOfDay && (TIMES as string[]).includes(timeOfDay)) {
    query.time_of_day = timeOfDay as TimeOfDay;
  }

  const threatCount = integer(params.get("threat_count"));
  if (threatCount !== null && (THREAT_COUNTS as number[]).includes(threatCount)) {
    query.threat_count = threatCount as ThreatCount;
  }

  const seed = integer(params.get("seed"));
  if (seed !== null) query.seed = seed;

  return query;
}
