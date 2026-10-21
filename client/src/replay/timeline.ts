import type { ReplayFrame, ReplayThreatState, Scenario } from "../api/types";

/** One entry of the scrubber: a recorded moment with the world state. */
export interface TimelineEntry {
  index: number;
  timestampMs: number;
  label: string;
  eventType: string;
  threatId: string | null;
  threats: ReplayThreatState[];
}

export interface Timeline {
  entries: TimelineEntry[];
  durationMs: number;
}

function pendingStates(scenario: Scenario): ReplayThreatState[] {
  return [...scenario.threats]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((threat) => ({
      threat_id: threat.id,
      stage: "pending" as const,
      detected: false,
      classification: null,
      response: null,
    }));
}

/** Build the scrubber timeline from the server-provided frames. */
export function buildTimeline(frames: ReplayFrame[]): Timeline {
  const entries = frames.map((frame, index) => ({
    index,
    timestampMs: frame.timestamp_ms,
    label: frame.label,
    eventType: frame.event_type,
    threatId: frame.threat_id ?? null,
    threats: frame.threats.map((state) => ({ ...state })),
  }));
  const last = entries.length > 0 ? entries[entries.length - 1].timestampMs : 0;
  return { entries, durationMs: last };
}

/**
 * Index of the last frame at or before `timestampMs`.
 * Returns -1 when the timestamp precedes the first recorded event.
 */
export function indexAt(timeline: Timeline, timestampMs: number): number {
  let found = -1;
  for (const entry of timeline.entries) {
    if (entry.timestampMs > timestampMs) break;
    found = entry.index;
  }
  return found;
}

/** Threat states at `timestampMs` (falls back to "all pending"). */
export function statesAt(timeline: Timeline, scenario: Scenario, timestampMs: number): ReplayThreatState[] {
  const index = indexAt(timeline, timestampMs);
  if (index < 0) return pendingStates(scenario);
  const threats = timeline.entries[index].threats;
  return threats.length > 0 ? threats : pendingStates(scenario);
}

/** The entry currently shown by the scrubber. */
export function entryAt(timeline: Timeline, index: number): TimelineEntry | null {
  if (timeline.entries.length === 0) return null;
  const clamped = Math.min(Math.max(index, 0), timeline.entries.length - 1);
  return timeline.entries[clamped];
}

/** "1:04.2" style timestamp used by the scrubber and the event feed. */
export function formatTimestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** Human readable summary of one threat state for the event feed. */
export function describeState(state: ReplayThreatState): string {
  switch (state.stage) {
    case "spawned":
      return "on screen";
    case "detected":
      return "detected";
    case "classified":
      return `classified ${state.classification ?? "?"}`;
    case "responded":
      return `responded ${state.response ?? "?"}`;
    case "missed":
      return "missed";
    default:
      return "not seen";
  }
}
