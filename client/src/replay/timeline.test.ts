import { describe, expect, it } from "vitest";
import type { ReplayFrame, Scenario } from "../api/types";
import {
  buildTimeline,
  describeState,
  entryAt,
  formatTimestamp,
  indexAt,
  statesAt,
} from "./timeline";

const scenario = {
  scenario_id: "SCN-1",
  seed: 42,
  generator_version: "1.0",
  difficulty: 3,
  environment: "rural",
  time_of_day: "day",
  visibility: "clear",
  sensor_quality: 0.8,
  duration_seconds: 60,
  threats: [
    {
      id: "T-1",
      category: "quadcopter",
      classification_label: "unknown",
      expected_response: "track",
      spawn_time: 2,
      speed_class: "medium",
      visibility_class: "clear",
    },
    {
      id: "T-2",
      category: "fixed_wing",
      classification_label: "friendly",
      expected_response: "monitor",
      spawn_time: 8,
      speed_class: "fast",
      visibility_class: "clear",
    },
  ],
} as Scenario;

function frame(
  timestampMs: number,
  eventType: string,
  label: string,
  threats: ReplayFrame["threats"] = [],
): ReplayFrame {
  return {
    timestamp_ms: timestampMs,
    event_id: `EVT-${timestampMs}`,
    event_type: eventType as ReplayFrame["event_type"],
    label,
    threat_id: null,
    threats,
  };
}

const state = (
  threatId: string,
  stage: ReplayFrame["threats"][number]["stage"],
  extra: Partial<ReplayFrame["threats"][number]> = {},
) => ({ threat_id: threatId, stage, detected: stage !== "pending", ...extra });

describe("buildTimeline", () => {
  it("maps every frame to an indexed entry", () => {
    const timeline = buildTimeline([
      frame(0, "SESSION_STARTED", "Session started"),
      frame(2000, "THREAT_SPAWNED", "T-1 appeared"),
    ]);
    expect(timeline.entries).toHaveLength(2);
    expect(timeline.entries[1]).toMatchObject({
      index: 1,
      timestampMs: 2000,
      label: "T-1 appeared",
      eventType: "THREAT_SPAWNED",
    });
  });

  it("uses the last recorded timestamp as the duration", () => {
    const timeline = buildTimeline([
      frame(0, "SESSION_STARTED", "Session started"),
      frame(4200, "RESPONSE_SUBMITTED", "T-1 response: track"),
    ]);
    expect(timeline.durationMs).toBe(4200);
  });

  it("is empty for a session without events", () => {
    const timeline = buildTimeline([]);
    expect(timeline.entries).toEqual([]);
    expect(timeline.durationMs).toBe(0);
  });
});

describe("indexAt", () => {
  const timeline = buildTimeline([
    frame(0, "SESSION_STARTED", "Session started"),
    frame(2000, "THREAT_SPAWNED", "T-1 appeared", [state("T-1", "spawned")]),
    frame(3000, "THREAT_DETECTED", "T-1 detected", [state("T-1", "detected")]),
  ]);

  it("returns -1 before the first event", () => {
    expect(indexAt(timeline, -1)).toBe(-1);
  });

  it("returns the last frame at or before the timestamp", () => {
    expect(indexAt(timeline, 0)).toBe(0);
    expect(indexAt(timeline, 1999)).toBe(0);
    expect(indexAt(timeline, 2000)).toBe(1);
    expect(indexAt(timeline, 9999)).toBe(2);
  });
});

describe("statesAt", () => {
  const timeline = buildTimeline([
    frame(0, "SESSION_STARTED", "Session started"),
    frame(2000, "THREAT_SPAWNED", "T-1 appeared", [state("T-1", "spawned")]),
  ]);

  it("falls back to all-pending when the frame carries no states", () => {
    const states = statesAt(timeline, scenario, 0);
    expect(states.map((s) => s.stage)).toEqual(["pending", "pending"]);
    expect(states.map((s) => s.threat_id)).toEqual(["T-1", "T-2"]);
  });

  it("returns the recorded state at the timestamp", () => {
    const states = statesAt(timeline, scenario, 2500);
    const t1 = states.find((s) => s.threat_id === "T-1");
    expect(t1?.stage).toBe("spawned");
  });
});

describe("entryAt", () => {
  const timeline = buildTimeline([
    frame(0, "SESSION_STARTED", "Session started"),
    frame(2000, "THREAT_SPAWNED", "T-1 appeared"),
  ]);

  it("clamps the index into range", () => {
    expect(entryAt(timeline, -5)?.index).toBe(0);
    expect(entryAt(timeline, 99)?.index).toBe(1);
  });

  it("returns null when there are no frames", () => {
    expect(entryAt(buildTimeline([]), 0)).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("formats minutes, seconds and tenths", () => {
    expect(formatTimestamp(0)).toBe("0:00.0");
    expect(formatTimestamp(4200)).toBe("0:04.2");
    expect(formatTimestamp(65000)).toBe("1:05.0");
  });

  it("never renders a negative time", () => {
    expect(formatTimestamp(-500)).toBe("0:00.0");
  });
});

describe("describeState", () => {
  it("describes each stage", () => {
    expect(describeState(state("T-1", "pending"))).toBe("not seen");
    expect(describeState(state("T-1", "spawned"))).toBe("on screen");
    expect(describeState(state("T-1", "detected"))).toBe("detected");
    expect(describeState(state("T-1", "classified", { classification: "hostile" }))).toBe(
      "classified hostile",
    );
    expect(describeState(state("T-1", "responded", { response: "report" }))).toBe(
      "responded report",
    );
    expect(describeState(state("T-1", "missed"))).toBe("missed");
  });
});
