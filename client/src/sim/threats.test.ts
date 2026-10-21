import { describe, expect, it } from "vitest";
import type { ClassificationLabel, ThreatProfile } from "../api/types";
import { createThreatView, setThreatSelected } from "./threats";

function threat(id: string, label: ClassificationLabel): ThreatProfile {
  return {
    id, category: "unknown_aerial_object", classification_label: label,
    expected_response: "track", spawn_time: 1, speed_class: "medium", visibility_class: "clear",
  };
}

function colorOf(id: string, label: ClassificationLabel): number {
  const view = createThreatView(threat(id, label));
  return view.bodyMaterials[0].color.getHex();
}

describe("createThreatView", () => {
  it("derives color from the threat id, not the ground-truth classification label", () => {
    expect(colorOf("T01", "hostile")).toBe(colorOf("T01", "friendly"));
    expect(colorOf("T01", "hostile")).toBe(colorOf("T01", "civilian"));
    expect(colorOf("T01", "hostile")).toBe(colorOf("T01", "unknown"));
  });

  it("still varies color across different threats", () => {
    const seen = new Set(
      ["T01", "T02", "T03", "T04", "T05"].map((id) => colorOf(id, "hostile")),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("renders a quadcopter with four rotors and a hidden selection ring", () => {
    const view = createThreatView(threat("T01", "hostile"));
    expect(view.mesh.name).toBe("threat-drone");
    expect(view.rotors).toHaveLength(4);
    expect(view.selectionRing.visible).toBe(false);
    expect(view.mesh.userData.threatId).toBe("T01");
    expect(view.mesh.visible).toBe(false);
  });

  it("exposes selection without changing the id-derived shell colour", () => {
    const view = createThreatView(threat("T01", "hostile"));
    const before = view.bodyMaterials[0].color.getHex();
    view.mesh.visible = true;
    setThreatSelected(view, true);
    expect(view.selectionRing.visible).toBe(true);
    expect(view.bodyMaterials[0].color.getHex()).toBe(before);
    setThreatSelected(view, false);
    expect(view.selectionRing.visible).toBe(false);
  });
});
