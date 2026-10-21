import { vi } from "vitest";
import type { ApiClient } from "../api/client";
import type {
  ConditionsAnalyticsResponse,
  PerformanceProfile,
  RecommendResponse,
  Scenario,
  SessionHistoryEntry,
  SessionHistoryResponse,
  ThreatProfile,
} from "../api/types";

export function sampleThreat(overrides: Partial<ThreatProfile> = {}): ThreatProfile {
  return {
    id: "T01",
    category: "unknown_aerial_object",
    classification_label: "hostile",
    expected_response: "track",
    spawn_time: 0,
    speed_class: "medium",
    visibility_class: "clear",
    ...overrides,
  };
}

export function sampleScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenario_id: "SCN-1",
    seed: 42,
    generator_version: "1.0.0",
    difficulty: 3,
    environment: "urban",
    time_of_day: "day",
    visibility: "clear",
    sensor_quality: 0.8,
    duration_seconds: 90,
    threats: [sampleThreat()],
    ...overrides,
  };
}

export function sampleHistoryEntry(
  overrides: Partial<SessionHistoryEntry> = {},
): SessionHistoryEntry {
  return {
    session_id: "SES-1",
    trainee_id: "TRAIN-001",
    scenario_id: "SCN-1",
    status: "completed",
    started_at: "2026-01-01T12:00:00",
    completed_at: "2026-01-01T12:02:00",
    seed: 42,
    difficulty: 3,
    environment: "urban",
    time_of_day: "day",
    visibility: "clear",
    sensor_quality: 0.8,
    threat_count: 1,
    final_score: 80,
    detection_score: 30,
    classification_score: 25,
    response_score: 15,
    timing_score: 10,
    penalty: 0,
    ...overrides,
  };
}

export function emptyPerformance(traineeId = "TRAIN-001"): PerformanceProfile {
  return {
    trainee_id: traineeId,
    session_count: 0,
    detection_accuracy: 0,
    classification_accuracy: 0,
    response_accuracy: 0,
    average_reaction_time_ms: null,
    night_score: null,
    day_score: null,
    multi_threat_score: null,
    low_visibility_score: null,
    urban_score: null,
    rural_score: null,
    clear_visibility_score: null,
    reduced_visibility_score: null,
    poor_visibility_score: null,
    high_sensor_score: null,
    medium_sensor_score: null,
    low_sensor_score: null,
    current_level: 1,
  };
}

export function samplePerformance(overrides: Partial<PerformanceProfile> = {}): PerformanceProfile {
  return { ...emptyPerformance(), ...overrides };
}

export function sampleRecommendation(
  overrides: Partial<RecommendResponse> = {},
): RecommendResponse {
  return {
    recommended_difficulty: 4,
    environment: "urban",
    time_of_day: "night",
    threat_count: 3,
    reason: "Night score trails overall.",
    ...overrides,
  };
}

export function emptyConditionAnalytics(): ConditionsAnalyticsResponse {
  return {
    total_sessions: 0,
    dimensions: [
      { dimension: "environment", buckets: [] },
      { dimension: "time_of_day", buckets: [] },
      { dimension: "visibility", buckets: [] },
    ],
  };
}

export function sampleConditionAnalytics(
  overrides: Partial<ConditionsAnalyticsResponse> = {},
): ConditionsAnalyticsResponse {
  return {
    total_sessions: 3,
    dimensions: [
      {
        dimension: "environment",
        buckets: [
          {
            bucket: "urban",
            session_count: 2,
            mean_final_score: 85,
            mean_detection_score: 25.5,
            mean_classification_score: 25.5,
            mean_response_score: 21.25,
            mean_timing_score: 12.75,
          },
          {
            bucket: "rural",
            session_count: 1,
            mean_final_score: 70,
            mean_detection_score: 21,
            mean_classification_score: 21,
            mean_response_score: 17.5,
            mean_timing_score: 10.5,
          },
        ],
      },
      { dimension: "time_of_day", buckets: [] },
      { dimension: "visibility", buckets: [] },
    ],
    ...overrides,
  };
}

export interface FakeApiOptions {
  sessions?: SessionHistoryResponse;
  performance?: PerformanceProfile;
  recommendation?: RecommendResponse;
  scenario?: Scenario;
  conditionAnalytics?: ConditionsAnalyticsResponse;
}

export function createFakeApi(options: FakeApiOptions = {}): ApiClient {
  return {
    listSessions: vi.fn(async () => options.sessions ?? { sessions: [] }),
    getPerformance: vi.fn(async () => options.performance ?? emptyPerformance()),
    getConditionAnalytics: vi.fn(
      async () => options.conditionAnalytics ?? emptyConditionAnalytics(),
    ),
    recommend: vi.fn(async () => options.recommendation ?? sampleRecommendation()),
    generateScenario: vi.fn(async () => options.scenario ?? sampleScenario()),
  };
}
