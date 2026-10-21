using NUnit.Framework;
using UnityEngine;

namespace Aeroguard.Tests
{
    public class ThreatPathTests
    {
        [Test]
        public void Position_IsDeterministic()
        {
            var first = ThreatPath.Position(0, 2.5f, 7.5f, "medium");
            var second = ThreatPath.Position(0, 2.5f, 7.5f, "medium");
            Assert.That(first, Is.EqualTo(second));
        }

        [Test]
        public void Position_StartsAtOriginBeforeSpawn()
        {
            var beforeSpawn = ThreatPath.Position(0, 10f, 4f, "fast");
            Assert.That(beforeSpawn.z, Is.EqualTo(4f).Within(0.001f));
        }

        [Test]
        public void FastThreatsTravelFurtherThanSlowThreats()
        {
            var fast = ThreatPath.Position(0, 0f, 5f, "fast");
            var slow = ThreatPath.Position(0, 0f, 5f, "slow");
            Assert.That(fast.z, Is.GreaterThan(slow.z));
        }

        [Test]
        public void PastHorizon_BecomesTrueAfterEnoughTime()
        {
            Assert.That(ThreatPath.PastHorizon(0, 0f, 0f, "slow"), Is.False);
            Assert.That(ThreatPath.PastHorizon(0, 0f, 60f, "slow"), Is.True);
        }

        [Test]
        public void SpeedFor_MatchesKnownClasses()
        {
            Assert.That(ThreatPath.SpeedFor("slow"), Is.LessThan(ThreatPath.SpeedFor("medium")));
            Assert.That(ThreatPath.SpeedFor("fast"), Is.GreaterThan(ThreatPath.SpeedFor("medium")));
            Assert.That(ThreatPath.SpeedFor("unknown"), Is.EqualTo(ThreatPath.SpeedFor("medium")));
        }
    }
}
