import type { CompleteResponse, Scenario, ThreatProfile } from "../api/types";

export function showAar(
  _root: HTMLElement,
  _scenario: Scenario,
  _result: CompleteResponse,
  _threats: Map<string, ThreatProfile>,
  _onAgain: () => void,
): void {
  throw new Error("AAR not implemented yet");
}
