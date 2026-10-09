import type { Environment, ScenarioGenerateRequest, ThreatCount, TimeOfDay } from "../api/types";

const ENVIRONMENTS: Environment[] = ["urban", "rural"];
const TIMES: TimeOfDay[] = ["day", "night"];
const THREAT_COUNTS: ThreatCount[] = [1, 2, 3, 5];

function options(values: (string | number)[]): string {
  return values.map((v) => `<option value="${v}">${v}</option>`).join("");
}

export function mountStartPanel(root: HTMLElement, onStart: (req: ScenarioGenerateRequest, traineeId: string) => void): void {
  root.innerHTML = `
    <div id="start-panel" class="panel">
      <form id="start-form" style="min-width:320px">
        <h2>AEROVIGIL</h2>
        <label>Trainee ID <input id="trainee_id" value="TRAIN-001" /></label>
        <label>Difficulty <input id="difficulty" type="number" min="1" max="10" value="3" /></label>
        <label>Environment <select id="environment">${options(ENVIRONMENTS)}</select></label>
        <label>Time of day <select id="time_of_day">${options(TIMES)}</select></label>
        <label>Threat count <select id="threat_count">${options(THREAT_COUNTS)}</select></label>
        <label>Seed (blank = random) <input id="seed" type="number" /></label>
        <button type="submit">Start scenario</button>
      </form>
    </div>`;

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
