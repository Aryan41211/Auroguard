import type {
  AnalyticsDimension,
  ConditionBucketMetrics,
  ConditionsAnalyticsResponse,
} from "../api/types";

const DIMENSION_LABELS: Record<AnalyticsDimension, string> = {
  environment: "Environment",
  time_of_day: "Time of day",
  visibility: "Visibility",
};

/** One table/chart row: a condition bucket and its aggregate scores. */
export interface ConditionComparisonRow {
  /** Stable key, also used for test-friendly attributes. */
  key: string;
  dimension: AnalyticsDimension;
  dimensionLabel: string;
  bucket: string;
  /** Short label for the bar chart x-axis. */
  label: string;
  sessionCount: number;
  meanFinalScore: number;
  meanDetectionScore: number;
  meanClassificationScore: number;
  meanResponseScore: number;
  meanTimingScore: number;
}

function toRow(
  dimension: AnalyticsDimension,
  bucket: ConditionBucketMetrics,
): ConditionComparisonRow {
  const dimensionLabel = DIMENSION_LABELS[dimension];
  return {
    key: `${dimension}:${bucket.bucket}`,
    dimension,
    dimensionLabel,
    bucket: bucket.bucket,
    label: `${bucket.bucket} · ${dimensionLabel}`,
    sessionCount: bucket.session_count,
    meanFinalScore: bucket.mean_final_score,
    meanDetectionScore: bucket.mean_detection_score,
    meanClassificationScore: bucket.mean_classification_score,
    meanResponseScore: bucket.mean_response_score,
    meanTimingScore: bucket.mean_timing_score,
  };
}

/**
 * Flatten the API response into display rows, preserving the canonical
 * dimension and bucket order returned by the server.
 */
export function buildConditionRows(
  response: ConditionsAnalyticsResponse,
): ConditionComparisonRow[] {
  return response.dimensions.flatMap((dimension) =>
    dimension.buckets.map((bucket) => toRow(dimension.dimension, bucket)),
  );
}

export function hasConditionData(response: ConditionsAnalyticsResponse): boolean {
  return response.total_sessions > 0 && buildConditionRows(response).length > 0;
}

/** Format an aggregate score with at most two decimals. */
export function formatMean(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
