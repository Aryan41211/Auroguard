import { describe, expect, it } from "vitest";
import type { EventCreateRequest, Scenario, ThreatProfile } from "../api/types";
import { SessionController } from "./session";

function threat(id: string): ThreatProfile {
  return {
    id, category: "unknown_aerial_object", classification_label: "hostile",
    expected_response: "hold", spawn_time: 1, speed_class: "medium", visibility_class: "clear",
  };
}

function scenario(): Scenario {
  return {
    scenario_id: "SCN-000001", seed: 1, generator_version: "1.0", difficulty: 3,
    environment: "urban", time_of_day: "day", visibility: "clear",
    sensor_quality: 1, duration_seconds: 120, threats: [threat("T01"), threat("T02")],
  };
}

function setup() {
  const emitted: EventCreateRequest[] = [];
  let clock = 0;
  const controller = new SessionController(scenario(), "SES-1", "TRAIN-001", {
    emit: (e) => emitted.push(e),
    now: () => clock,
  });
  return { controller, emitted, setClock: (v: number) => { clock = v; } };
}

describe("SessionController", () => {
  it("emits SESSION_STARTED and SCENARIO_LOADED on start", () => {
    const { controller, emitted } = setup();
    controller.start();
    expect(emitted.map((e) => e.type)).toEqual(["SESSION_STARTED", "SCENARIO_LOADED"]);
  });

  it("enforces first-attempt-wins per threat", () => {
    const { controller, emitted, setClock } = setup();
    controller.start();
    controller.spawnThreat("T01");
    setClock(1000);
    expect(controller.detect("T01")).toBe(true);
    expect(controller.detect("T01")).toBe(false); // second detect ignored
    expect(controller.classify("T01", "hostile")).toBe(true);
    expect(controller.classify("T01", "friendly")).toBe(false); // second classify ignored
    expect(controller.respond("T01", "hold")).toBe(true);
    expect(controller.respond("T01", "monitor")).toBe(false);
    const types = emitted.map((e) => e.type);
    expect(types.filter((t) => t === "THREAT_DETECTED")).toHaveLength(1);
    expect(types.filter((t) => t === "CLASSIFICATION_SUBMITTED")).toHaveLength(1);
    expect(types.filter((t) => t === "RESPONSE_SUBMITTED")).toHaveLength(1);
  });

  it("rejects classify before detect and respond before classify", () => {
    const { controller } = setup();
    controller.spawnThreat("T01");
    expect(controller.classify("T01", "hostile")).toBe(false);
    expect(controller.detect("T01")).toBe(true);
    expect(controller.respond("T01", "hold")).toBe(false);
  });

  it("uses the injected clock for event timestamps", () => {
    const { controller, emitted, setClock } = setup();
    setClock(2500);
    controller.spawnThreat("T01");
    controller.detect("T01");
    expect(emitted.find((e) => e.type === "THREAT_DETECTED")?.timestamp_ms).toBe(2500);
  });

  it("completes once and emits SESSION_COMPLETED", () => {
    const { controller, emitted } = setup();
    controller.start();
    controller.complete();
    controller.complete();
    expect(controller.status).toBe("completing");
    expect(emitted.filter((e) => e.type === "SESSION_COMPLETED")).toHaveLength(1);
  });
});
