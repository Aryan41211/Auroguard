using NUnit.Framework;

namespace Aeroguard.Tests
{
    public class ApiJsonTests
    {
        [Test]
        public void SerializeEvent_OmitsThreatIdForSessionEvents()
        {
            var json = ApiJson.SerializeEvent(new EventEnvelope
            {
                type = "SESSION_STARTED",
                timestamp_ms = 0,
                threat_id = null,
                payload = new EventPayload { trainee_id = "UNITY-TEST" }
            });

            StringAssert.DoesNotContain("threat_id", json);
            StringAssert.Contains("\"type\":\"SESSION_STARTED\"", json);
            StringAssert.Contains("\"trainee_id\":\"UNITY-TEST\"", json);
        }

        [Test]
        public void SerializeEvent_IncludesThreatIdWhenPresent()
        {
            var json = ApiJson.SerializeEvent(new EventEnvelope
            {
                type = "THREAT_DETECTED",
                timestamp_ms = 58600,
                threat_id = "T01",
                payload = new EventPayload { confidence = 0.92f }
            });

            StringAssert.Contains("\"threat_id\":\"T01\"", json);
            StringAssert.Contains("\"timestamp_ms\":58600", json);
            StringAssert.Contains("\"payload\":{", json);
        }

        [Test]
        public void Escape_HandlesQuotesAndBackslashes()
        {
            Assert.That(ApiJson.Escape("a\"b\\c"), Is.EqualTo("a\\\"b\\\\c"));
            Assert.That(ApiJson.Escape(null), Is.EqualTo(string.Empty));
        }
    }
}
