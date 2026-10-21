import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConditionsAnalyticsResponse } from "../api/types";
import { createFakeApi, sampleConditionAnalytics } from "../test/fakeApi";
import { AnalyticsView } from "./AnalyticsView";

describe("AnalyticsView", () => {
  it("renders a bar chart and comparison table from the endpoint", async () => {
    const api = createFakeApi({ conditionAnalytics: sampleConditionAnalytics() });
    const { container } = render(<AnalyticsView api={api} traineeId="TRAIN-001" />);

    expect(await screen.findByText(/3 completed sessions/)).toBeInTheDocument();
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull();

    const table = screen.getByRole("table", { name: "Condition comparison" });
    expect(within(table).getAllByRole("cell", { name: "Environment" })).toHaveLength(2);
    expect(within(table).getByRole("cell", { name: "urban" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "rural" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "85" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "21.25" })).toBeInTheDocument();
    expect(api.getConditionAnalytics).toHaveBeenCalledWith("TRAIN-001");
  });

  it("shows a loading state before the request settles", () => {
    const api = createFakeApi();
    api.getConditionAnalytics = vi.fn(
      () => new Promise<ConditionsAnalyticsResponse>(() => {}),
    );

    render(<AnalyticsView api={api} traineeId="TRAIN-001" />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an empty state when there are no completed sessions", async () => {
    render(<AnalyticsView api={createFakeApi()} traineeId="TRAIN-001" />);

    expect(
      await screen.findByText(/No completed sessions to analyse yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    const api = createFakeApi();
    api.getConditionAnalytics = vi.fn(async () => {
      throw new Error("boom");
    });

    render(<AnalyticsView api={api} traineeId="TRAIN-001" />);

    expect(await screen.findByText(/Failed to load analytics: boom/)).toBeInTheDocument();
  });
});
