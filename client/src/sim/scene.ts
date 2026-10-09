import * as THREE from "three";
import type { Scenario } from "../api/types";

export interface SimScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render(): void;
  dispose(): void;
}

export function createSimScene(container: HTMLElement, scenario: Scenario): SimScene {
  const scene = new THREE.Scene();
  const night = scenario.time_of_day === "night";
  scene.background = new THREE.Color(night ? 0x05070c : 0x9fb4c7);

  // Fog density based on visibility: clear, reduced, poor
  const visibilityFactor = { clear: 0, reduced: 1, poor: 2 }[scenario.visibility];
  const fogNear = Math.max(10, 40 - 10 * visibilityFactor);
  const fogFar = Math.max(50, 160 - 30 * visibilityFactor);
  scene.fog = new THREE.Fog(night ? 0x05070c : 0x9fb4c7, fogNear, fogFar);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 30, 60);
  camera.lookAt(0, 0, 0);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: scenario.environment === "urban" ? 0x33403a : 0x3d5a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Night uses a dimmer, cooler "moonlight"; day stays bright and neutral.
  const light = new THREE.DirectionalLight(
    night ? 0x9db4ff : 0xffffff,
    night ? 0.5 : 1.1,
  );
  light.position.set(30, 60, 20);
  scene.add(light);
  scene.add(new THREE.AmbientLight(night ? 0x445577 : 0xffffff, night ? 0.35 : 0.6));

  // Noise particles for reduced/poor visibility
  const particleCount = 100 + visibilityFactor * 150; // 100 for clear, 250 for reduced, 400 for poor
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    // Position within a box around the scene
    positions[i3] = (Math.random() - 0.5) * 600; // x
    positions[i3 + 1] = Math.random() * 20 + 5; // y (above ground)
    positions[i3 + 2] = (Math.random() - 0.5) * 600; // z
    // Color: slightly tinted gray
    colors[i3] = 0.8 + Math.random() * 0.2; // r
    colors[i3 + 1] = 0.8 + Math.random() * 0.2; // g
    colors[i3 + 2] = 0.8 + Math.random() * 0.2; // b
    sizes[i] = 2 + Math.random() * 3; // point size
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({ sizeAttenuation: true, vertexColors: true });
  const noiseParticles = new THREE.Points(geometry, material);
  scene.add(noiseParticles);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    if (height > 0) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }
  resize();
  window.addEventListener("resize", resize);

  // Simple animation for noise particles (slow drift)
  const clock = new THREE.Clock();
  const originalPositions = positions.slice(); // copy
  function animateParticles() {
    const elapsed = clock.getElapsedTime();
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Slow drift in x and z direction
      positions[i3] = originalPositions[i3] + Math.sin(elapsed * 0.2 + i) * 0.5;
      positions[i3 + 2] = originalPositions[i3 + 2] + Math.cos(elapsed * 0.15 + i) * 0.5;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return {
    scene,
    camera,
    renderer,
    render() {
      animateParticles();
      renderer.render(scene, camera);
    },
    dispose() {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      renderer.domElement.remove();
      noiseParticles.geometry.dispose();
      noiseParticles.material.dispose();
    },
  };
}
