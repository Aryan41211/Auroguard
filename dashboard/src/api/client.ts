import type {
  PerformanceProfile,
  RecommendResponse,
  Scenario,
  ScenarioGenerateRequest,
  SessionHistoryResponse,
} from "./types";

/**
 * Read/advance client for the instructor dashboard. Mirrors the simulator
 * client's error handling: non-2xx responses throw `Error("<status> <detail>")`.
 */
export interface ApiClient {
  listSessions(traineeId?: string): Promise<SessionHistoryResponse>;
  getPerformance(traineeId: string): Promise<PerformanceProfile>;
  recommend(traineeId: string): Promise<RecommendResponse>;
  generateScenario(request: ScenarioGenerateRequest): Promise<Scenario>;
}

export function createApiClient(
  base = "/api/v1",
  fetchFn: typeof fetch = fetch,
): ApiClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchFn(base + path, init);
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const parsed = (await response.json()) as { detail?: unknown };
        if (parsed.detail !== undefined) detail = String(parsed.detail);
      } catch {
        // keep statusText
      }
      throw new Error(response.status + " " + detail);
    }
    return (await response.json()) as T;
  }

  function get<T>(path: string): Promise<T> {
    return request<T>(path);
  }

  function post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return {
    listSessions: (traineeId) => {
      const query = traineeId ? "?trainee_id=" + encodeURIComponent(traineeId) : "";
      return get<SessionHistoryResponse>("/sessions" + query);
    },
    getPerformance: (traineeId) =>
      get<PerformanceProfile>("/trainees/" + encodeURIComponent(traineeId) + "/performance"),
    recommend: (traineeId) =>
      post<RecommendResponse>("/training/recommend", { trainee_id: traineeId }),
    generateScenario: (request) =>
      post<Scenario>("/scenarios/generate", request),
  };
}
