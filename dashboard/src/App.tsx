import { useState } from "react";
import { createApiClient, type ApiClient } from "./api/client";
import { AnalyticsView } from "./views/AnalyticsView";
import { HistoryView } from "./views/HistoryView";
import { InstructorView } from "./views/InstructorView";
import { PerformanceView } from "./views/PerformanceView";
import { TrendsView } from "./views/TrendsView";
import { WeaknessView } from "./views/WeaknessView";

export type TabId =
  | "history"
  | "trends"
  | "analytics"
  | "weakness"
  | "performance"
  | "instructor";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "history", label: "History" },
  { id: "trends", label: "Trends" },
  { id: "analytics", label: "Analytics" },
  { id: "weakness", label: "Weakness heatmap" },
  { id: "performance", label: "Trainee performance" },
  { id: "instructor", label: "Instructor builder" },
];

export interface AppProps {
  api?: ApiClient;
}

export function App({ api = createApiClient() }: AppProps = {}): JSX.Element {
  const [active, setActive] = useState<TabId>("history");
  const [traineeId, setTraineeId] = useState("TRAIN-001");

  return (
    <main>
      <h1>Aeroguard Dashboard</h1>
      <p className="subtitle">
        Read-only instructor and trainee views over <code>/api/v1</code>.
      </p>
      <label>
        Trainee ID
        <input
          aria-label="Trainee ID"
          value={traineeId}
          onChange={(event) => setTraineeId(event.target.value)}
        />
      </label>
      <nav className="tabs" aria-label="Dashboard sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active ? "is-active" : undefined}
            aria-current={tab.id === active ? "page" : undefined}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div role="tabpanel">
        {active === "history" && <HistoryView api={api} traineeId={traineeId} />}
        {active === "trends" && <TrendsView api={api} traineeId={traineeId} />}
        {active === "analytics" && <AnalyticsView api={api} traineeId={traineeId} />}
        {active === "weakness" && <WeaknessView api={api} traineeId={traineeId} />}
        {active === "performance" && <PerformanceView api={api} traineeId={traineeId} />}
        {active === "instructor" && <InstructorView api={api} traineeId={traineeId} />}
      </div>
    </main>
  );
}
