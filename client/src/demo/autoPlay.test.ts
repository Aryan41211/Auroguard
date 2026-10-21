import { describe, expect, it, vi } from "vitest";
import type { ClassificationLabel, ExpectedResponse, Scenario } from "../api/types";
import { createAutoPlay } from "./autoPlay";

const scenario = {
  scenario_id: "SCN-1",
  seed: 7,
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

interface Harness {
  detect: string[];
  classify: Array<[string, ClassificationLabel]>;
  respond: Array<[string, ExpectedResponse]>;
  run(): void;
  auto: ReturnType<typeof createAutoPlay>;
}

function harness(mistakeMode: "none" | "last-threat" = "none"): Harness {
  const timers: Array<() => void> = [];
  const detect: string[] = [];
  const classify: Array<[string, ClassificationLabel]> = [];
  const respond: Array<[string, ExpectedResponse]> = [];
  const auto = createAutoPlay(scenario, {
    onDetect: (id) => detect.push(id),
    onClassify: (id, label) => classify.push([id, label]),
    onRespond: (id, response) => respond.push([id, response]),
    stepDelayMs: 10,
    mistakeMode,
    setTimeoutFn: (callback) => {
      timers.push(callback);
      return timers.length;
    },
    clearTimeoutFn: vi.fn(),
  });
  return {
    detect,
    classify,
    respond,
    auto,
    run() {
      while (timers.length > 0) {
        const next = timers.shift();
        next?.();
      }
    },
  };
}

describe("createAutoPlay", () => {
  it("detects, classifies and responds to a spawned threat", () => {
    const h = harness();
    h.auto.onSpawn("T-1");
    h.run();
    expect(h.detect).toEqual(["T-1"]);
    expect(h.classify).toEqual([["T-1", "unknown"]]);
    expect(h.respond).toEqual([["T-1", "track"]]);
  });

  it("ignores an unknown threat id", () => {
    const h = harness();
    h.auto.onSpawn("T-99");
    h.run();
    expect(h.detect).toEqual([]);
  });

  it("never handles the same threat twice", () => {
    const h = harness();
    h.auto.onSpawn("T-1");
    h.auto.onSpawn("T-1");
    h.run();
    expect(h.detect).toEqual(["T-1"]);
  });

  it("classifies the last threat wrongly in mistake mode", () => {
    const h = harness("last-threat");
    h.auto.onSpawn("T-1");
    h.auto.onSpawn("T-2");
    h.run();
    expect(h.classify).toEqual([
      ["T-1", "unknown"],
      ["T-2", "suspicious"],
    ]);
  });

  it("stops scheduling after cancel", () => {
    const h = harness();
    h.auto.onSpawn("T-1");
    h.auto.cancel();
    h.run();
    expect(h.detect).toEqual([]);
    expect(h.auto.isActive()).toBe(false);
  });
});
