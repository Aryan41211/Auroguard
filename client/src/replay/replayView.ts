import type { ReplayResponse } from "../api/types";
import { createSimScene } from "../sim/scene";
import { createThreatView, updateThreatView, type ThreatView } from "../sim/threats";
import { createReplayPlayer, systemClock } from "./replayPlayer";
import { mountReplayPanel, type ReplayPanel } from "./replayPanel";
import { applyThreatState } from "./threatState";
import { buildTimeline, entryAt, statesAt, type Timeline } from "./timeline";

export interface ReplayViewOptions {
  onClose(): void;
}

export interface ReplayView {
  dispose(): void;
}

/**
 * Renders a recorded session: a 3D scene driven by the server-provided
 * timeline plus a scrubber panel.
 */
export function mountReplayView(
  root: HTMLElement,
  replay: ReplayResponse,
  options: ReplayViewOptions,
): ReplayView {
  const scenario = replay.scenario;
  const timeline: Timeline = buildTimeline(replay.frames);

  const sceneContainer = document.createElement("div");
  sceneContainer.id = "scene";
  root.appendChild(sceneContainer);
  const sim = createSimScene(sceneContainer, scenario);

  const views = new Map<string, ThreatView>();
  for (const profile of scenario.threats) {
    const view = createThreatView(profile);
    sim.scene.add(view.mesh);
    views.set(profile.id, view);
  }

  const panel: ReplayPanel = mountReplayPanel(root, replay, timeline, {
    onSeek: (index) => player.seek(index),
    onTogglePlay: () => {
      if (player.isPlaying()) {
        player.pause();
        panel.setPlaying(false);
      } else {
        player.play();
        panel.setPlaying(true);
      }
    },
    onClose: () => options.onClose(),
  });

  const applyFrame = (index: number, timestampMs: number): void => {
    const elapsedSec = timestampMs / 1000;
    const states = statesAt(timeline, scenario, timestampMs);
    for (const state of states) {
      const view = views.get(state.threat_id);
      if (!view) continue;
      applyThreatState(view, state);
      updateThreatView(view, elapsedSec, { visible: state.stage !== "pending" });
    }
    panel.setEntry(entryAt(timeline, index));
  };

  const player = createReplayPlayer(timeline, {
    onFrame: applyFrame,
    clock: systemClock,
    onEnd: () => panel.setPlaying(false),
  });

  // Show the opening frame immediately.
  applyFrame(0, 0);
  panel.setEntry(entryAt(timeline, 0));

  let frameHandle = requestAnimationFrame(function loop() {
    sim.render();
    frameHandle = requestAnimationFrame(loop);
  });

  return {
    dispose() {
      cancelAnimationFrame(frameHandle);
      player.destroy();
      panel.destroy();
      sim.dispose();
      sceneContainer.remove();
    },
  };
}
