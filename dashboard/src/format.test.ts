import { describe, expect, it } from "vitest";
import {
  formatConditions,
  formatDateTime,
  formatPercent,
  formatReactionMs,
  formatScore,
} from "./format";

describe("format helpers", () => {
  it("formats scores with one decimal and an em dash for null", () => {
    expect(formatScore(82.5)).toBe("82.5");
    expect(formatScore(0)).toBe("0.0");
    expect(formatScore(null)).toBe("—");
    expect(formatScore(undefined)).toBe("—");
  });

  it("formats naive timestamps deterministically", () => {
    expect(formatDateTime("2026-01-01T12:00:00")).toBe("2026-01-01 12:00");
    expect(formatDateTime(null)).toBe("—");
  });

  it("renders percent and reaction-time buckets", () => {
    expect(formatPercent(91.25)).toBe("91.3%");
    expect(formatPercent(null)).toBe("n/a");
    expect(formatReactionMs(1234.6)).toBe("1235 ms");
    expect(formatReactionMs(null)).toBe("n/a");
  });

  it("summarises scenario conditions", () => {
    expect(formatConditions("day", "urban", "clear")).toBe("day · urban · clear");
  });
});
