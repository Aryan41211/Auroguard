import * as THREE from "three";
import { createApiClient } from "./api/client";
import type { ClassificationLabel, ExpectedResponse, Scenario } from "./api/types";
import { createSoundEngine, type SoundCue } from "./audio/sounds";
import { createAutoPlay } from "./demo/autoPlay";
import { mountReplayView } from "./replay/replayView";
import { createSimScene } from "./sim/scene";
import { Spawner } from "./sim/spawner";
import { createThreatView, updateThreatView, type ThreatView } from "./sim/threats";
import { SessionController } from "./state/session";
import { mountActions } from "./ui/actions";
import { showAar } from "./ui/aar";
import { errorMessage, mountErrorPanel } from "./ui/errors";
import { mountHud } from "./ui/hud";
import { shortcutFor } from "./ui/shortcuts";
import { mountStartPanel } from "./ui/startPanel";

const api = createApiClient();
const app = document.getElementById("app")!;
const sounds = createSoundEngine();
const cue = (name: SoundCue) => sounds.play(name);

function clear(): void {
  app.innerHTML = "";
}

function showStart(): void {
  clear();
  mountStartPanel(app, (request, traineeId) => {
    void runSession(request, traineeId);
  }, window.location.search);
}

/** Session id requested through the `#replay=<session_id>` deep link. */
function replaySessionId(): string | null {
  const match = /replay=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  return match ? match[1] : null;
}

/** Guided demo mode: `?demo=1` lets the scripted pilot play the session. */
function demoMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1";
}

function showError(error: unknown, onRetry?: () => void): void {
  cue("error");
  clear();
  mountErrorPanel(app, errorMessage(error), {
    onRetry,
    onBack: () => showStart(),
  });
}

async function runSession(
  request: Parameters<typeof api.generateScenario>[0],
  traineeId: string,
): Promise<void> {
  try {
    const scenario = await api.generateScenario(request);
    const session = await api.createSession({
      trainee_id: traineeId,
      scenario_id: scenario.scenario_id,
    });
    clear();
    startPlay(scenario, session.session_id, traineeId);
  } catch (error) {
    showError(error, () => {
      void runSession(request, traineeId);
    });
  }
}

async function openReplay(sessionId: string): Promise<void> {
  try {
    const replay = await api.getReplay(sessionId);
    clear();
    mountReplayView(app, replay, { onClose: () => showStart() });
  } catch (error) {
    showError(error, () => {
      void openReplay(sessionId);
    });
  }
}

function startPlay(scenario: Scenario, sessionId: string, traineeId: string): void {
  const sceneContainer = document.createElement("div");
  sceneContainer.id = "scene";
  app.appendChild(sceneContainer);
  const sim = createSimScene(sceneContainer, scenario);

  const startedAt = performance.now();
  const now = () => Math.round(performance.now() - startedAt);

  // Serialize event submission so SESSION_COMPLETED lands before /complete.
  let chain: Promise<unknown> = Promise.resolve();
  const emit = (event: Parameters<typeof api.submitEvent>[1]) => {
    chain = chain.then(() => api.submitEvent(sessionId, event)).catch((error) => {
      console.error("event submission failed", error);
    });
  };
  const controller = new SessionController(scenario, sessionId, traineeId, { emit, now });

  const views = new Map<string, ThreatView>();
  for (const profile of scenario.threats) {
    const view = createThreatView(profile);
    sim.scene.add(view.mesh);
    views.set(profile.id, view);
  }

  let selected: string | null = scenario.threats[0]?.id ?? null;
  const hud = mountHud(app, scenario, {
    onToggleSound: () => {
      sounds.setEnabled(!sounds.isEnabled());
      hud.setSoundEnabled(sounds.isEnabled());
    },
  });

  // Push per-threat stage changes (spawn/detect/classify/respond) into the HUD.
  let hudStageKey = "";
  function syncHudThreats(): void {
    const states = controller.threats.map((t) => ({ id: t.profile.id, stage: t.stage }));
    const key = states.map((s) => `${s.id}:${s.stage}`).join("|");
    if (key !== hudStageKey) {
      hudStageKey = key;
      hud.setThreats(states);
    }
  }

  const autoPlay = demoMode()
    ? createAutoPlay(scenario, {
        onDetect: (id) => {
          if (controller.detect(id)) cue("detect");
        },
        onClassify: (id, label) => {
          if (controller.classify(id, label)) cue("classify");
        },
        onRespond: (id, response) => {
          if (controller.respond(id, response)) cue("respond");
        },
        stepDelayMs: 1200,
        mistakeMode: "last-threat",
      })
    : null;

  const spawner = new Spawner(scenario, (id) => {
    controller.spawnThreat(id);
    cue("spawn");
    selected = id;
    hud.setSelected(id);
    autoPlay?.onSpawn(id);
  });
  controller.start();

  function detectCurrent(): void {
    if (selected && controller.detect(selected)) cue("detect");
  }
  function classifyCurrent(label: ClassificationLabel): void {
    if (selected && controller.classify(selected, label)) cue("classify");
  }
  function respondCurrent(response: ExpectedResponse): void {
    if (selected && controller.respond(selected, response)) cue("respond");
  }
  function falseAlarm(): void {
    controller.falseAlarm();
    cue("false_alarm");
  }

  const actions = mountActions(app, {
    onDetect: detectCurrent,
    onClassify: classifyCurrent,
    onRespond: respondCurrent,
    onFalseAlarm: falseAlarm,
    onFinish: () => finish(),
  });

  // Keyboard shortcuts mirror the on-screen buttons.
  function onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
    const action = shortcutFor(event.key);
    if (!action) return;
    event.preventDefault();
    if (action.kind === "detect") detectCurrent();
    if (action.kind === "classify") classifyCurrent(action.label);
    if (action.kind === "respond") respondCurrent(action.response);
    if (action.kind === "false_alarm") falseAlarm();
    if (action.kind === "finish") void finish();
  }
  window.addEventListener("keydown", onKey);

  // Click a threat in the scene to select it.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  sim.renderer.domElement.addEventListener("click", (event) => {
    const rect = sim.renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, sim.camera);
    const meshes = [...views.values()].map((v) => v.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit) {
      const view = [...views.values()].find((v) => v.mesh === hit.object);
      if (view) { selected = view.profile.id; hud.setSelected(selected); }
    }
  });

  let finishing = false;
  async function finish(): Promise<void> {
    if (finishing) return;
    finishing = true;
    autoPlay?.cancel();
    actions.setEnabled(false);
    controller.complete();
    await chain;
    let result;
    try {
      result = await api.completeSession(sessionId);
    } catch (error) {
      showError(error, () => {
        void openReplay(sessionId);
      });
      return;
    }
    cue("complete");
    window.removeEventListener("keydown", onKey);
    sim.dispose();
    const decisions = new Map(
      [...views.values()].map((v) => [v.profile.id, v.profile] as const),
    );
    showAar(app, scenario, result, decisions, {
      onAgain: () => showStart(),
      onReplay: () => {
        void openReplay(sessionId);
      },
    });
  }

  function frame(): void {
    if (finishing) return;
    const elapsedSec = (performance.now() - startedAt) / 1000;
    spawner.update(elapsedSec);
    for (const view of views.values()) updateThreatView(view, elapsedSec);
    syncHudThreats();
    hud.setRemaining(scenario.duration_seconds - elapsedSec);
    sim.render();
    if (!finishing && elapsedSec >= scenario.duration_seconds) {
      void finish();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const requested = replaySessionId();
if (requested) {
  void openReplay(requested);
} else {
  showStart();
}
