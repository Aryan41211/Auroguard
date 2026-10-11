import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createFakeApi, sampleScenario } from "../test/fakeApi";
import { InstructorView } from "./InstructorView";

describe("InstructorView", () => {
  it("generates a scenario and links to a reproducible simulator run", async () => {
    const user = userEvent.setup();
    const api = createFakeApi({ scenario: sampleScenario({ scenario_id: "SCN-777", seed: 4242 }) });
    render(<InstructorView api={api} traineeId="TRAIN-001" />);

    const difficulty = screen.getByLabelText("Difficulty");
    await user.clear(difficulty);
    await user.type(difficulty, "7");
    await user.click(screen.getByRole("button", { name: "Generate scenario" }));

    expect(await screen.findByText("SCN-777")).toBeInTheDocument();
    expect(api.generateScenario).toHaveBeenCalledWith({
      difficulty: 7,
      environment: "urban",
      time_of_day: "day",
      threat_count: 1,
      seed: null,
    });

    const link = screen.getByRole("link", { name: /Play in simulator/ });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("difficulty=7");
    expect(href).toContain("seed=4242");
    expect(href).toContain("trainee_id=TRAIN-001");
  });

  it("surfaces a generation error", async () => {
    const user = userEvent.setup();
    const api = createFakeApi();
    api.generateScenario = () => Promise.reject(new Error("422 infeasible scenario"));
    render(<InstructorView api={api} traineeId="TRAIN-001" />);

    await user.click(screen.getByRole("button", { name: "Generate scenario" }));

    expect(await screen.findByText(/422 infeasible scenario/)).toBeInTheDocument();
  });
});
