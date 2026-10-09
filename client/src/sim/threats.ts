import * as THREE from "three";
import type { SpeedClass, ThreatProfile } from "../api/types";

const SPEED_UNITS: Record<SpeedClass, number> = { slow: 3, medium: 6, fast: 10 };

export interface ThreatView {
  profile: ThreatProfile;
  mesh: THREE.Object3D;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

export function createThreatView(profile: ThreatProfile): ThreatView {
  const hash = hashString(profile.id);
  const geometry = new THREE.BoxGeometry(2, 1, 2);
  const color = profile.classification_label === "hostile" ? 0xff5555 : 0x8899aa;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
  mesh.visible = false;
  mesh.userData.startX = ((hash % 200) / 200) * 80 - 40;
  mesh.userData.row = ((hash >> 3) % 3) - 1;
  return { profile, mesh };
}

export function updateThreatView(view: ThreatView, elapsedSec: number): void {
  const speed = SPEED_UNITS[view.profile.speed_class ?? "medium"];
  const travel = Math.max(0, elapsedSec - view.profile.spawn_time);
  const startX = view.mesh.userData.startX as number;
  const row = view.mesh.userData.row as number;
  view.mesh.position.set(startX + speed * travel - 30, 8 + Math.sin(travel) * 0.5, row * 20);
  view.mesh.visible = elapsedSec >= view.profile.spawn_time;
}
