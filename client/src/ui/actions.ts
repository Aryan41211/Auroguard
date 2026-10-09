import type { ClassificationLabel, ExpectedResponse } from "../api/types";

const LABELS: ClassificationLabel[] = ["friendly", "civilian", "unknown", "suspicious", "hostile"];
const RESPONSES: ExpectedResponse[] = ["monitor", "track", "report", "hold"];

export interface ActionHooks {
  onDetect(): void;
  onClassify(label: ClassificationLabel): void;
  onRespond(response: ExpectedResponse): void;
  onFalseAlarm(): void;
  onFinish(): void;
}

export interface Actions {
  root: HTMLElement;
  setEnabled(enabled: boolean): void;
}

export function mountActions(root: HTMLElement, hooks: ActionHooks): Actions {
  const element = document.createElement("div");
  element.id = "actions";
  element.className = "panel";
  element.innerHTML = `
    <button data-action="detect">DETECT</button>
    ${LABELS.map((l) => `<button data-classify="${l}">${l}</button>`).join("")}
    ${RESPONSES.map((r) => `<button data-respond="${r}">${r}</button>`).join("")}
    <button data-action="false-alarm">FALSE ALARM</button>
    <button data-action="finish">FINISH</button>`;
  root.appendChild(element);

  element.addEventListener("click", (event) => {
    const target = event.target as HTMLButtonElement;
    if (target.dataset.action === "detect") hooks.onDetect();
    if (target.dataset.action === "false-alarm") hooks.onFalseAlarm();
    if (target.dataset.action === "finish") hooks.onFinish();
    const classify = target.dataset.classify as ClassificationLabel | undefined;
    if (classify) hooks.onClassify(classify);
    const respond = target.dataset.respond as ExpectedResponse | undefined;
    if (respond) hooks.onRespond(respond);
  });

  return {
    root: element,
    setEnabled: (enabled) => {
      element.querySelectorAll("button").forEach((b) => {
        (b as HTMLButtonElement).disabled = !enabled;
      });
    },
  };
}
