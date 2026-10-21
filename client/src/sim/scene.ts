import * as THREE from "three";
import type { Scenario } from "../api/types";
import { createEnvironment, type SimEnvironment } from "./environment";
import { createVisualTheme } from "./visualTheme";

export interface SimScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render(): void;
  dispose(): void;
}

/**
 * Builds the 3D training range. All visual choices are derived from the
 * scenario's environment/time/visibility/seed, never from hidden ground truth.
 */
export function createSimScene(container: HTMLElement, scenario: Scenario): SimScene {
  const theme = createVisualTheme(scenario);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.skyHorizon);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
  camera.position.set(0, 25, 63);
  camera.lookAt(0, 6, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  let environment: SimEnvironment | null = createEnvironment(scene, scenario, theme);

  function resize(): void {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  let disposed = false;

  return {
    scene,
    camera,
    renderer,
    render() {
      if (disposed) return;
      environment?.update(clock.getElapsedTime());
      renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("resize", resize);
      environment?.dispose();
      environment = null;
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
