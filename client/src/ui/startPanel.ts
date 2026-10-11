import type { Environment, ScenarioGenerateRequest, ThreatCount, TimeOfDay } from "../api/types";
import { parseScenarioParams, type ScenarioQuery } from "./scenarioParams";

const ENVIRONMENTS: Environment[] = ["urban", "rural"];
const TIMES: TimeOfDay[] = ["day", "night"];
const THREAT_COUNTS: ThreatCount[] = [1, 2, 3, 5];

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function options(values: (string | number)[], selected?: string | number): string {
  return values
    .map(
      (value) =>
        `<option value="${value}"${String(value) === String(selected) ? " selected" : ""}>${value}</option>`,
    )
    .join("");
}

/** Start-panel markup, prefilled from validated query params (pure, testable). */
export function buildStartPanelHtml(prefill: ScenarioQuery = {}): string {
  const environment = prefill.environment ?? "urban";
  const timeOfDay = prefill.time_of_day ?? "day";
  const threatCount = prefill.threat_count ?? 1;
  return `
    <div id="start-panel" class="panel">
      <form id="start-form" style="min-width:320px">
        <h2>Aeroguard</h2>
        <label>Trainee ID <input id="trainee_id" value="${escapeAttr(prefill.trainee_id ?? "TRAIN-001")}" /></label>
        <label>Difficulty <input id="difficulty" type="number" min="1" max="10" value="${prefill.difficulty ?? 3}" /></label>
        <label>Environment <select id="environment">${options(ENVIRONMENTS, environment)}</select></label>
        <label>Time of day <select id="time_of_day">${options(TIMES, timeOfDay)}</select></label>
        <label>Threat count <select id="threat_count">${options(THREAT_COUNTS, threatCount)}</select></label>
        <label>Seed (blank = random) <input id="seed" type="number" value="${prefill.seed ?? ""}" /></label>
        <button type="submit">Start scenario</button>
      </form>
    </div>`;
}

export function mountStartPanel(
  root: HTMLElement,
  onStart: (req: ScenarioGenerateRequest, traineeId: string) => void,
  search = "",
): void {
  root.innerHTML = buildStartPanelHtml(parseScenarioParams(search));

  const form = root.querySelector<HTMLFormElement>("#start-form")!;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = <T extends string>(id: string): T =>
      (root.querySelector<HTMLInputElement>(`#${id}`)!).value as T;
    const seedRaw = value("seed");
    onStart(
      {
        difficulty: Number(value("difficulty")),
        environment: value("environment") as Environment,
        time_of_day: value("time_of_day") as TimeOfDay,
        threat_count: Number(value("threat_count")) as ThreatCount,
        seed: seedRaw === "" ? null : Number(seedRaw),
      },
      value("trainee_id"),
    );
  });
}
