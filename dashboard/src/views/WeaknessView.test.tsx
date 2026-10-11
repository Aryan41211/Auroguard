import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createFakeApi, samplePerformance } from "../test/fakeApi";
import { WeaknessView } from "./WeaknessView";

describe("WeaknessView", () => {
  it("renders condition scores and marks null buckets as n/a", async () => {
    const performance = samplePerformance({
      trainee_id: "TRAIN-001",
      session_count: 4,
      day_score: 82.5,
      night_score: 30,
    });
    const { container } = render(
      <WeaknessView api={createFakeApi({ performance })} traineeId="TRAIN-001" />,
    );

    await screen.findByText("82.5");
    expect(screen.getByText("30.0")).toBeInTheDocument();
    expect(screen.getByText(/Time of day/)).toBeInTheDocument();

    const emptyCell = container.querySelector('[data-cell="poor"]');
    expect(emptyCell).toHaveTextContent("n/a");
    expect(emptyCell).toHaveClass("is-empty");
  });

  it("shows an empty state when the trainee has no sessions", async () => {
    render(
      <WeaknessView
        api={createFakeApi({ performance: samplePerformance({ session_count: 0 }) })}
        traineeId="TRAIN-001"
      />,
    );

    expect(
      await screen.findByText(/No completed sessions for this trainee/),
    ).toBeInTheDocument();
  });
});
