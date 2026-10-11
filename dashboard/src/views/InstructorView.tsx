import { useState, type FormEvent } from "react";
import type {
  Environment,
  Scenario,
  ScenarioGenerateRequest,
  ThreatCount,
  TimeOfDay,
} from "../api/types";
import { formatConditions } from "../format";
import type { ViewProps } from "./types";
import { buildPlayUrl, reproducibleRequest } from "./instructor";

const ENVIRONMENTS: Environment[] = ["urban", "rural"];
const TIMES: TimeOfDay[] = ["day", "night"];
const THREAT_COUNTS: ThreatCount[] = [1, 2, 3, 5];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function InstructorView({ api, traineeId }: ViewProps): JSX.Element {
  const [difficulty, setDifficulty] = useState("3");
  const [environment, setEnvironment] = useState<Environment>("urban");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [threatCount, setThreatCount] = useState<ThreatCount>(1);
  const [seed, setSeed] = useState("");
  const [request, setRequest] = useState<ScenarioGenerateRequest | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const body: ScenarioGenerateRequest = {
      difficulty: Number(difficulty),
      environment,
      time_of_day: timeOfDay,
      threat_count: threatCount,
      seed: seed.trim() === "" ? null : Number(seed),
    };
    setBusy(true);
    setError(null);
    try {
      setScenario(await api.generateScenario(body));
      setRequest(body);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const playUrl =
    scenario && request ? buildPlayUrl(reproducibleRequest(request, scenario), traineeId) : null;

  return (
    <section className="panel">
      <h2>Instructor scenario builder</h2>
      {error && <p className="error">Failed to generate scenario: {error}</p>}
      <form onSubmit={(event) => void onSubmit(event)} style={{ maxWidth: 360 }}>
        <label>
          Difficulty
          <input
            type="number"
            min={1}
            max={10}
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          />
        </label>
        <label>
          Environment
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as Environment)}
          >
            {ENVIRONMENTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time of day
          <select
            value={timeOfDay}
            onChange={(event) => setTimeOfDay(event.target.value as TimeOfDay)}
          >
            {TIMES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Threat count
          <select
            value={threatCount}
            onChange={(event) => setThreatCount(Number(event.target.value) as ThreatCount)}
          >
            {THREAT_COUNTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seed (blank = random)
          <input
            type="number"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Generating…" : "Generate scenario"}
        </button>
      </form>

      {scenario && (
        <div style={{ marginTop: 16 }}>
          <p>
            Scenario <code>{scenario.scenario_id}</code> ready · difficulty {scenario.difficulty} ·
            seed {scenario.seed}
          </p>
          <ul>
            <li>{formatConditions(scenario.time_of_day, scenario.environment, scenario.visibility)}</li>
            <li>
              {scenario.threats.length} threat{scenario.threats.length === 1 ? "" : "s"} · sensor
              quality {scenario.sensor_quality} · {scenario.duration_seconds}s
            </li>
          </ul>
          {playUrl && (
            <a className="play-link" href={playUrl}>
              Play in simulator →
            </a>
          )}
        </div>
      )}
    </section>
  );
}
