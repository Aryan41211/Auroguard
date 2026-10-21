import type {
  CompleteResponse,
  EventCreateRequest,
  EventCreated,
  ReplayResponse,
  Scenario,
  ScenarioGenerateRequest,
  SessionCreateRequest,
  SessionCreated,
} from './types';

export interface ApiClient {
  generateScenario(request: ScenarioGenerateRequest): Promise<Scenario>;
  createSession(request: SessionCreateRequest): Promise<SessionCreated>;
  submitEvent(sessionId: string, event: EventCreateRequest): Promise<EventCreated>;
  completeSession(sessionId: string): Promise<CompleteResponse>;
  getReplay(sessionId: string): Promise<ReplayResponse>;
}

export function createApiClient(
  base = '/api/v1',
  fetchFn: typeof fetch = fetch,
): ApiClient {
  async function readError(response: Response): Promise<Error> {
    let detail = response.statusText;
    try {
      const parsed = (await response.json()) as { detail?: unknown };
      if (parsed.detail !== undefined) detail = String(parsed.detail);
    } catch {
      // keep statusText
    }
    return new Error(response.status + ' ' + detail);
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    const url = base + path;
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw await readError(response);
    return (await response.json()) as T;
  }

  async function get<T>(path: string): Promise<T> {
    const url = base + path;
    const response = await fetchFn(url, { method: 'GET' });
    if (!response.ok) throw await readError(response);
    return (await response.json()) as T;
  }

  return {
    generateScenario: (request) => post<Scenario>('/scenarios/generate', request),
    createSession: (request) => post<SessionCreated>('/sessions', request),
    submitEvent: (sessionId, event) =>
      post<EventCreated>('/sessions/' + sessionId + '/events', event),
    completeSession: (sessionId) =>
      post<CompleteResponse>('/sessions/' + sessionId + '/complete'),
    getReplay: (sessionId) => get<ReplayResponse>('/sessions/' + sessionId + '/replay'),
  };
}