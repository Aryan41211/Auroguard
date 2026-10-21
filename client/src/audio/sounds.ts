/**
 * Offline sound cues.
 *
 * All cues are synthesised with the Web Audio API, so the project ships no
 * binary assets and works fully offline. The audio context is created lazily
 * on the first user gesture to satisfy browser autoplay policies.
 */

export type SoundCue =
  | "spawn"
  | "detect"
  | "classify"
  | "respond"
  | "false_alarm"
  | "complete"
  | "error";

export interface CueSpec {
  frequency: number;
  durationMs: number;
  type: OscillatorType;
  gain: number;
}

/** Deterministic cue table (pure, testable). */
export const CUE_SPECS: Record<SoundCue, CueSpec> = {
  spawn: { frequency: 420, durationMs: 140, type: "sine", gain: 0.12 },
  detect: { frequency: 660, durationMs: 120, type: "triangle", gain: 0.16 },
  classify: { frequency: 880, durationMs: 110, type: "triangle", gain: 0.14 },
  respond: { frequency: 1046, durationMs: 160, type: "sine", gain: 0.16 },
  false_alarm: { frequency: 220, durationMs: 220, type: "sawtooth", gain: 0.14 },
  complete: { frequency: 523, durationMs: 320, type: "sine", gain: 0.16 },
  error: { frequency: 160, durationMs: 240, type: "square", gain: 0.12 },
};

export interface SoundEngine {
  play(cue: SoundCue): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  resume(): Promise<void>;
  dispose(): void;
}

type ContextFactory = () => AudioContext;

/** Lazily create the audio context; browsers block it before a gesture. */
export function createSoundEngine(
  contextFactory?: ContextFactory,
  enabled = true,
): SoundEngine {
  let context: AudioContext | null = null;
  let on = enabled;

type AudioContextCtor = new () => AudioContext;

  function ensureContext(): AudioContext | null {
    if (context) return context;
    try {
      if (contextFactory) {
        context = contextFactory();
      } else {
        const scope = globalThis as unknown as {
          AudioContext?: AudioContextCtor;
          webkitAudioContext?: AudioContextCtor;
        };
        const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
        if (Ctor) context = new Ctor();
      }
    } catch {
      context = null;
    }
    return context;
  }

  return {
    play(cue: SoundCue): void {
      if (!on) return;
      const spec = CUE_SPECS[cue];
      if (!spec) return;
      const ctx = ensureContext();
      if (!ctx) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const seconds = spec.durationMs / 1000;
      oscillator.type = spec.type;
      oscillator.frequency.setValueAtTime(spec.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(spec.gain, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + seconds + 0.02);
    },
    setEnabled(next: boolean): void {
      on = next;
    },
    isEnabled: () => on,
    async resume(): Promise<void> {
      const ctx = ensureContext();
      if (ctx && ctx.state === "suspended") await ctx.resume().catch(() => undefined);
    },
    dispose(): void {
      if (context) {
        void context.close().catch(() => undefined);
        context = null;
      }
    },
  };
}
