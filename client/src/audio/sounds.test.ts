import { describe, expect, it, vi } from "vitest";
import { CUE_SPECS, createSoundEngine, type SoundCue } from "./sounds";

function fakeContext(): { ctx: AudioContext } {
  const ctx = {
    state: "running" as AudioContextState,
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const node = {
        type: "sine" as OscillatorType,
        frequency: {
          setValueAtTime: vi.fn(),
        },
        connect: vi.fn(() => node),
        start: vi.fn(),
        stop: vi.fn(),
      };
      return node as unknown as OscillatorNode;
    }),
    createGain: vi.fn(() => {
      const node = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(() => node),
      };
      return node as unknown as GainNode;
    }),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { ctx: ctx as unknown as AudioContext };
}

describe("CUE_SPECS", () => {
  it("defines a distinct spec for every cue", () => {
    const cues: SoundCue[] = [
      "spawn", "detect", "classify", "respond", "false_alarm", "complete", "error",
    ];
    for (const cue of cues) {
      const spec = CUE_SPECS[cue];
      expect(spec.frequency).toBeGreaterThan(0);
      expect(spec.durationMs).toBeGreaterThan(0);
      expect(spec.gain).toBeGreaterThan(0);
    }
  });
});

describe("createSoundEngine", () => {
  it("plays a cue through the audio context", () => {
    const { ctx } = fakeContext();
    const engine = createSoundEngine(() => ctx, true);

    engine.play("detect");

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
  });

  it("stays silent when disabled", () => {
    const { ctx } = fakeContext();
    const engine = createSoundEngine(() => ctx, false);

    engine.play("detect");
    engine.setEnabled(false);
    engine.play("spawn");

    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("can be re-enabled", () => {
    const { ctx } = fakeContext();
    const engine = createSoundEngine(() => ctx, true);
    engine.setEnabled(false);
    engine.play("spawn");
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    engine.setEnabled(true);
    engine.play("spawn");
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("never throws when no audio context is available", () => {
    const engine = createSoundEngine(() => {
      throw new Error("no audio");
    });
    expect(() => engine.play("complete")).not.toThrow();
  });

  it("closes the context on dispose", () => {
    const { ctx } = fakeContext();
    const engine = createSoundEngine(() => ctx, true);
    engine.play("spawn");
    engine.dispose();
    expect(ctx.close).toHaveBeenCalled();
  });
});

