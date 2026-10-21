import * as THREE from "three";
import type { SpeedClass, ThreatProfile } from "../api/types";

const SPEED_UNITS: Record<SpeedClass, number> = { slow: 3, medium: 6, fast: 10 };

// Color is derived from the threat id hash only, never from classification_label,
// so the render cannot reveal the ground-truth category the trainee must judge.
const PALETTE = [0x8899aa, 0x99aa88, 0xaa8899, 0x88aabb, 0xbbaa88] as const;

export interface ThreatView {
  profile: ThreatProfile;
  mesh: THREE.Group;
  /** Primary shell materials recoloured by replay stages. */
  bodyMaterials: THREE.MeshStandardMaterial[];
  rotors: THREE.Object3D[];
  selectionRing: THREE.Mesh;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

function armBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 7), material);
  arm.position.copy(start).add(end).multiplyScalar(0.5);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  arm.castShadow = true;
  return arm;
}

function buildDrone(color: number): {
  group: THREE.Group;
  bodyMaterials: THREE.MeshStandardMaterial[];
  rotors: THREE.Object3D[];
  selectionRing: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = "threat-drone";

  const shell = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.34,
    metalness: 0.62,
    emissive: new THREE.Color(color).multiplyScalar(0.08),
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x1c2329,
    roughness: 0.5,
    metalness: 0.55,
  });
  const carbon = new THREE.MeshStandardMaterial({
    color: 0x10151a,
    roughness: 0.68,
    metalness: 0.3,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x101820,
    roughness: 0.12,
    metalness: 0.8,
    emissive: 0x071018,
    emissiveIntensity: 0.5,
  });

  // Central fuselage with a slightly domed top shell.
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.35, 5, 10), shell);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.scale.set(1, 1, 0.78);
  fuselage.castShadow = true;
  group.add(fuselage);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.47, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    shell,
  );
  dome.scale.set(1.65, 0.7, 1.05);
  dome.position.set(-0.06, 0.19, 0);
  dome.castShadow = true;
  group.add(dome);

  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.22, 12), dark);
  belly.position.y = -0.3;
  belly.castShadow = true;
  group.add(belly);

  // Four arms, motors, rotors and nav LEDs.
  const rotors: THREE.Object3D[] = [];
  const armX = 0.95;
  const armZ = 0.78;
  const rotorPositions: Array<[number, number]> = [
    [armX, armZ],
    [armX, -armZ],
    [-armX, armZ],
    [-armX, -armZ],
  ];

  rotorPositions.forEach(([x, z], index) => {
    const start = new THREE.Vector3(x * 0.28, 0.04, z * 0.28);
    const end = new THREE.Vector3(x, 0.06, z);
    group.add(armBetween(start, end, 0.065, carbon));

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.23, 10), dark);
    motor.position.set(x, 0.13, z);
    motor.castShadow = true;
    group.add(motor);

    const rotor = new THREE.Group();
    rotor.position.set(x, 0.28, z);
    rotor.userData.index = index;
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x20272d,
      roughness: 0.35,
      metalness: 0.55,
      transparent: true,
      opacity: 0.82,
    });
    for (const angle of [0, Math.PI]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.025, 0.105), bladeMaterial);
      blade.rotation.y = angle;
      blade.castShadow = true;
      rotor.add(blade);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      new THREE.MeshBasicMaterial({
        color: 0x9fb2c4,
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.012;
    rotor.add(disc);
    rotors.push(rotor);
    group.add(rotor);

    const ledColor = index === 0 || index === 2 ? 0xef5a5a : 0x6df08a;
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 4),
      new THREE.MeshBasicMaterial({ color: ledColor, toneMapped: false }),
    );
    led.position.set(x, 0.18, z);
    group.add(led);
  });

  // Camera gimbal under the nose.
  const gimbalMount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 8), dark);
  gimbalMount.position.set(0.58, -0.26, 0);
  group.add(gimbalMount);
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glass);
  gimbal.position.set(0.58, -0.42, 0);
  gimbal.scale.set(1, 0.85, 0.95);
  gimbal.castShadow = true;
  group.add(gimbal);

  // Landing skids.
  const skidMaterial = carbon;
  for (const z of [-0.42, 0.42]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.92, 6), skidMaterial);
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0, -0.53, z);
    group.add(skid);
    for (const x of [-0.3, 0.3]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), skidMaterial);
      strut.position.set(x, -0.43, z);
      group.add(strut);
    }
  }

  // White tail strobe.
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  strobe.position.set(-1.02, 0.04, 0);
  group.add(strobe);

  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(1.65, 1.9, 40),
    new THREE.MeshBasicMaterial({
      color: 0x5cc8ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = -0.78;
  selectionRing.visible = false;
  group.add(selectionRing);

  return { group, bodyMaterials: [shell], rotors, selectionRing };
}

export function createThreatView(profile: ThreatProfile): ThreatView {
  const hash = hashString(profile.id);
  const color = PALETTE[hash % PALETTE.length];
  const { group, bodyMaterials, rotors, selectionRing } = buildDrone(color);

  group.visible = false;
  group.userData.startX = ((hash % 200) / 200) * 80 - 40;
  group.userData.row = ((hash >> 3) % 3) - 1;
  group.userData.threatId = profile.id;

  return { profile, mesh: group, bodyMaterials, rotors, selectionRing };
}

export interface ThreatViewOptions {
  /** Overrides the spawn-time visibility rule (used by the replay). */
  visible?: boolean;
}

export function updateThreatView(
  view: ThreatView,
  elapsedSec: number,
  options: ThreatViewOptions = {},
): void {
  const speed = SPEED_UNITS[view.profile.speed_class ?? "medium"];
  const travel = Math.max(0, elapsedSec - view.profile.spawn_time);
  const startX = view.mesh.userData.startX as number;
  const row = view.mesh.userData.row as number;

  view.mesh.position.set(
    startX + speed * travel - 30,
    8 + Math.sin(travel * 1.15) * 0.42,
    row * 20 + Math.sin(travel * 0.65) * 0.8,
  );
  view.mesh.rotation.z = Math.sin(travel * 0.9) * 0.045;
  view.mesh.rotation.x = Math.sin(travel * 0.6 + 1) * 0.03;

  view.rotors.forEach((rotor, index) => {
    rotor.rotation.y = travel * (34 + index * 0.7);
  });

  if (view.selectionRing.visible) {
    const pulse = 1 + Math.sin(travel * 3.2) * 0.06;
    view.selectionRing.scale.setScalar(pulse);
    (view.selectionRing.material as THREE.MeshBasicMaterial).opacity =
      0.65 + Math.sin(travel * 3.2) * 0.2;
  }

  view.mesh.visible = options.visible ?? elapsedSec >= view.profile.spawn_time;
}

/** Toggle the in-world selection ring without touching threat colour or visibility. */
export function setThreatSelected(view: ThreatView, selected: boolean): void {
  view.selectionRing.visible = selected;
}

/** Release the GPU resources owned by a threat model. */
export function disposeThreatView(view: ThreatView): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  view.mesh.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    const material = renderable.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
    else if (material) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
