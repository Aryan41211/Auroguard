import { describe, expect, it } from "vitest";
import { shortcutFor } from "./shortcuts";

describe("shortcutFor", () => {
  it("maps the detect key", () => {
    expect(shortcutFor("d")).toEqual({ kind: "detect" });
  });

  it("maps the number keys to classification labels", () => {
    expect(shortcutFor("1")).toEqual({ kind: "classify", label: "friendly" });
    expect(shortcutFor("5")).toEqual({ kind: "classify", label: "hostile" });
  });

  it("maps the response keys", () => {
    expect(shortcutFor("m")).toEqual({ kind: "respond", response: "monitor" });
    expect(shortcutFor("t")).toEqual({ kind: "respond", response: "track" });
    expect(shortcutFor("r")).toEqual({ kind: "respond", response: "report" });
    expect(shortcutFor("h")).toEqual({ kind: "respond", response: "hold" });
  });

  it("is case insensitive for response keys", () => {
    expect(shortcutFor("M")).toEqual({ kind: "respond", response: "monitor" });
  });

  it("maps the false alarm and finish keys", () => {
    expect(shortcutFor("f")).toEqual({ kind: "false_alarm" });
    expect(shortcutFor("Enter")).toEqual({ kind: "finish" });
  });

  it("ignores unmapped keys", () => {
    expect(shortcutFor("z")).toBeNull();
    expect(shortcutFor("Shift")).toBeNull();
  });
});
