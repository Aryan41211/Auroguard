import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeApi, sampleHistoryEntry } from "../test/fakeApi";
import { TrendsView } from "./TrendsView";

describe("TrendsView", () => {
  it("renders a line chart from completed sessions", async () => {
    const sessions = [
      sampleHistoryEntry({ session_id: "SES-1", trainee_id: "TRAIN-001", final_score: 40 }),
      sampleHistoryEntry({ session_id: "SES-2", trainee_id: "TRAIN-001", final_score: 75 }),
    ];
    const { container } = render(
      <TrendsView api={createFakeApi({ sessions: { sessions } })} traineeId="TRAIN-001" />,
    );

    expect(await screen.findByText(/2 completed sessions/)).toBeInTheDocument();
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull();
  });

  it("shows an empty state when there are no completed sessions", async () => {
    render(<TrendsView api={createFakeApi()} traineeId="TRAIN-001" />);

    expect(
      await screen.findByText(/No completed sessions for this trainee/),
    ).toBeInTheDocument();
  });
});
