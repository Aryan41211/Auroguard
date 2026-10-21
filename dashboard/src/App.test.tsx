import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createFakeApi } from "./test/fakeApi";

describe("App", () => {
  it("shows the history view by default", async () => {
    render(<App api={createFakeApi()} />);
    expect(screen.getByRole("heading", { name: "Session history" })).toBeInTheDocument();
    // Let the history fetch settle so no state update leaks past the test.
    expect(await screen.findByText(/No sessions yet/)).toBeInTheDocument();
  });

  it("switches the active section when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(<App api={createFakeApi()} />);
    await screen.findByText(/No sessions yet/);

    await user.click(screen.getByRole("button", { name: "Trends" }));

    expect(screen.getByRole("heading", { name: "Score trends" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Session history" })).not.toBeInTheDocument();
  });

  it("opens the analytics tab", async () => {
    const user = userEvent.setup();
    render(<App api={createFakeApi()} />);
    await screen.findByText(/No sessions yet/);

    await user.click(screen.getByRole("button", { name: "Analytics" }));

    expect(
      screen.getByRole("heading", { name: "Condition analytics" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/No completed sessions to analyse yet/),
    ).toBeInTheDocument();
  });
});
