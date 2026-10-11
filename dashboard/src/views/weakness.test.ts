import { describe, expect, it } from "vitest";
import { samplePerformance } from "../test/fakeApi";
import { groupWeaknessCells, heatColor, weaknessCells } from "./weakness";

describe("weaknessCells", () => {
  it("maps every condition bucket from the profile", () => {
    const cells = weaknessCells(
      samplePerformance({ day_score: 80, night_score: 30, multi_threat_score: 45 }),
    );
    const byId = Object.fromEntries(cells.map((cell) => [cell.id, cell]));
    expect(byId["day"]).toMatchObject({ group: "Time of day", label: "day", score: 80 });
    expect(byId["night"]).toMatchObject({ group: "Time of day", score: 30 });
    expect(byId["multi-threat"]).toMatchObject({ group: "Threats", score: 45 });
    expect(cells).toHaveLength(11);
  });

  it("keeps null buckets as null", () => {
    const cells = weaknessCells(samplePerformance());
    expect(cells.every((cell) => cell.score === null)).toBe(true);
  });
});

describe("groupWeaknessCells", () => {
  it("keeps the declared group order", () => {
    const groups = groupWeaknessCells(weaknessCells(samplePerformance()));
    expect(groups.map((group) => group.group)).toEqual([
      "Time of day",
      "Environment",
      "Visibility",
      "Sensor",
      "Threats",
    ]);
  });

  it("drops groups that have no cells", () => {
    const cells = weaknessCells(samplePerformance()).filter(
      (cell) => cell.group === "Visibility" || cell.group === "Sensor",
    );
    expect(groupWeaknessCells(cells).map((group) => group.group)).toEqual([
      "Visibility",
      "Sensor",
    ]);
  });
});

describe("heatColor", () => {
  it("interpolates red to green across the score range", () => {
    expect(heatColor(0)).toBe("hsl(0 65% 45%)");
    expect(heatColor(50)).toBe("hsl(60 65% 45%)");
    expect(heatColor(100)).toBe("hsl(120 65% 45%)");
  });

  it("clamps out-of-range scores", () => {
    expect(heatColor(-10)).toBe("hsl(0 65% 45%)");
    expect(heatColor(140)).toBe("hsl(120 65% 45%)");
  });

  it("shows a neutral colour for null buckets", () => {
    expect(heatColor(null)).toBe("#30363d");
  });
});
