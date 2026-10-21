import type { Environment, Scenario, Visibility } from "../api/types";

/**
 * Visual-only theme derived from a scenario. Nothing in this module reads the
 * ground-truth classification or expected response: it is safe to expose.
 */
export interface VisualTheme {
  skyTop: number;
  skyHorizon: number;
  fog: number;
  ground: number;
  sunColor: number;
  sunIntensity: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  ambientColor: number;
  ambientIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  exposure: number;
  windowGlow: number;
  runwayLights: boolean;
  starOpacity: number;
  cloudOpacity: number;
  fogNear: number;
  fogFar: number;
  hazeOpacity: number;
}

const FOG_DISTANCE: Record<Visibility, { near: number; far: number; haze: number }> = {
  clear: { near: 180, far: 680, haze: 0 },
  reduced: { near: 90, far: 340, haze: 0.08 },
  poor: { near: 45, far: 185, haze: 0.18 },
};

export function createVisualTheme(scenario: Scenario): VisualTheme {
  const night = scenario.time_of_day === "night";
  const visibility = FOG_DISTANCE[scenario.visibility];

  if (night) {
    return {
      skyTop: 0x02050c,
      skyHorizon: 0x132238,
      fog: scenario.visibility === "clear" ? 0x0b1422 : 0x101d2c,
      ground: 0x1d2824,
      sunColor: 0xaec4ff,
      sunIntensity: 0.55,
      sunElevationDeg: 38,
      sunAzimuthDeg: 305,
      ambientColor: 0x2d3f61,
      ambientIntensity: 0.42,
      hemiSky: 0x1d3152,
      hemiGround: 0x070a0d,
      hemiIntensity: 0.55,
      exposure: 1.12,
      windowGlow: 1.15,
      runwayLights: true,
      starOpacity: 0.95,
      cloudOpacity: 0.2,
      fogNear: visibility.near,
      fogFar: visibility.far,
      hazeOpacity: visibility.haze,
    };
  }

  return {
    skyTop: 0x3f78b5,
    skyHorizon: scenario.visibility === "clear" ? 0xcfe2ee : 0xb5c5d1,
    fog: scenario.visibility === "clear" ? 0xb9d0e0 : 0xaebec9,
    ground: scenario.environment === "urban" ? 0x5d6657 : 0x63784c,
    sunColor: 0xfff0d2,
    sunIntensity: 2.35,
    sunElevationDeg: 47,
    sunAzimuthDeg: 215,
    ambientColor: 0xc9dcf0,
    ambientIntensity: 0.5,
    hemiSky: 0xbfd9f4,
    hemiGround: 0x46523b,
    hemiIntensity: 0.9,
    exposure: 0.92,
    windowGlow: 0.08,
    runwayLights: false,
    starOpacity: 0,
    cloudOpacity: 0.55,
    fogNear: visibility.near,
    fogFar: visibility.far,
    hazeOpacity: visibility.haze,
  };
}

/** Unit vector pointing from the world origin towards the sun or moon. */
export function sunDirection(theme: VisualTheme): { x: number; y: number; z: number } {
  const elevation = (theme.sunElevationDeg * Math.PI) / 180;
  const azimuth = (theme.sunAzimuthDeg * Math.PI) / 180;
  const horizontal = Math.cos(elevation);
  return {
    x: Math.sin(azimuth) * horizontal,
    y: Math.sin(elevation),
    z: Math.cos(azimuth) * horizontal,
  };
}

/** Small, fast, deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BuildingSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  tint: number;
  windowStyle: "warm" | "cool" | "mixed";
}

export interface TreeSpec {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  tint: number;
}

export interface EnvironmentLayout {
  buildings: BuildingSpec[];
  trees: TreeSpec[];
}

const URBAN_TINTS = [0x59616b, 0x69727c, 0x4d565f, 0x7a746b, 0x5d6a73] as const;
const RURAL_TINTS = [0x8a6f52, 0x7c5c44, 0x6f6a58, 0x8b7d66] as const;
const TREE_TINTS = [0x315a32, 0x3b6b38, 0x2c4f31, 0x486b34] as const;

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length) % values.length];
}

/** True when a point would sit in the open flight corridor. */
function inFlightLane(x: number, z: number): boolean {
  return (
    Math.abs(z) < 27 ||
    (Math.abs(x) < 16 && Math.abs(z) < 40) ||
    // Keep the camera's foreground view over the runway clear.
    (Math.abs(x) < 24 && z > 20)
  );
}

