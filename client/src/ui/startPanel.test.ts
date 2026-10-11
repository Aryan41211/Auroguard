import { describe, expect, it } from "vitest";
import { buildStartPanelHtml } from "./startPanel";

describe("buildStartPanelHtml", () => {
  it("uses defaults when no query is provided", () => {
    const html = buildStartPanelHtml();
    expect(html).toContain('id="trainee_id" value="TRAIN-001"');
    expect(html).toContain('id="difficulty" type="number" min="1" max="10" value="3"');
    expect(html).toContain('<option value="urban" selected>urban</option>');
    expect(html).toContain('<option value="day" selected>day</option>');
    expect(html).toContain('<option value="1" selected>1</option>');
    expect(html).toContain('id="seed" type="number" value=""');
  });

  it("prefills every field from the parsed query", () => {
    const html = buildStartPanelHtml({
      trainee_id: "TRAIN-009",
      difficulty: 7,
      environment: "rural",
      time_of_day: "night",
      threat_count: 3,
      seed: 99,
    });
    expect(html).toContain('id="trainee_id" value="TRAIN-009"');
    expect(html).toContain('id="difficulty" type="number" min="1" max="10" value="7"');
    expect(html).toContain('<option value="rural" selected>rural</option>');
    expect(html).toContain('<option value="night" selected>night</option>');
    expect(html).toContain('<option value="3" selected>3</option>');
    expect(html).toContain('id="seed" type="number" value="99"');
  });

  it("escapes a trainee id that could break out of the attribute", () => {
    const html = buildStartPanelHtml({ trainee_id: '" onfocus="x' });
    expect(html).toContain('value="&quot; onfocus=&quot;x"');
    expect(html).not.toContain('onfocus="x"');
  });
});
