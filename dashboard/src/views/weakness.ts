import type { PerformanceProfile } from "../api/types";

export interface WeaknessCell {
  /** Stable key, also used for the test-friendly `data-cell` attribute. */
  id: string;
  group: string;
  label: string;
  score: number | null;
}

export const GROUP_ORDER = [
  "Time of day",
  "Environment",
  "Visibility",
  "Sensor",
  "Threats",
] as const;

/** Flatten a performance profile into the condition buckets the heatmap shows. */
export function weaknessCells(profile: PerformanceProfile): WeaknessCell[] {
  return [
    { id: "day", group: "Time of day", label: "day", score: profile.day_score },
    { id: "night", group: "Time of day", label: "night", score: profile.night_score },
    { id: "urban", group: "Environment", label: "urban", score: profile.urban_score },
    { id: "rural", group: "Environment", label: "rural", score: profile.rural_score },
    { id: "clear", group: "Visibility", label: "clear", score: profile.clear_visibility_score },
    { id: "reduced", group: "Visibility", label: "reduced", score: profile.reduced_visibility_score },
    { id: "poor", group: "Visibility", label: "poor", score: profile.poor_visibility_score },
    { id: "high-sensor", group: "Sensor", label: "high", score: profile.high_sensor_score },
    { id: "medium-sensor", group: "Sensor", label: "medium", score: profile.medium_sensor_score },
    { id: "low-sensor", group: "Sensor", label: "low", score: profile.low_sensor_score },
    { id: "multi-threat", group: "Threats", label: "multi (≥2)", score: profile.multi_threat_score },
  ];
}

export interface WeaknessGroup {
  group: string;
  cells: WeaknessCell[];
}

/** Group cells for layout, keeping the declared group order. */
export function groupWeaknessCells(cells: WeaknessCell[]): WeaknessGroup[] {
  return GROUP_ORDER.flatMap((group) => {
    const matching = cells.filter((cell) => cell.group === group);
    return matching.length > 0 ? [{ group, cells: matching }] : [];
  });
}

/**
 * Red (0) to green (100) heat colour. Null buckets get a neutral grey so they
 * are visually distinct from a genuine score of zero.
 */
export function heatColor(score: number | null): string {
  if (score === null) return "#30363d";
  const clamped = Math.max(0, Math.min(100, score));
  const hue = Math.round((clamped / 100) * 120);
  return `hsl(${hue} 65% 45%)`;
}
