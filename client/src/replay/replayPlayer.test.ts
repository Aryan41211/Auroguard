import { describe, expect, it } from "vitest";
import type { ReplayFrame } from "../api/types";
import { createReplayPlayer, type ReplayClock } from "./replayPlayer";
import { buildTimeline } from "./timeline";

/** Deterministic clock: time only moves when the test advances it. */
class ManualClock implements ReplayClock {
  time = 0;
  private nextHandle = 1;
  private callbacks = new Map<number, (time: number) => void>();

  now(): number {
    return this.time;
  }

  schedule(callback: (time: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  /** Run the pending callbacks once, as a browser frame would. */
  advance(deltaMs: number): void {
    this.time += deltaMs;
    const pending = [...this.callbacks.entries()];
    this.callbacks.clear();
    for (const [, callback] of pending) callback(this.time);
  }
}

function frame(timestampMs: number, label: string): ReplayFrame {
  return {
    timestamp_ms: timestampMs,
    event_id: `EVT-${timestampMs}`,
    event_type: "SESSION_STARTED" as ReplayFrame["event_type"],
    label,
    threat_id: null,
    threats: [],
  };
}

const timeline = buildTimeline([
  frame(0, "start"),
  frame(1000, "detected"),
  frame(2000, "classified"),
  frame(3000, "responded"),
]);

describe("createReplayPlayer", () => {
  it("does not advance while paused", () => {
    const clock = new ManualClock();
    const seen: number[] = [];
    const player = createReplayPlayer(timeline, {
      onFrame: (index) => seen.push(index),
      clock,
    });
    clock.advance(5000);
    expect(seen).toEqual([]);
    expect(player.currentIndex()).toBe(0);
  });

  it("advances the virtual clock while playing", () => {
    const clock = new ManualClock();
    const seen: number[] = [];
    const player = createReplayPlayer(timeline, {
      onFrame: (index) => seen.push(index),
      clock,
    });
    player.play();
    clock.advance(1500);
    expect(player.currentIndex()).toBe(1);
    clock.advance(1000);
    expect(player.currentIndex()).toBe(2);
    expect(seen).toContain(1);
  });

  it("stops at the end of the timeline and reports the end", () => {
    const clock = new ManualClock();
    let ended = false;
    const player = createReplayPlayer(timeline, {
      onFrame: () => {},
      onEnd: () => {
        ended = true;
      },
      clock,
    });
    player.play();
    clock.advance(10_000);
    expect(ended).toBe(true);
    expect(player.isPlaying()).toBe(false);
    expect(player.currentIndex()).toBe(timeline.entries.length - 1);
  });

  it("seeks to an exact frame", () => {
    const clock = new ManualClock();
    const seen: number[] = [];
    const player = createReplayPlayer(timeline, {
      onFrame: (index) => seen.push(index),
      clock,
    });
    player.seek(2);
    expect(player.currentIndex()).toBe(2);
    expect(player.currentTime()).toBe(2000);
    expect(seen).toEqual([2]);
  });

  it("clamps seeks into range", () => {
    const clock = new ManualClock();
    const player = createReplayPlayer(timeline, { onFrame: () => {}, clock });
    player.seek(-3);
    expect(player.currentIndex()).toBe(0);
    player.seek(99);
    expect(player.currentIndex()).toBe(timeline.entries.length - 1);
  });

  it("seeks by timestamp to the last frame at or before it", () => {
    const clock = new ManualClock();
    const player = createReplayPlayer(timeline, { onFrame: () => {}, clock });
    player.seekToTime(2500);
    expect(player.currentIndex()).toBe(2);
    player.seekToTime(0);
    expect(player.currentIndex()).toBe(0);
  });

  it("replays from the beginning after the end", () => {
    const clock = new ManualClock();
    const player = createReplayPlayer(timeline, { onFrame: () => {}, clock });
    player.play();
    clock.advance(10_000);
    player.play();
    expect(player.currentIndex()).toBe(0);
    expect(player.isPlaying()).toBe(true);
  });

  it("respects the playback speed", () => {
    const clock = new ManualClock();
    const player = createReplayPlayer(timeline, { onFrame: () => {}, clock, speed: 2 });
    player.setSpeed(2);
    player.play();
    clock.advance(1000);
    expect(player.currentTime()).toBe(2000);
    expect(player.currentIndex()).toBe(2);
  });

  it("is a no-op for an empty timeline", () => {
    const clock = new ManualClock();
    const player = createReplayPlayer(buildTimeline([]), { onFrame: () => {}, clock });
    player.play();
    clock.advance(1000);
    expect(player.currentIndex()).toBe(0);
    expect(player.isPlaying()).toBe(false);
  });
});
