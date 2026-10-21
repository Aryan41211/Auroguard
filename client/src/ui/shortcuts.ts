import type { ClassificationLabel, ExpectedResponse } from "../api/types";

export type ShortcutAction =
  | { kind: "detect" }
  | { kind: "classify"; label: ClassificationLabel }
  | { kind: "respond"; response: ExpectedResponse }
  | { kind: "false_alarm" }
  | { kind: "finish" };

const CLASSIFY_KEYS: Record<string, ClassificationLabel> = {
  "1": "friendly",
  "2": "civilian",
  "3": "unknown",
  "4": "suspicious",
  "5": "hostile",
};

const RESPOND_KEYS: Record<string, ExpectedResponse> = {
  m: "monitor",
  t: "track",
  r: "report",
  h: "hold",
};

/**
 * Map a key press to a session action (pure, testable).
 * Shortcuts: d = detect, 1-5 = classify, m/t/r/h = respond, f = false alarm,
 * Enter = finish.
 */
export function shortcutFor(key: string): ShortcutAction | null {
  if (key === "d") return { kind: "detect" };
  if (key === "f") return { kind: "false_alarm" };
  if (key === "Enter") return { kind: "finish" };
  const label = CLASSIFY_KEYS[key];
  if (label) return { kind: "classify", label };
  const response = RESPOND_KEYS[key.toLowerCase()];
  if (response) return { kind: "respond", response };
  return null;
}
