using UnityEngine;

namespace Aeroguard
{
    /// <summary>
    /// Applies scenario conditions to the Unity scene. Visuals never change
    /// scoring; they only communicate the same conditions the backend stores.
    /// </summary>
    public class EnvironmentView : MonoBehaviour
    {
        public Light sun;

        public void Apply(Scenario scenario)
        {
            if (scenario == null)
            {
                return;
            }

            var night = scenario.time_of_day == "night";
            if (sun != null)
            {
                sun.intensity = night ? 0.22f : 1.05f;
                sun.color = night ? new Color(0.55f, 0.65f, 0.95f) : new Color(1f, 0.96f, 0.88f);
            }

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = night ? new Color(0.08f, 0.1f, 0.18f) : new Color(0.55f, 0.58f, 0.62f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = night ? new Color(0.03f, 0.05f, 0.1f) : new Color(0.7f, 0.76f, 0.82f);

            switch (scenario.visibility)
            {
                case "poor":
                    RenderSettings.fogDensity = 0.035f;
                    break;
                case "reduced":
                    RenderSettings.fogDensity = 0.016f;
                    break;
                default:
                    RenderSettings.fogDensity = 0.005f;
                    break;
            }

            var camera = Camera.main;
            if (camera != null)
            {
                camera.backgroundColor = RenderSettings.fogColor;
                camera.clearFlags = CameraClearFlags.SolidColor;
            }
        }
    }
}
