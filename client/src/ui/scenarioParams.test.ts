import { describe, expect, it } from "vitest";
import { parseScenarioParams } from "./scenarioParams";

describe("parseScenarioParams", () => {
  it("parses a full valid query", () => {
    const query = parseScenarioParams(
      "?seed=99&difficulty=7&environment=rural&time_of_day=night&threat_count=3&trainee_id=TRAIN-009",
    );
    expect(query).toEqual({
      seed: 99,
      difficulty: 7,
      environment: "rural",
      time_of_day: "night",
      threat_count: 3,
      trainee_id: "TRAIN-009",
    });
  });

  it("accepts a query with or without the leading question mark", () => {
    expect(parseScenarioParams("difficulty=5")).toEqual({ difficulty: 5 });
    expect(parseScenarioParams("?difficulty=5")).toEqual({ difficulty: 5 });
  });

  it("returns an empty object for an empty query", () => {
    expect(parseScenarioParams("")).toEqual({});
  });

  it("drops an out-of-range or non-integer difficulty", () => {
    expect(parseScenarioParams("difficulty=0")).toEqual({});
    expect(parseScenarioParams("difficulty=11")).toEqual({});
    expect(parseScenarioParams("difficulty=3.5")).toEqual({});
    expect(parseScenarioParams("difficulty=abc")).toEqual({});
  });

  it("only accepts the supported threat counts", () => {
    expect(parseScenarioParams("threat_count=5")).toEqual({ threat_count: 5 });
    expect(parseScenarioParams("threat_count=4")).toEqual({});
  });

  it("drops unknown enum values", () => {
    expect(parseScenarioParams("environment=space&time_of_day=dusk")).toEqual({});
  });

  it("keeps integer seeds, including negative values", () => {
    expect(parseScenarioParams("seed=-12")).toEqual({ seed: -12 });
    expect(parseScenarioParams("seed=1.5")).toEqual({});
  });

  it("treats a blank trainee id as absent", () => {
    expect(parseScenarioParams("trainee_id=")).toEqual({});
  });
});
