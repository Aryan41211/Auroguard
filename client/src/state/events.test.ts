import { describe, expect, it } from "vitest";
import { buildEvent, events } from "./events";

describe("event builders", () => {
  it("defaults threat_id to null and payload to {}", () => {
    expect(buildEvent("SESSION_STARTED", 0)).toEqual({
      type: "SESSION_STARTED", timestamp_ms: 0, threat_id: null, payload: {},
    });
  });

  it("puts label under payload.label and response under payload.response", () => {
    expect(events.classification("T01", "hostile", 1500).payload).toEqual({ label: "hostile" });
    expect(events.response("T01", "hold", 2000).payload).toEqual({ response: "hold" });
  });

  it("carries the threat id on threat-scoped events", () => {
    expect(events.threatDetected("T02", 900).threat_id).toBe("T02");
    expect(events.falseAlarm(3000).threat_id).toBeNull();
  });
});
