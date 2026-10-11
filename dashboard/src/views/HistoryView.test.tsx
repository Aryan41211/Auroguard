import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeApi, sampleHistoryEntry } from "../test/fakeApi";
import { HistoryView } from "./HistoryView";

describe("HistoryView", () => {
  it("renders one row per session with conditions and score", async () => {
    const sessions = [
      sampleHistoryEntry({
        session_id: "SES-1",
        final_score: 82.5,
        time_of_day: "night",
        environment: "rural",
        visibility: "reduced",
      }),
      sampleHistoryEntry({
        session_id: "SES-2",
        status: "active",
        final_score: null,
        completed_at: null,
        started_at: "2026-01-02T09:30:00",
      }),
    ];
    render(
      <HistoryView api={createFakeApi({ sessions: { sessions } })} traineeId="TRAIN-001" />,
    );

    await screen.findByText("SES-1");

    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("night · rural · reduced")).toBeInTheDocument();
    expect(screen.getByText("82.5")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01 12:00")).toBeInTheDocument();
  });

  it("shows an em dash for an active session score", async () => {
    const sessions = [
      sampleHistoryEntry({ session_id: "SES-9", status: "active", final_score: null }),
    ];
    render(
      <HistoryView api={createFakeApi({ sessions: { sessions } })} traineeId="TRAIN-001" />,
    );

    const row = (await screen.findByText("SES-9")).closest("tr");
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain("—");
  });

  it("renders an empty state when there are no sessions", async () => {
    render(
      <HistoryView api={createFakeApi({ sessions: { sessions: [] } })} traineeId="TRAIN-001" />,
    );

    expect(await screen.findByText(/No sessions yet/)).toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    const api = createFakeApi();
    api.listSessions = () => Promise.reject(new Error("503 unavailable"));
    render(<HistoryView api={api} traineeId="TRAIN-001" />);

    expect(await screen.findByText(/503 unavailable/)).toBeInTheDocument();
  });
});
