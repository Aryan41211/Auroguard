import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createFakeApi, samplePerformance, sampleRecommendation } from "../test/fakeApi";
import { PerformanceView } from "./PerformanceView";

describe("PerformanceView", () => {
  it("renders accuracies, reaction time and level", async () => {
    const performance = samplePerformance({
      session_count: 3,
      detection_accuracy: 90,
      classification_accuracy: 80.5,
      response_accuracy: 70,
      average_reaction_time_ms: 1500,
      current_level: 4,
    });
    render(<PerformanceView api={createFakeApi({ performance })} traineeId="TRAIN-001" />);

    expect(await screen.findByText("90.0%")).toBeInTheDocument();
    expect(screen.getByText("80.5%")).toBeInTheDocument();
    expect(screen.getByText("1500 ms")).toBeInTheDocument();
    expect(screen.getByText(/level 4/)).toBeInTheDocument();
  });

  it("requests a recommendation and shows the metric-cited reason", async () => {
    const user = userEvent.setup();
    const api = createFakeApi({
      performance: samplePerformance({ session_count: 2 }),
      recommendation: sampleRecommendation({
        recommended_difficulty: 5,
        reason: "Night score 30.0 is 20.0 points below overall 50.0.",
      }),
    });
    render(<PerformanceView api={api} traineeId="TRAIN-001" />);

    await user.click(
      await screen.findByRole("button", { name: /Recommend next scenario/ }),
    );

    expect(await screen.findByText(/Night score 30.0/)).toBeInTheDocument();
    expect(screen.getByText(/Recommended:/)).toHaveTextContent("difficulty 5");
    expect(api.recommend).toHaveBeenCalledWith("TRAIN-001");
  });
});