function urbanLayout(rng: () => number): EnvironmentLayout {
  const buildings: BuildingSpec[] = [];

  // City blocks frame the airfield but leave the central flight lane open.
  for (let gx = -4; gx <= 4; gx += 1) {
    for (let gz = -5; gz <= 3; gz += 1) {
      const x = gx * 23 + (rng() - 0.5) * 4;
      const z = gz * 23 + (rng() - 0.5) * 4;
      if (inFlightLane(x, z)) continue;
      if (rng() < 0.18) continue;

      const distance = Math.hypot(x, z + 25);
      const height = 5 + rng() * 10 + Math.min(distance / 9, 22) + (rng() < 0.1 ? 14 : 0);
      buildings.push({
        x,
        z,
        width: 7 + rng() * 7,
        depth: 7 + rng() * 7,
        height,
        rotation: (rng() - 0.5) * 0.08,
        tint: pick(rng, URBAN_TINTS),
        windowStyle: rng() < 0.45 ? "warm" : rng() < 0.7 ? "cool" : "mixed",
      });
    }
  }

  // A distant skyline gives the horizon depth.
  for (let i = 0; i < 16; i += 1) {
    const x = -145 + i * 19 + (rng() - 0.5) * 8;
    const z = -118 - rng() * 28;
    buildings.push({
      x,
      z,
      width: 10 + rng() * 10,
      depth: 10 + rng() * 10,
      height: 26 + rng() * 46,
      rotation: (rng() - 0.5) * 0.1,
      tint: pick(rng, URBAN_TINTS),
      windowStyle: rng() < 0.5 ? "cool" : "mixed",
    });
  }

  const trees: TreeSpec[] = [];
  for (let i = 0; i < 38; i += 1) {
    const x = (rng() - 0.5) * 210;
    const z = (rng() < 0.5 ? -1 : 1) * (31 + rng() * 55);
    if (inFlightLane(x, z)) continue;
    trees.push({
      x,
      z,
      scale: 0.75 + rng() * 0.9,
      rotation: rng() * Math.PI * 2,
      tint: pick(rng, TREE_TINTS),
    });
  }

  return { buildings, trees };
}

function ruralLayout(rng: () => number): EnvironmentLayout {
  const buildings: BuildingSpec[] = [];
  const farms = [
    { x: -54, z: -48 },
    { x: 58, z: -46 },
    { x: -62, z: 52 },
    { x: 64, z: 56 },
  ];
  for (const farm of farms) {
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      buildings.push({
        x: farm.x + (rng() - 0.5) * 20,
        z: farm.z + (rng() - 0.5) * 18,
        width: 7 + rng() * 8,
        depth: 9 + rng() * 10,
        height: 3.5 + rng() * 5,
        rotation: (rng() - 0.5) * 0.45,
        tint: pick(rng, RURAL_TINTS),
        windowStyle: "warm",
      });
    }
  }

  const trees: TreeSpec[] = [];
  for (let i = 0; i < 110; i += 1) {
    const x = (rng() - 0.5) * 290;
    const z = (rng() - 0.5) * 250;
    if (Math.abs(z) < 15) continue;
    if (Math.abs(z - 20) < 5 || Math.abs(z + 20) < 5) continue;
    trees.push({
      x,
      z,
      scale: 0.75 + rng() * 1.1,
      rotation: rng() * Math.PI * 2,
      tint: pick(rng, TREE_TINTS),
    });
  }

  return { buildings, trees };
}

/** Deterministic, pure environment layout for a scenario seed. */
export function generateEnvironmentLayout(
  seed: number,
  environment: Environment,
): EnvironmentLayout {
  const rng = createRng(seed);
  return environment === "urban" ? urbanLayout(rng) : ruralLayout(rng);
}
