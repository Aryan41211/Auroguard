import { describe, expect, it } from "vitest";
import type { ConditionsAnalyticsResponse } from "../api/types";
import { buildConditionRows, formatMean, hasConditionData } from "./analytics";

const response: ConditionsAnalyticsResponse = {
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
    {
      dimension: "time_of_day",
      buckets: [
        {
          bucket: "day",
          session_count: 1,
          mean_final_score: 85,
          mean_detection_score: 25.5,
          mean_classification_score: 25.5,
          mean_response_score: 21.25,
          mean_timing_score: 12.75,
        },
      ],
    },
  ],
};

describe("buildConditionRows", () => {
  it("flattens dimensions into labelled rows in server order", () => {
    const rows = buildConditionRows(response);

    expect(rows.map((row) => row.key)).toEqual([
      "environment:urban",
      "environment:rural",
      "time_of_day:day",
    ]);
    expect(rows[0]).toMatchObject({
      dimensionLabel: "Environment",
      bucket: "urban",
      label: "urban · Environment",
      sessionCount: 2,
      meanFinalScore: 85,
      meanDetectionScore: 25.5,
      meanClassificationScore: 25.5,
      meanResponseScore: 21.25,
      meanTimingScore: 12.75,
    });
    expect(rows[2].dimensionLabel).toBe("Time of day");
  });

  it("returns no rows for an empty response", () => {
    const rows = buildConditionRows({
      total_sessions: 0,
      dimensions: [
        { dimension: "environment", buckets: [] },
        { dimension: "time_of_day", buckets: [] },
        { dimension: "visibility", buckets: [] },
      ],
    });

    expect(rows).toEqual([]);
    expect(hasConditionData({ total_sessions: 0, dimensions: [] })).toBe(false);
    expect(hasConditionData(response)).toBe(true);
  });
});

describe("formatMean", () => {
  it("keeps integers short and uses two decimals otherwise", () => {
    expect(formatMean(85)).toBe("85");
    expect(formatMean(21.25)).toBe("21.25");
    expect(formatMean(12.3)).toBe("12.30");
  });
});
