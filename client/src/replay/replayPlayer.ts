import { indexAt, type Timeline } from "./timeline";

/** Clock abstraction so the player can be driven deterministically in tests. */
export interface ReplayClock {
  now(): number;
  schedule(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

export const systemClock: ReplayClock = {
  now: () => performance.now(),
  schedule: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export interface ReplayPlayerOptions {
  onFrame(index: number, timestampMs: number): void;
  onEnd?(): void;
  clock?: ReplayClock;
  speed?: number;
}

export interface ReplayPlayer {
  play(): void;
  pause(): void;
  seek(index: number): void;
  seekToTime(timestampMs: number): void;
  isPlaying(): boolean;
  currentIndex(): number;
  currentTime(): number;
  setSpeed(speed: number): void;
  destroy(): void;
}

/**
 * Plays a recorded timeline back. The virtual clock only moves forward while
 * playing, so scrubbing back and resuming is deterministic.
 */
export function createReplayPlayer(
  timeline: Timeline,
  options: ReplayPlayerOptions,
): ReplayPlayer {
  const clock = options.clock ?? systemClock;
  let speed = options.speed ?? 1;
  let index = 0;
  let virtualTime = 0;
  let playing = false;
  let handle: number | null = null;
  let lastTick = 0;

  function emit(): void {
    options.onFrame(index, virtualTime);
  }

  function tick(time: number): void {
    if (!playing) return;
    const delta = time - lastTick;
    lastTick = time;
    virtualTime = Math.min(virtualTime + delta * speed, timeline.durationMs);
    const next = indexAt(timeline, virtualTime);
    if (next !== index) {
      index = next;
      emit();
    }
    if (virtualTime >= timeline.durationMs) {
      pause();
      options.onEnd?.();
      return;
    }
    handle = clock.schedule(tick);
  }

  function play(): void {
    if (playing || timeline.entries.length === 0) return;
    if (index >= timeline.entries.length - 1 && virtualTime >= timeline.durationMs) {
      virtualTime = 0;
      index = 0;
      emit();
    }
    playing = true;
    lastTick = clock.now();
    handle = clock.schedule(tick);
  }

  function pause(): void {
    playing = false;
    if (handle !== null) {
      clock.cancel(handle);
      handle = null;
    }
  }

  function seek(next: number): void {
    if (timeline.entries.length === 0) return;
    const clamped = Math.min(Math.max(next, 0), timeline.entries.length - 1);
    index = clamped;
    virtualTime = timeline.entries[clamped].timestampMs;
    emit();
  }

  function seekToTime(timestampMs: number): void {
    if (timeline.entries.length === 0) return;
    const clamped = Math.max(0, timestampMs);
    virtualTime = Math.min(clamped, timeline.durationMs);
    index = indexAt(timeline, virtualTime);
    emit();
  }

  return {
    play,
    pause,
    seek,
    seekToTime,
    isPlaying: () => playing,
    currentIndex: () => index,
    currentTime: () => virtualTime,
    setSpeed: (value: number) => {
      speed = Math.max(0.1, value);
    },
    destroy: () => {
      pause();
    },
  };
}
