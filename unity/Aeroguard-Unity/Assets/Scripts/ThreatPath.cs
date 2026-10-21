using UnityEngine;

namespace Aeroguard
{
    /// <summary>
    /// Deterministic presentation-only flight paths. The same threat index,
    /// spawn time and elapsed time always produce the same world position, so
    /// the Unity client mirrors the browser client's visual contract without
    /// affecting scoring.
    /// </summary>
    public static class ThreatPath
    {
        public const float HorizonZ = 46f;

        /// <summary>Speed in world units per second for a scenario speed class.</summary>
        public static float SpeedFor(string speedClass)
        {
            switch (speedClass)
            {
                case "slow":
                    return 3.5f;
                case "fast":
                    return 9f;
                default:
                    return 6f;
            }
        }

        /// <summary>World position of a threat at <paramref name="elapsedSeconds"/>.</summary>
        public static Vector3 Position(int index, float spawnTime, float elapsedSeconds, string speedClass)
        {
            var active = Mathf.Max(0f, elapsedSeconds - spawnTime);
            var z = 4f + active * SpeedFor(speedClass);
            var x = Mathf.Sin((index + 1) * 1.7f + active * 0.18f) * 6f;
            return new Vector3(x, 3.5f, z);
        }

        /// <summary>True once a threat has flown past the visible horizon.</summary>
        public static bool PastHorizon(int index, float spawnTime, float elapsedSeconds, string speedClass)
        {
            return Position(index, spawnTime, elapsedSeconds, speedClass).z > HorizonZ;
        }
    }
}
