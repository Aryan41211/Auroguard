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
  scene.fog = new THREE.Fog(night ? 0x05070c : 0x9fb4c7, 40, 160);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 30, 60);
  camera.lookAt(0, 0, 0);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: scenario.environment === "urban" ? 0x33403a : 0x3d5a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const light = new THREE.DirectionalLight(0xffffff, night ? 0.6 : 1.1);
  light.position.set(30, 60, 20);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, night ? 0.3 : 0.6));

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  function resize(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  return {
    scene,
    camera,
    renderer,
    render: () => renderer.render(scene, camera),
    dispose: () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
