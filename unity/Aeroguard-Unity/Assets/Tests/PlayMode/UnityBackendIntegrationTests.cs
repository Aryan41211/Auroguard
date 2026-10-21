using System;
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace Aeroguard.Tests
{
    /// <summary>
    /// Live integration test: exercises the Unity HTTP layer against a running
    /// backend (health → scenario → session → events → complete → AAR).
    /// Skipped unless AEROGUARD_RUN_LIVE_TESTS=1 so the suite stays offline.
    /// </summary>
    public class UnityBackendIntegrationTests
    {
        [UnityTest]
        public IEnumerator FullSessionReachesAScoredAar()
        {
            if (Environment.GetEnvironmentVariable("AEROGUARD_RUN_LIVE_TESTS") != "1")
            {
                Assert.Ignore("Set AEROGUARD_RUN_LIVE_TESTS=1 with the backend running to enable this test.");
                yield break;
            }

            var host = new GameObject("Unity API test");
            var api = host.AddComponent<AeroguardApi>();
            api.baseUrl = ClientConfig.NormaliseBaseUrl(
                Environment.GetEnvironmentVariable("AEROGUARD_API_URL"));

            HealthResponse health = null;
            string error = null;
            yield return api.Health(value => health = value, message => error = message);
            Assert.That(error, Is.Null, error);
            Assert.That(health.status, Is.EqualTo("ok"));

            var request = new ScenarioGenerateRequest
            {
                difficulty = 4,
                environment = "urban",
                time_of_day = "day",
                threat_count = 2,
                seed = 20261021
            };

            Scenario scenario = null;
            error = null;
            yield return api.GenerateScenario(request, value => scenario = value, message => error = message);
            Assert.That(error, Is.Null, error);
            Assert.That(scenario, Is.Not.Null);
            Assert.That(scenario.scenario_id, Is.EqualTo("SCN-261021"));
            Assert.That(scenario.threats, Has.Length.EqualTo(2));

            SessionCreated session = null;
            error = null;
            yield return api.CreateSession(
                new SessionCreateRequest { trainee_id = "UNITY-TEST", scenario_id = scenario.scenario_id },
                value => session = value,
                message => error = message);
            Assert.That(error, Is.Null, error);
            Assert.That(session.session_id, Does.StartWith("SES-"));

            yield return Submit(api, session.session_id, 0, "SESSION_STARTED", null, new EventPayload());
            yield return Submit(
                api,
                session.session_id,
                0,
                "SCENARIO_LOADED",
                null,
                new EventPayload { scenario_id = scenario.scenario_id });

            foreach (var threat in scenario.threats)
            {
                var spawnMs = Mathf.RoundToInt(threat.spawn_time * 1000f);
                var detectMs = spawnMs + 1800;
                yield return Submit(api, session.session_id, spawnMs, "THREAT_SPAWNED", threat.id,
                    new EventPayload { spawn_time = threat.spawn_time });
                yield return Submit(api, session.session_id, detectMs, "THREAT_DETECTED", threat.id,
                    new EventPayload { confidence = 0.92f });
                yield return Submit(api, session.session_id, detectMs + 1200, "CLASSIFICATION_SUBMITTED", threat.id,
                    new EventPayload { label = threat.classification_label });
                yield return Submit(api, session.session_id, detectMs + 2100, "RESPONSE_SUBMITTED", threat.id,
                    new EventPayload { response = threat.expected_response });
            }

            ScoreResult score = null;
            error = null;
            yield return api.CompleteSession(session.session_id, value => score = value, message => error = message);
            Assert.That(error, Is.Null, error);
            Assert.That(score.final_score, Is.EqualTo(100f).Within(0.01f));

            Aar aar = null;
            error = null;
            yield return api.GetAar(session.session_id, value => aar = value, message => error = message);
            Assert.That(error, Is.Null, error);
            Assert.That(aar.summary, Does.Contain("100"));
            Assert.That(aar.mistakes, Is.Empty);

            UnityEngine.Object.Destroy(host);
        }

        private static IEnumerator Submit(
            AeroguardApi api,
            string sessionId,
            int timestampMs,
            string type,
            string threatId,
            EventPayload payload)
        {
            EventCreated created = null;
            string error = null;
            yield return api.SubmitEvent(
                sessionId,
                new EventEnvelope
                {
                    type = type,
                    timestamp_ms = timestampMs,
                    threat_id = threatId,
                    payload = payload
                },
                value => created = value,
                message => error = message);

            Assert.That(error, Is.Null, error);
            Assert.That(created.accepted, Is.True);
        }
    }
}
