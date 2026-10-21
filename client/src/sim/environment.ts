import * as THREE from "three";
import type { Scenario } from "../api/types";
import {
  createRng,
  generateEnvironmentLayout,
  sunDirection,
  type BuildingSpec,
  type TreeSpec,
  type VisualTheme,
} from "./visualTheme";

export interface SimEnvironment {
  update(elapsedSec: number): void;
  dispose(): void;
}

const WINDOW_STYLES: Record<"warm" | "cool" | "mixed", { frame: string }> = {
  warm: { frame: "#2d2a26" },
  cool: { frame: "#252b33" },
  mixed: { frame: "#2a2d31" },
};

function canvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function groundTexture(scenario: Scenario, theme: VisualTheme): THREE.CanvasTexture {
  const size = 512;
  return canvasTexture(size, size, (context) => {
    const rng = createRng(scenario.seed ^ 0x51ed270b);
    const base = new THREE.Color(theme.ground);
    context.fillStyle = `#${base.getHexString()}`;
    context.fillRect(0, 0, size, size);

    if (scenario.environment === "rural") {
      // Patchwork fields with soft, irregular edges.
      for (let i = 0; i < 26; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const width = 30 + rng() * 90;
        const height = 20 + rng() * 70;
        const tone = 0.72 + rng() * 0.33;
        context.fillStyle = `rgba(${Math.round(90 * tone)}, ${Math.round(110 * tone)}, ${Math.round(58 * tone)}, 0.25)`;
        context.fillRect(x, y, width, height);
        context.strokeStyle = "rgba(52, 66, 38, 0.22)";
        context.lineWidth = 1;
        for (let line = 0; line < width; line += 6) {
          context.beginPath();
          context.moveTo(x + line, y);
          context.lineTo(x + line, y + height);
          context.stroke();
        }
      }
    }

    // Fine grain keeps the ground from looking like a flat colour swatch.
    for (let i = 0; i < 9000; i += 1) {
      const shade = rng() < 0.5 ? 0 : 255;
      const alpha = 0.018 + rng() * 0.03;
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${alpha})`;
      const radius = 0.4 + rng() * 1.8;
      context.fillRect(rng() * size, rng() * size, radius, radius);
    }
  });
}

function windowTexture(style: "warm" | "cool" | "mixed", seed: number): THREE.CanvasTexture {
  const rng = createRng(seed ^ (style.charCodeAt(0) * 7919));
  const palette = WINDOW_STYLES[style];
  return canvasTexture(128, 256, (context) => {
    context.fillStyle = palette.frame;
    context.fillRect(0, 0, 128, 256);

    const columnWidth = 12;
    const rowHeight = 15;
    for (let x = 6; x < 118; x += columnWidth) {
      for (let y = 8; y < 246; y += rowHeight) {
        const lit = rng() < 0.36;
        const warm = style === "warm" || (style === "mixed" && rng() < 0.5);
        context.fillStyle = lit
          ? warm
            ? `rgba(255, 207, 138, ${0.55 + rng() * 0.45})`
            : `rgba(188, 216, 255, ${0.45 + rng() * 0.45})`
          : "rgba(24, 32, 40, 0.85)";
        context.fillRect(x, y, 7, 8);
      }
    }

    // Vertical mullions break up the facade.
    context.fillStyle = "rgba(10, 14, 18, 0.35)";
    for (let x = 4; x < 128; x += 24) context.fillRect(x, 0, 2, 256);
  });
}

function cloudTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 128, (context) => {
    const gradient = context.createRadialGradient(128, 66, 4, 128, 66, 122);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(0.35, "rgba(245, 249, 255, 0.45)");
    gradient.addColorStop(0.72, "rgba(230, 238, 250, 0.12)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 128);
  });
}

function addBuilding(
  parent: THREE.Object3D,
  spec: BuildingSpec,
  index: number,
  seed: number,
  theme: VisualTheme,
  windows: Record<BuildingSpec["windowStyle"], THREE.MeshStandardMaterial>,
  facade: THREE.MeshStandardMaterial,
): void {
  const group = new THREE.Group();
  group.position.set(spec.x, spec.height / 2, spec.z);
  group.rotation.y = spec.rotation;

  const tint = new THREE.Color(spec.tint);
  const material = windows[spec.windowStyle];
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, spec.depth), material);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof parapet and a few rooftop details catch the light and add scale.
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(spec.width + 0.5, 0.35, spec.depth + 0.5),
    facade,
  );
  roof.position.y = spec.height / 2 + 0.15;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const rng = createRng(seed + index * 131);
  if (spec.height > 10 && rng() < 0.55) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9 + rng(), 0.9 + rng(), 2.2 + rng() * 2, 8),
      facade,
    );
    tank.position.set((rng() - 0.5) * spec.width * 0.4, spec.height / 2 + 1.2, (rng() - 0.5) * spec.depth * 0.4);
    tank.castShadow = true;
    group.add(tank);
  }
  if (spec.height > 18 && rng() < 0.4) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4 + rng() * 4, 5), facade);
    mast.position.y = spec.height / 2 + 3;
    group.add(mast);
  }

  // Ground-floor awning gives a little human scale to the street edge.
  if (spec.height < 16 && rng() < 0.45) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.7, 0.16, 1.08),
      new THREE.MeshStandardMaterial({ color: 0x39434b, roughness: 0.8 }),
    );
    awning.position.set(0, -spec.height / 2 + 3.1, spec.depth / 2 + 0.5);
    group.add(awning);
  }

  // Tint the window texture per building without cloning the texture.
  body.material = material.clone();
  (body.material as THREE.MeshStandardMaterial).color.copy(tint);
  if (theme.windowGlow > 0.5) {
    (body.material as THREE.MeshStandardMaterial).emissiveIntensity = theme.windowGlow;
  }

  parent.add(group);
}

function addTree(
  parent: THREE.Object3D,
  spec: TreeSpec,
  index: number,
  materials: THREE.MeshStandardMaterial[],
): void {
  const rng = createRng(index * 977 + Math.round(spec.x * 13 + spec.z * 7));
  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  group.rotation.y = spec.rotation;
  group.scale.setScalar(spec.scale);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 3.4, 6),
    materials[0],
  );
  trunk.position.y = 1.7;
  trunk.castShadow = true;
  group.add(trunk);

  const foliage = new THREE.MeshStandardMaterial({
    color: spec.tint,
    roughness: 0.95,
    metalness: 0,
  });
  const layers = 2 + Math.floor(rng() * 2);
  for (let layer = 0; layer < layers; layer += 1) {
    const radius = 2.1 - layer * 0.35 + rng() * 0.4;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), foliage);
    crown.position.y = 4.2 + layer * 1.15;
    crown.rotation.set(rng(), rng() * Math.PI, rng());
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);
  }

  parent.add(group);
}

function addRunway(
  parent: THREE.Object3D,
  scenario: Scenario,
  theme: VisualTheme,
  runwayLights: THREE.Mesh[],
): void {
  const rural = scenario.environment === "rural";
  const runwayLength = rural ? 200 : 250;
  const runwayWidth = rural ? 13 : 17;
  const asphalt = new THREE.MeshStandardMaterial({
    color: rural ? 0x6d6656 : 0x3d4145,
    roughness: 0.96,
    metalness: 0,
  });

  const strip = new THREE.Mesh(new THREE.PlaneGeometry(runwayLength, runwayWidth), asphalt);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.025, 0);
  strip.receiveShadow = true;
  parent.add(strip);

  const marking = new THREE.MeshStandardMaterial({
    color: 0xd8d9d2,
    roughness: 0.7,
    emissive: new THREE.Color(0xd8d9d2),
    emissiveIntensity: 0.04,
  });

  // Centreline dashes.
  for (let x = -runwayLength / 2 + 10; x < runwayLength / 2 - 8; x += 9) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, 0.35), marking);
    dash.position.set(x, 0.055, 0);
    dash.receiveShadow = true;
    parent.add(dash);
  }

  // Solid edge lines.
  for (const z of [-runwayWidth / 2 + 0.8, runwayWidth / 2 - 0.8]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(runwayLength - 4, 0.035, 0.28), marking);
    edge.position.set(0, 0.055, z);
    parent.add(edge);
  }

  // Threshold piano keys at both ends.
  for (const end of [-1, 1]) {
    for (let i = -3; i <= 3; i += 1) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.04, 1.05), marking);
      key.position.set(end * (runwayLength / 2 - 8), 0.055, i * 1.9);
      parent.add(key);
    }
  }

  // Grass/dirt shoulders soften the hard edge of the strip.
  const shoulder = new THREE.MeshStandardMaterial({
    color: rural ? 0x6b7350 : 0x4e5349,
    roughness: 1,
  });
  for (const side of [-1, 1]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(runwayLength + 8, 8), shoulder);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.015, side * (runwayWidth / 2 + 4));
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  if (!rural) {
    // Taxiway and apron.
    const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(220, 8), asphalt);
    taxiway.rotation.x = -Math.PI / 2;
    taxiway.position.set(0, 0.02, runwayWidth / 2 + 10);
    taxiway.receiveShadow = true;
    parent.add(taxiway);

    const apron = new THREE.Mesh(new THREE.PlaneGeometry(110, 30), asphalt);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(-38, 0.018, -runwayWidth / 2 - 19);
    apron.receiveShadow = true;
    parent.add(apron);
  }

  if (theme.runwayLights) {
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffcb74, toneMapped: false });
    for (const side of [-1, 1]) {
      for (let x = -runwayLength / 2; x <= runwayLength / 2; x += 9) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), lightMaterial);
        light.position.set(x, 0.18, side * (runwayWidth / 2 + 0.6));
        parent.add(light);
        runwayLights.push(light);
      }
    }
    const thresholdMaterial = new THREE.MeshBasicMaterial({ color: 0x79e08a, toneMapped: false });
    for (const end of [-1, 1]) {
      for (let i = -2; i <= 2; i += 1) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), thresholdMaterial);
        light.position.set(end * (runwayLength / 2 + 1), 0.2, i * 2.4);
        parent.add(light);
      }
    }
  }
}

function addControlTower(parent: THREE.Object3D, theme: VisualTheme): THREE.Mesh {
  const group = new THREE.Group();
  group.position.set(39, 0, -36);

  const concrete = new THREE.MeshStandardMaterial({ color: 0x8b8f8d, roughness: 0.88 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.1, 21, 10), concrete);
  shaft.position.y = 10.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  const cabin = new THREE.Mesh(
    new THREE.CylinderGeometry(4.1, 3.6, 4.4, 10),
    new THREE.MeshStandardMaterial({
      color: 0x283845,
      roughness: 0.18,
      metalness: 0.55,
      emissive: 0x0e1a24,
      emissiveIntensity: 0.5,
    }),
  );
  cabin.position.y = 23.2;
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.4, 10), concrete);
  roof.position.y = 26;
  roof.castShadow = true;
  group.add(roof);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0xff4d4d,
      toneMapped: false,
      transparent: true,
      opacity: theme.runwayLights ? 1 : 0.25,
    }),
  );
  beacon.position.y = 27;
  beacon.name = "tower-beacon";
  group.add(beacon);
  parent.add(group);
  return beacon;
}

function addHangar(parent: THREE.Object3D, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;

  const shell = new THREE.MeshStandardMaterial({
    color: 0x7d8588,
    roughness: 0.62,
    metalness: 0.35,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(13, 5.5, 9), shell);
  body.position.y = 2.75;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 13.4, 12, 1, false, 0, Math.PI), shell);
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 5.5;
  roof.scale.set(1, 0.55, 1);
  roof.castShadow = true;
  group.add(roof);

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x39444b, roughness: 0.7, metalness: 0.2 }),
  );
  door.position.set(0, 2.2, 4.51);
  group.add(door);
  parent.add(group);
}

function addDistantHills(parent: THREE.Object3D, scenario: Scenario, theme: VisualTheme): void {
  const rng = createRng(scenario.seed ^ 0x2f6e2b1);
  const hillMaterial = new THREE.MeshStandardMaterial({
    color: scenario.environment === "urban" ? 0x4b5350 : 0x4b5a3c,
    roughness: 1,
    flatShading: true,
  });
  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2 + rng() * 0.12;
    const radius = 300 + rng() * 115;
    const height = 22 + rng() * 45;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(55 + rng() * 55, height, 5), hillMaterial);
    hill.position.set(Math.sin(angle) * radius, height / 2 - 2, Math.cos(angle) * radius);
    hill.rotation.y = rng() * Math.PI;
    parent.add(hill);
  }

  // A thin ground haze band helps the horizon blend into the sky.
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(620, 32, 8, 0, Math.PI * 2, Math.PI / 2.5, Math.PI / 3),
    new THREE.MeshBasicMaterial({
      color: theme.fog,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  parent.add(haze);
}

export function createEnvironment(
  scene: THREE.Scene,
  scenario: Scenario,
  theme: VisualTheme,
): SimEnvironment {
  const group = new THREE.Group();
  group.name = "environment";
  scene.add(group);

  const textures: THREE.Texture[] = [];
  const runwayLights: THREE.Mesh[] = [];
  const layout = generateEnvironmentLayout(scenario.seed, scenario.environment);

  // Sky dome: a cheap vertical gradient that reads as atmosphere.
  const skyUniforms = {
    topColor: { value: new THREE.Color(theme.skyTop) },
    bottomColor: { value: new THREE.Color(theme.skyHorizon) },
    offset: { value: 18 },
    exponent: { value: 0.72 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 18),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.name = "sky";
  group.add(sky);

  // Sun or moon with a soft glow sprite.
  const sun = sunDirection(theme);
  const glow = canvasTexture(128, 128, (context) => {
    const gradient = context.createRadialGradient(64, 64, 1, 64, 64, 62);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.16, "rgba(255, 249, 226, 0.95)");
    gradient.addColorStop(0.48, "rgba(255, 230, 180, 0.28)");
    gradient.addColorStop(1, "rgba(255, 220, 160, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  });
  textures.push(glow);
  const sunSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow,
      color: theme.sunColor,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sunSprite.position.set(sun.x * 620, sun.y * 620, sun.z * 620);
  sunSprite.scale.setScalar(scenario.time_of_day === "night" ? 38 : 62);
  group.add(sunSprite);

  // Stars only exist at night.
  if (theme.starOpacity > 0) {
    const rng = createRng(scenario.seed ^ 0x7a11ce);
    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(0.12 + rng() * 0.86);
      const radius = 650;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.cos(phi) * radius;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
      const brightness = 0.55 + rng() * 0.45;
      colors[i * 3] = brightness * 0.86;
      colors[i * 3 + 1] = brightness * 0.92;
      colors[i * 3 + 2] = brightness;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        size: 1.7,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: theme.starOpacity,
        depthWrite: false,
        fog: false,
      }),
    );
    stars.name = "stars";
    group.add(stars);
  }

  // Soft cloud banks.
  const cloudMap = cloudTexture();
  textures.push(cloudMap);
  const clouds: THREE.Sprite[] = [];
  const cloudRng = createRng(scenario.seed ^ 0x1c10d);
  for (let i = 0; i < 11; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudMap,
        color: scenario.time_of_day === "night" ? 0x5b6c85 : 0xffffff,
        transparent: true,
        opacity: theme.cloudOpacity * (0.5 + cloudRng() * 0.5),
        depthWrite: false,
        fog: false,
      }),
    );
    const angle = cloudRng() * Math.PI * 2;
    const radius = 250 + cloudRng() * 280;
    sprite.position.set(
      Math.sin(angle) * radius,
      80 + cloudRng() * 95,
      Math.cos(angle) * radius,
    );
    const scale = 90 + cloudRng() * 150;
    sprite.scale.set(scale, scale * 0.42, 1);
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.drift = 0.4 + cloudRng() * 0.8;
    clouds.push(sprite);
    group.add(sprite);
  }

  // Ground detail texture.
  const groundMap = groundTexture(scenario, theme);
  textures.push(groundMap);
  groundMap.repeat.set(34, 34);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(850, 850),
    new THREE.MeshStandardMaterial({
      map: groundMap,
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);

  // Runway / airfield.
  addRunway(group, scenario, theme, runwayLights);
  if (scenario.environment === "urban") {
    addHangar(group, -62, -33, 0.08);
    addHangar(group, -80, -18, 0.08);
    addHangar(group, 62, 34, -0.1);
  }
  const beacon = addControlTower(group, theme);

  addDistantHills(group, scenario, theme);

  // Facade material and window variants shared by the whole city.
  const facade = new THREE.MeshStandardMaterial({ color: 0x5a6168, roughness: 0.9, metalness: 0.05 });
  const windows = {
    warm: new THREE.MeshStandardMaterial({
      map: windowTexture("warm", scenario.seed),
      emissiveMap: windowTexture("warm", scenario.seed),
      emissive: new THREE.Color(0xffc77d),
      emissiveIntensity: theme.windowGlow,
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.12,
    }),
    cool: new THREE.MeshStandardMaterial({
      map: windowTexture("cool", scenario.seed + 1),
      emissiveMap: windowTexture("cool", scenario.seed + 1),
      emissive: new THREE.Color(0xbcd8ff),
      emissiveIntensity: theme.windowGlow,
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.2,
    }),
    mixed: new THREE.MeshStandardMaterial({
      map: windowTexture("mixed", scenario.seed + 2),
      emissiveMap: windowTexture("mixed", scenario.seed + 2),
      emissive: new THREE.Color(0xd9d2b8),
      emissiveIntensity: theme.windowGlow,
      color: 0xffffff,
      roughness: 0.46,
      metalness: 0.14,
    }),
  };
  textures.push(windows.warm.map!, windows.warm.emissiveMap!);
  textures.push(windows.cool.map!, windows.cool.emissiveMap!);
  textures.push(windows.mixed.map!, windows.mixed.emissiveMap!);

  const treeMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x5a4130, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x5a4130, roughness: 1 }),
  ];
  layout.buildings.forEach((building, index) => {
    addBuilding(group, building, index, scenario.seed, theme, windows, facade);
  });
  layout.trees.forEach((tree, index) => addTree(group, tree, index, treeMaterials));

  // Lighting.
  const ambient = new THREE.AmbientLight(theme.ambientColor, theme.ambientIntensity);
  group.add(ambient);
  const hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
  hemi.position.set(0, 100, 0);
  group.add(hemi);

  const sunLight = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
  sunLight.position.set(sun.x * 160, Math.max(sun.y * 160, 40), sun.z * 160);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -135;
  sunLight.shadow.camera.right = 135;
  sunLight.shadow.camera.top = 135;
  sunLight.shadow.camera.bottom = -135;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 420;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.035;
  sunLight.shadow.radius = 3;
  sunLight.target.position.set(0, 0, 0);
  group.add(sunLight, sunLight.target);

  const fill = new THREE.DirectionalLight(
    theme.skyHorizon,
    scenario.time_of_day === "night" ? 0.18 : 0.35,
  );
  fill.position.set(-sun.x * 120, 60, -sun.z * 120);
  group.add(fill);

  // Low-lying dust/haze for reduced and poor visibility.
  let haze: THREE.Points | null = null;
  if (theme.hazeOpacity > 0) {
    const hazeRng = createRng(scenario.seed ^ 0x50f7);
    const count = scenario.visibility === "poor" ? 900 : 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (hazeRng() - 0.5) * 320;
      positions[i * 3 + 1] = 1 + hazeRng() * 32;
      positions[i * 3 + 2] = (hazeRng() - 0.5) * 280;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    haze = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: theme.fog,
        size: 0.55,
        transparent: true,
        opacity: theme.hazeOpacity,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    haze.name = "haze";
    group.add(haze);
  }

  function update(elapsedSec: number): void {
    for (const cloud of clouds) {
      const baseX = cloud.userData.baseX as number;
      cloud.position.x = baseX + Math.sin(elapsedSec * 0.014 * (cloud.userData.drift as number)) * 32;
    }
    const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsedSec * 3.1));
    (beacon.material as THREE.MeshBasicMaterial).opacity = theme.runwayLights ? pulse : 0.2;
    if (haze) {
      haze.rotation.y = elapsedSec * 0.006;
    }
  }

  function dispose(): void {
    scene.remove(group);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((object) => {
      const renderable = object as THREE.Mesh;
      if (renderable.geometry) geometries.add(renderable.geometry);
      const material = renderable.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
      else if (material) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }

  return { update, dispose };
}
