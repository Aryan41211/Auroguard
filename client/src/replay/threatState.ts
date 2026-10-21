import type { ReplayThreatState } from "../api/types";
import type { ThreatView } from "../sim/threats";

/**
 * Replay colouring. The colour encodes the *trainee's* progress through the
 * decision chain (what they did), never the ground-truth classification, so a
 * replay can never leak the answer.
 */
export const STAGE_COLORS: Record<string, number> = {
  pending: 0x556677,
  spawned: 0x8899aa,
  detected: 0xffc857,
  classified: 0x5aa9e6,
  responded: 0x67d17a,
  missed: 0xe05252,
};

/** Apply a replayed threat state to a 3D threat view. */
export function applyThreatState(view: ThreatView, state: ReplayThreatState): void {
  const color = STAGE_COLORS[state.stage] ?? STAGE_COLORS.spawned;
  for (const material of view.bodyMaterials) {
    material.color.setHex(color);
    material.emissive.setHex(color).multiplyScalar(0.12);
  }
  view.mesh.visible = state.stage !== "pending";
}

/** Reset every view to the "not seen" state (used before playback starts). */
export function resetThreatStates(views: Map<string, ThreatView>): void {
  for (const view of views.values()) {
    view.mesh.visible = false;
  }
}
