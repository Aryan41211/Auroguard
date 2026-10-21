using UnityEngine;

namespace Aeroguard
{
    /// <summary>
    /// Builds the whole prototype at runtime so the committed scene stays
    /// empty and reviewable: camera, lighting, procedural environment and the
    /// simulation components. Runs automatically after any scene loads.
    /// </summary>
    public static class AeroguardBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (Object.FindAnyObjectByType<SimulationManager>() != null)
            {
                return;
            }

            var root = new GameObject("Aeroguard Simulator");

            var cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            var camera = cameraObject.AddComponent<Camera>();
            camera.fieldOfView = 60f;
            camera.farClipPlane = 250f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.7f, 0.76f, 0.82f);
            cameraObject.transform.SetPositionAndRotation(
                new Vector3(0f, 12f, -12f),
                Quaternion.LookRotation(new Vector3(0f, 2f, 18f) - new Vector3(0f, 12f, -12f)));

            var sunObject = new GameObject("Sun");
            var sun = sunObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.05f;
            sun.shadows = LightShadows.Soft;
            sunObject.transform.rotation = Quaternion.Euler(50f, -35f, 0f);

            BuildGround();
            BuildBuildings();

            var environment = root.AddComponent<EnvironmentView>();
            environment.sun = sun;

            var api = root.AddComponent<AeroguardApi>();
            var manager = root.AddComponent<SimulationManager>();
            var hud = root.AddComponent<ScenarioHud>();
            manager.api = api;
            manager.hud = hud;
            manager.environment = environment;
            hud.manager = manager;

            QualitySettings.antiAliasing = 2;
            Application.targetFrameRate = 60;
        }

        private static void BuildGround()
        {
            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground";
            ground.transform.localScale = new Vector3(8f, 1f, 8f);
            SetColor(ground, new Color(0.22f, 0.3f, 0.2f));

            var strip = GameObject.CreatePrimitive(PrimitiveType.Cube);
            strip.name = "Runway";
            strip.transform.localScale = new Vector3(5f, 0.05f, 44f);
            strip.transform.position = new Vector3(0f, 0.02f, 20f);
            SetColor(strip, new Color(0.32f, 0.34f, 0.36f));
        }

        private static void BuildBuildings()
        {
            var index = 0;
            for (var row = 0; row < 5; row++)
            {
                for (var side = -1; side <= 1; side += 2)
                {
                    index++;
                    var height = 3f + (index % 4) * 1.8f;
                    var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    cube.name = "Building " + index;
                    cube.transform.localScale = new Vector3(2.4f, height, 2.4f);
                    cube.transform.position = new Vector3(side * (8f + (index % 3) * 2f), height / 2f, 6f + row * 8f);
                    SetColor(cube, new Color(0.32f, 0.36f, 0.42f));
                }
            }
        }

        private static void SetColor(GameObject target, Color color)
        {
            var renderer = target.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.color = color;
            }
        }
    }
}
