import type { Scenario } from "../api/types";

export interface Hud {
  root: HTMLElement;
  setRemaining(seconds: number): void;
  setSelected(id: string | null): void;
}

export function mountHud(root: HTMLElement, scenario: Scenario): Hud {
  const element = document.createElement("div");
  element.id = "hud";
  element.className = "panel";
  root.appendChild(element);
  let selected: string | null = null;

  function render(remaining: number): void {
    const threats = scenario.threats
      .map((t) => `<li>${t.id}${t.id === selected ? " \u2190 selected" : ""}</li>`)
      .join("");
    element.innerHTML = `
      <div><strong>${scenario.environment} / ${scenario.time_of_day}</strong></div>
      <div>difficulty ${scenario.difficulty} &middot; sensor ${scenario.sensor_quality.toFixed(2)}</div>
      <div>time left: ${Math.max(0, Math.ceil(remaining))}s</div>
      <ul style="padding-left:16px;margin:6px 0">${threats}</ul>`;
  }
  render(scenario.duration_seconds);

  return {
    root: element,
    setRemaining: (seconds) => render(seconds),
    setSelected: (id) => {
      selected = id;
      render(scenario.duration_seconds);
    },
  };
}
