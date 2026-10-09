import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { ClassificationLabel, ThreatProfile } from "../api/types";
import { createThreatView } from "./threats";

function threat(id: string, label: ClassificationLabel): ThreatProfile {
  return {
    id, category: "unknown_aerial_object", classification_label: label,
    expected_response: "track", spawn_time: 1, speed_class: "medium", visibility_class: "clear",
  };
}

function colorOf(id: string, label: ClassificationLabel): number {
  const view = createThreatView(threat(id, label));
  const material = (view.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
  return material.color.getHex();
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
});
