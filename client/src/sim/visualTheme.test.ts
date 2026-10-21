import { describe, expect, it } from "vitest";
import type { Environment, Scenario, Visibility } from "../api/types";
import {
  createRng,
  createVisualTheme,
  generateEnvironmentLayout,
  sunDirection,
} from "./visualTheme";

function scenario(
  environment: Environment = "urban",
  timeOfDay: "day" | "night" = "day",
  visibility: Visibility = "clear",
  seed = 42,
): Scenario {
  return {
    scenario_id: `scenario-${seed}`,
    seed,
    generator_version: "v1",
    difficulty: 2,
    environment,
    time_of_day: timeOfDay,
    visibility,
    sensor_quality: 0.8,
    duration_seconds: 120,
    threats: [],
  };
}

describe("createVisualTheme", () => {
  it("produces different skies, lighting and exposure for day and night", () => {
    const day = createVisualTheme(scenario("urban", "day"));
    const night = createVisualTheme(scenario("urban", "night"));

    expect(day.skyTop).not.toBe(night.skyTop);
    expect(day.fog).not.toBe(night.fog);
    expect(day.sunIntensity).toBeGreaterThan(night.sunIntensity);
    expect(night.runwayLights).toBe(true);
    expect(day.runwayLights).toBe(false);
    expect(night.starOpacity).toBeGreaterThan(0);
    expect(day.starOpacity).toBe(0);
  });

  it("pulls the fog in as visibility worsens", () => {
    const clear = createVisualTheme(scenario("rural", "day", "clear"));
    const reduced = createVisualTheme(scenario("rural", "day", "reduced"));
    const poor = createVisualTheme(scenario("rural", "day", "poor"));

    expect(reduced.fogFar).toBeLessThan(clear.fogFar);
    expect(poor.fogFar).toBeLessThan(reduced.fogFar);
    expect(poor.fogNear).toBeLessThan(reduced.fogNear);
    expect(poor.hazeOpacity).toBeGreaterThan(reduced.hazeOpacity);
  });

  it("places the sun above the horizon", () => {
    const direction = sunDirection(createVisualTheme(scenario()));
    expect(direction.y).toBeGreaterThan(0);
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 5);
  });
});

describe("generateEnvironmentLayout", () => {
  it("is deterministic for a given seed and environment", () => {
    expect(generateEnvironmentLayout(7, "urban")).toEqual(generateEnvironmentLayout(7, "urban"));
    expect(generateEnvironmentLayout(7, "rural")).toEqual(generateEnvironmentLayout(7, "rural"));
  });

  it("changes when the seed changes", () => {
    expect(generateEnvironmentLayout(7, "urban")).not.toEqual(
      generateEnvironmentLayout(8, "urban"),
    );
  });

  it("keeps buildings out of the central flight corridor and inside the world", () => {
    for (const environment of ["urban", "rural"] as const) {
      const layout = generateEnvironmentLayout(123, environment);
      expect(layout.buildings.length).toBeGreaterThan(0);
      for (const building of layout.buildings) {
        expect(Math.abs(building.x)).toBeLessThan(180);
        expect(Math.abs(building.z)).toBeLessThan(180);
        expect(Math.abs(building.z)).toBeGreaterThanOrEqual(27);
        expect(building.width).toBeGreaterThan(0);
        expect(building.height).toBeGreaterThan(0);
      }
    }
  });

  it("fills rural scenes with more trees than the city", () => {
    const urban = generateEnvironmentLayout(5, "urban");
    const rural = generateEnvironmentLayout(5, "rural");
    expect(rural.trees.length).toBeGreaterThan(urban.trees.length);
    for (const tree of [...urban.trees, ...rural.trees]) {
      expect(tree.scale).toBeGreaterThan(0);
      expect(Math.abs(tree.x)).toBeLessThan(180);
      expect(Math.abs(tree.z)).toBeLessThan(180);
    }
  });
});

describe("createRng", () => {
  it("stays in [0, 1) and repeats for the same seed", () => {
    const first = createRng(99);
    const second = createRng(99);
    for (let i = 0; i < 50; i += 1) {
      const value = first();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(value).toBe(second());
    }
  });
});
