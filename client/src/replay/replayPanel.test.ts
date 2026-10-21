import { describe, expect, it } from "vitest";
import type { ReplayResponse } from "../api/types";
import { buildReplayPanelHtml } from "./replayPanel";
import { buildTimeline } from "./timeline";

const replay = {
  session_id: "SES-1",
  trainee_id: "TRAIN-001",
  scenario: {
    scenario_id: "SCN-1",
    seed: 42,
    generator_version: "1.0",
    difficulty: 3,
    environment: "rural",
    time_of_day: "night",
    visibility: "poor",
    sensor_quality: 0.5,
    duration_seconds: 60,
    threats: [],
  },
  events: [],
  frames: [
    {
      timestamp_ms: 0,
      event_id: "EVT-001",
      event_type: "SESSION_STARTED",
      label: "Session started",
      threat_id: null,
      threats: [],
    },
    {
      timestamp_ms: 2500,
      event_id: "EVT-002",
      event_type: "THREAT_DETECTED",
      label: "T-1 detected",
      threat_id: "T-1",
      threats: [
        { threat_id: "T-1", stage: "detected", detected: true, classification: null, response: null },
      ],
    },
  ],
  score: {
    session_id: "SES-1",
    detection_score: 30,
    classification_score: 20,
    response_score: 15,
    timing_score: 10,
    penalty: 0,
    final_score: 75,
    scoring_version: 1,
  },
  duration_ms: 2500,
} as ReplayResponse;

describe("buildReplayPanelHtml", () => {
  it("summarises the session and the score", () => {
    const html = buildReplayPanelHtml(replay, buildTimeline(replay.frames), null);
    expect(html).toContain("SES-1");
    expect(html).toContain("TRAIN-001");
    expect(html).toContain("75.0 / 100");
    expect(html).toContain("seed 42");
  });

  it("renders one row per recorded event", () => {
    const html = buildReplayPanelHtml(replay, buildTimeline(replay.frames), null);
    expect(html).toContain('data-index="0"');
    expect(html).toContain('data-index="1"');
    expect(html).toContain("Session started");
    expect(html).toContain("T-1 detected");
  });

  it("marks the active entry", () => {
    const timeline = buildTimeline(replay.frames);
    const html = buildReplayPanelHtml(replay, timeline, timeline.entries[1]);
    expect(html).toContain('data-index="1"');
    expect(html).toMatch(/class="replay-event is-active"/);
  });

  it("shows the scrubber range and position", () => {
    const timeline = buildTimeline(replay.frames);
    const html = buildReplayPanelHtml(replay, timeline, timeline.entries[0]);
    expect(html).toContain('max="1"');
    expect(html).toContain("1 / 2");
  });

  it("notes when the session is not scored yet", () => {
    const unscored = { ...replay, score: null };
    const html = buildReplayPanelHtml(unscored, buildTimeline(unscored.frames), null);
    expect(html).toContain("session not scored yet");
  });

  it("escapes untrusted label text", () => {
    const hostile = {
      ...replay,
      frames: [
        {
          timestamp_ms: 0,
          event_id: "EVT-001",
          event_type: "SESSION_STARTED" as const,
          label: "<script>alert(1)</script>",
          threat_id: null,
          threats: [],
        },
      ],
    } as ReplayResponse;
    const html = buildReplayPanelHtml(hostile, buildTimeline(hostile.frames), null);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
