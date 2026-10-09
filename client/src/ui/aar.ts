import type { CompleteResponse, Scenario, ThreatProfile } from "../api/types";

function rows(result: CompleteResponse): string {
  return [
    ["Detection", result.detection_score, 30],
    ["Classification", result.classification_score, 30],
    ["Response", result.response_score, 25],
    ["Timing", result.timing_score, 15],
  ]
    .map(([label, value, max]) => `<tr><td>${label}</td><td>${value} / ${max}</td></tr>`)
    .join("");
}

function threatRows(threats: ThreatProfile[]): string {
  return threats
    .map(
      (t) =>
        `<tr><td>${t.id}</td><td>${t.classification_label}</td><td>${t.expected_response}</td></tr>`,
    )
    .join("");
}

export function showAar(
  root: HTMLElement,
  scenario: Scenario,
  result: CompleteResponse,
  threats: Map<string, ThreatProfile>,
  onAgain: () => void,
): void {
  const panel = document.createElement("div");
  panel.id = "aar-panel";
  panel.className = "panel";
  panel.innerHTML = `
    <div style="min-width:360px">
      <h2>After Action Review</h2>
      <table>
        ${rows(result)}
        <tr><td>Penalty</td><td>-${result.penalty}</td></tr>
        <tr><th>Final score</th><th>${result.final_score} / 100</th></tr>
      </table>
      <p>scoring_version ${result.scoring_version} &middot; scenario ${scenario.scenario_id} (seed ${scenario.seed})</p>
      <h3>Threats</h3>
      <table><tr><th>id</th><th>expected label</th><th>expected response</th></tr>${threatRows([...threats.values()])}</table>
      <p><button id="again">Play again</button></p>
    </div>`;
  root.appendChild(panel);
  panel.querySelector<HTMLButtonElement>("#again")!.addEventListener("click", () => {
    panel.remove();
    onAgain();
  });
}
