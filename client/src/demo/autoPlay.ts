import type {
  ClassificationLabel, ExpectedResponse, Scenario, ThreatProfile,
} from "../api/types";

export type MistakeMode = "none" | "last-threat";

export interface AutoPlayOptions {
  onDetect(threatId: string): void;
  onClassify(threatId: string, label: ClassificationLabel): void;
  onRespond(threatId: string, response: ExpectedResponse): void;
  /** Delay between two consecutive decisions, in milliseconds. */
  stepDelayMs?: number;
  /** Which threat (if any) the demo bot gets wrong. */
  mistakeMode?: MistakeMode;
  setTimeoutFn?: (callback: () => void, ms: number) => number;
  clearTimeoutFn?: (handle: number) => void;
}

export interface AutoPlay {
  /** Called when a threat appears; schedules the scripted decisions. */
  onSpawn(threatId: string): void;
  cancel(): void;
  isActive(): boolean;
}

/**
 * Scripted demo pilot: detects, classifies and responds to every threat.
 * Used by the guided demo mode so a presentation can run hands-free.
 */
export function createAutoPlay(
  scenario: Scenario,
  options: AutoPlayOptions,
): AutoPlay {
  const stepDelay = options.stepDelayMs ?? 900;
  const mistakeMode = options.mistakeMode ?? "none";
  const setTimeoutFn =
    options.setTimeoutFn ?? ((callback, ms) => setTimeout(callback, ms) as unknown as number);
  const clearTimeoutFn =
    options.clearTimeoutFn ?? ((handle) => clearTimeout(handle));

  const handles: number[] = [];
  let active = true;
  const handled = new Set<string>();

  const lastThreatId = scenario.threats.length > 0
    ? [...scenario.threats].sort((a, b) => a.spawn_time - b.spawn_time)
      .slice(-1)[0].id
    : null;

  /** The label the demo pilot submits (wrong on purpose in mistake mode). */
  function scriptedLabel(threat: ThreatProfile): ClassificationLabel {
    if (mistakeMode === "last-threat" && threat.id === lastThreatId) {
      const wrong = threat.classification_label === "suspicious" ? "hostile" : "suspicious";
      return wrong;
    }
    return threat.classification_label;
  }

  function schedule(callback: () => void, delay: number): void {
    const handle = setTimeoutFn(() => {
      if (!active) return;
      callback();
    }, delay);
    handles.push(handle);
  }

  function runThreat(threat: ThreatProfile): void {
    schedule(() => options.onDetect(threat.id), stepDelay);
    schedule(() => options.onClassify(threat.id, scriptedLabel(threat)), stepDelay * 2);
    schedule(() => options.onRespond(threat.id, threat.expected_response), stepDelay * 3);
  }

  return {
    onSpawn(threatId: string): void {
      if (!active || handled.has(threatId)) return;
      const threat = scenario.threats.find((item) => item.id === threatId);
      if (!threat) return;
      handled.add(threatId);
      runThreat(threat);
    },
    cancel(): void {
      active = false;
      for (const handle of handles) clearTimeoutFn(handle);
      handles.length = 0;
    },
    isActive: () => active,
  };
}
