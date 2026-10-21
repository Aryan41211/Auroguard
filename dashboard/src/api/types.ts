export type Environment = "urban" | "rural";
export type TimeOfDay = "day" | "night";
export type Visibility = "clear" | "reduced" | "poor";
export type ClassificationLabel = "friendly" | "civilian" | "unknown" | "suspicious" | "hostile";
export type ExpectedResponse = "monitor" | "track" | "report" | "hold";
export type SpeedClass = "slow" | "medium" | "fast";
export type ThreatCount = 1 | 2 | 3 | 5;

export interface ScenarioGenerateRequest {
  difficulty: number;
  environment: Environment;
  time_of_day: TimeOfDay;
  threat_count: ThreatCount;
  seed?: number | null;
}

export interface ThreatProfile {
  id: string;
  category: string;
  classification_label: ClassificationLabel;
  expected_response: ExpectedResponse;
  spawn_time: number;
  speed_class: SpeedClass | null;
  visibility_class: Visibility | null;
}

export interface Scenario {
  scenario_id: string;
  seed: number;
  generator_version: string;
  difficulty: number;
  environment: Environment;
  time_of_day: TimeOfDay;
  visibility: Visibility;
  sensor_quality: number;
  duration_seconds: number;
  threats: ThreatProfile[];
}

/** GET /sessions — one row per session; score fields are null while active. */
export interface SessionHistoryEntry {
  session_id: string;
  trainee_id: string;
  scenario_id: string;
  status: "active" | "completed";
  started_at: string;
  completed_at: string | null;
  seed: number;
  difficulty: number;
  environment: Environment;
  time_of_day: TimeOfDay;
  visibility: Visibility;
  sensor_quality: number;
  threat_count: number;
  final_score: number | null;
  detection_score: number | null;
  classification_score: number | null;
  response_score: number | null;
  timing_score: number | null;
  penalty: number | null;
}

export interface SessionHistoryResponse {
  sessions: SessionHistoryEntry[];
}

/** GET /trainees/{id}/performance — historical aggregates (scores 0-100). */
export interface PerformanceProfile {
  trainee_id: string;
  session_count: number;
  detection_accuracy: number;
  classification_accuracy: number;
  response_accuracy: number;
  average_reaction_time_ms: number | null;
  night_score: number | null;
  day_score: number | null;
  multi_threat_score: number | null;
  low_visibility_score: number | null;
  urban_score: number | null;
  rural_score: number | null;
  clear_visibility_score: number | null;
  reduced_visibility_score: number | null;
  poor_visibility_score: number | null;
  high_sensor_score: number | null;
  medium_sensor_score: number | null;
  low_sensor_score: number | null;
  current_level: number;
}

export interface RecommendRequest {
  trainee_id: string;
}

/** POST /training/recommend — rule-based next-scenario suggestion with a reason. */
export interface RecommendResponse {
  recommended_difficulty: number;
  environment: Environment;
  time_of_day: TimeOfDay;
  threat_count: ThreatCount;
  reason: string;
}

export type AnalyticsDimension = "environment" | "time_of_day" | "visibility";

/** GET /analytics/conditions — aggregates for one condition bucket. */
export interface ConditionBucketMetrics {
  bucket: string;
  session_count: number;
  mean_final_score: number;
  mean_detection_score: number;
  mean_classification_score: number;
  mean_response_score: number;
  mean_timing_score: number;
}

export interface ConditionDimension {
  dimension: AnalyticsDimension;
  buckets: ConditionBucketMetrics[];
}

export interface ConditionsAnalyticsResponse {
  total_sessions: number;
  dimensions: ConditionDimension[];
}
