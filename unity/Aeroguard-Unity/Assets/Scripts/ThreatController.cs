using UnityEngine;

namespace Aeroguard
{
    /// <summary>Presentation-only view of one simulated threat.</summary>
    public class ThreatController : MonoBehaviour
    {
        public int index;
        public float spawnTime;
        public string speedClass = "medium";

        /// <summary>Advance the visual to the session elapsed time.</summary>
        public void Tick(float elapsedSeconds)
        {
            transform.position = ThreatPath.Position(index, spawnTime, elapsedSeconds, speedClass);
            transform.Rotate(0f, 35f * Time.deltaTime, 0f, Space.World);
        }
    }
}
