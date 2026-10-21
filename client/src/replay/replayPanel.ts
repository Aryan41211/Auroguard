import type { ReplayResponse } from "../api/types";
import { describeState, formatTimestamp, type Timeline, type TimelineEntry } from "./timeline";

export interface ReplayPanelOptions {
  onSeek(index: number): void;
  onTogglePlay(): void;
  onClose?(): void;
}

export interface ReplayPanel {
  root: HTMLElement;
  setEntry(entry: TimelineEntry | null): void;
  setPlaying(playing: boolean): void;
  destroy(): void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function summaryHtml(replay: ReplayResponse): string {
  const scenario = replay.scenario;
  const score = replay.score;
  const scoreText = score ? `${score.final_score.toFixed(1)} / 100` : "not scored";
  return `
    <div class="replay-summary">
      <div><strong>Session ${escapeHtml(replay.session_id)}</strong> &middot; ${escapeHtml(replay.trainee_id)}</div>
      <div>${escapeHtml(scenario.environment)} / ${escapeHtml(scenario.time_of_day)}
        &middot; difficulty ${scenario.difficulty}
        &middot; seed ${scenario.seed}</div>
      <div>score <strong>${scoreText}</strong></div>
    </div>`;
}

/** Build the replay panel markup (pure, testable). */
export function buildReplayPanelHtml(
  replay: ReplayResponse,
  timeline: Timeline,
  entry: TimelineEntry | null,
): string {
  const total = timeline.entries.length;
  const rows = timeline.entries
    .map((item) => {
      const active = entry !== null && item.index === entry.index ? " is-active" : "";
      const states = item.threats
        .map((state) => `${state.threat_id}: ${describeState(state)}`)
        .join(" &middot; ");
      return `<li class="replay-event${active}" data-index="${item.index}">
        <span class="replay-time">${formatTimestamp(item.timestampMs)}</span>
        <span class="replay-label">${escapeHtml(item.label)}</span>
        <span class="replay-states">${states}</span>
      </li>`;
    })
    .join("");
  const position = entry ? entry.index + 1 : 0;
  return `
    ${summaryHtml(replay)}
    <div class="replay-controls">
      <button id="replay-play" type="button">Play</button>
      <input id="replay-scrub" type="range" min="0" max="${Math.max(0, total - 1)}"
        value="${Math.max(0, position - 1)}" step="1" aria-label="Replay position" />
      <span id="replay-position" class="replay-position">${position} / ${total}</span>
      <span id="replay-clock" class="replay-clock">${formatTimestamp(entry?.timestampMs ?? 0)}</span>
      ${replay.score ? "" : '<span class="replay-note">session not scored yet</span>'}
    </div>
    <ol id="replay-events" class="replay-events">${rows}</ol>
    <p><button id="replay-close" type="button">Back to start</button></p>`;
}

export function mountReplayPanel(
  root: HTMLElement,
  replay: ReplayResponse,
  timeline: Timeline,
  options: ReplayPanelOptions,
): ReplayPanel {
  const element = document.createElement("div");
  element.id = "replay-panel";
  element.className = "panel";
  root.appendChild(element);

  let current: TimelineEntry | null = null;

  function render(): void {
    element.innerHTML = buildReplayPanelHtml(replay, timeline, current);
    const scrub = element.querySelector<HTMLInputElement>("#replay-scrub")!;
    scrub.addEventListener("input", () => {
      options.onSeek(Number(scrub.value));
    });
    element.querySelector<HTMLButtonElement>("#replay-play")!.addEventListener("click", () => {
      options.onTogglePlay();
    });
    const close = element.querySelector<HTMLButtonElement>("#replay-close");
    if (close) {
      close.addEventListener("click", () => options.onClose?.());
    }
    element.querySelectorAll<HTMLLIElement>(".replay-event").forEach((item) => {
      item.addEventListener("click", () => {
        options.onSeek(Number(item.dataset.index));
      });
    });
  }

  render();

  return {
    root: element,
    setEntry(entry) {
      current = entry;
      render();
    },
    setPlaying(playing) {
      const button = element.querySelector<HTMLButtonElement>("#replay-play");
      if (button) button.textContent = playing ? "Pause" : "Play";
    },
    destroy() {
      element.remove();
    },
  };
}
