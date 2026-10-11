import { describe, expect, it } from "vitest";
import { sampleScenario } from "../test/fakeApi";
import { buildPlayUrl, reproducibleRequest } from "./instructor";

describe("buildPlayUrl", () => {
  it("emits the full simulator contract including the seed", () => {
    const url = buildPlayUrl(
      { difficulty: 7, environment: "rural", time_of_day: "night", threat_count: 3, seed: 99 },
      "TRAIN-001",
    );
    expect(url).toBe(
      "http://localhost:5173/?seed=99&difficulty=7&environment=rural&time_of_day=night&threat_count=3&trainee_id=TRAIN-001",
    );
  });

  it("omits a null seed and URL-encodes the trainee id", () => {
    const url = buildPlayUrl(
      { difficulty: 3, environment: "urban", time_of_day: "day", threat_count: 1, seed: null },
      "TRAIN 7",
    );
    expect(url).not.toContain("seed=");
    expect(url).toContain("trainee_id=TRAIN+7");
  });

  it("honours a custom base", () => {
    const url = buildPlayUrl(
      { difficulty: 1, environment: "urban", time_of_day: "day", threat_count: 1 },
      "",
      "http://example.test",
    );
    expect(url.startsWith("http://example.test/?")).toBe(true);
    expect(url).not.toContain("trainee_id");
  });
});

describe("reproducibleRequest", () => {
  it("uses the generated scenario's seed", () => {
    const request = {
      difficulty: 5,
      environment: "urban" as const,
      time_of_day: "day" as const,
      threat_count: 2 as const,
      seed: null,
    };
    const merged = reproducibleRequest(request, sampleScenario({ seed: 4242 }));
    expect(merged.seed).toBe(4242);
    expect(merged.difficulty).toBe(5);
  });
});
