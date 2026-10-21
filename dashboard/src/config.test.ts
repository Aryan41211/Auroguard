import { describe, expect, it } from "vitest";
import { replayUrl, simulatorUrl } from "./config";

describe("simulatorUrl", () => {
  it("defaults to the local simulator", () => {
    expect(simulatorUrl()).toBe("http://localhost:5173");
  });
});

describe("replayUrl", () => {
  it("builds a replay deep link", () => {
    expect(replayUrl("SES-ABC123")).toBe("http://localhost:5173/#replay=SES-ABC123");
  });

  it("encodes the session id", () => {
    expect(replayUrl("SES 1/2")).toBe("http://localhost:5173/#replay=SES%201%2F2");
  });
});
