/** Runtime configuration for the dashboard. */

/** Where the browser simulator is served (the replay deep link lives there). */
export function simulatorUrl(): string {
  const configured = import.meta.env.VITE_SIMULATOR_URL;
  if (typeof configured === "string" && configured.length > 0) {
    return configured.replace(/\/+$/, "");
  }
  return "http://localhost:5173";
}

/** Deep link that opens a recorded session in the simulator's replay view. */
export function replayUrl(sessionId: string): string {
  return `${simulatorUrl()}/#replay=${encodeURIComponent(sessionId)}`;
}
