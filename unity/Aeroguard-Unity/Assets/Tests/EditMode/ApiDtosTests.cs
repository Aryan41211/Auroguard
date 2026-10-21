using NUnit.Framework;
using UnityEngine;

namespace Aeroguard.Tests
{
    public class ApiDtosTests
    {
        private const string ScenarioJson = @"{
            ""scenario_id"": ""SCN-261021"",
            ""seed"": 20261021,
            ""generator_version"": ""1.0"",
            ""difficulty"": 4,
            ""environment"": ""urban"",
            ""time_of_day"": ""day"",
            ""visibility"": ""reduced"",
            ""sensor_quality"": 0.85,
            ""duration_seconds"": 150.0,
            ""threats"": [
                {
                    ""id"": ""T01"",
                    ""category"": ""unknown_aerial_object"",
                    ""classification_label"": ""suspicious"",
                    ""expected_response"": ""report"",
                    ""spawn_time"": 57.6,
                    ""speed_class"": ""fast"",
                    ""visibility_class"": ""reduced""
                },
                {
                    ""id"": ""T02"",
                    ""category"": ""unknown_aerial_object"",
                    ""classification_label"": ""civilian"",
                    ""expected_response"": ""monitor"",
                    ""spawn_time"": 68.7,
                    ""speed_class"": ""medium"",
                    ""visibility_class"": ""reduced""
                }
            ]
        }";

        [Test]
        public void Scenario_ParsesTheFrozenContract()
        {
            var scenario = JsonUtility.FromJson<Scenario>(ScenarioJson);

            Assert.That(scenario, Is.Not.Null);
            Assert.That(scenario.scenario_id, Is.EqualTo("SCN-261021"));
            Assert.That(scenario.seed, Is.EqualTo(20261021));
            Assert.That(scenario.difficulty, Is.EqualTo(4));
            Assert.That(scenario.duration_seconds, Is.EqualTo(150f).Within(0.001f));
            Assert.That(scenario.threats, Has.Length.EqualTo(2));
            Assert.That(scenario.threats[0].id, Is.EqualTo("T01"));
            Assert.That(scenario.threats[0].spawn_time, Is.EqualTo(57.6f).Within(0.001f));
            Assert.That(scenario.threats[1].speed_class, Is.EqualTo("medium"));
        }

        [Test]
        public void GenerateRequest_SerialisesSnakeCaseFields()
        {
            var json = JsonUtility.ToJson(new ScenarioGenerateRequest
            {
                difficulty = 4,
                environment = "urban",
                time_of_day = "day",
                threat_count = 2,
                seed = 20261021
            });

            StringAssert.Contains("\"difficulty\":4", json);
            StringAssert.Contains("\"time_of_day\":\"day\"", json);
            StringAssert.Contains("\"threat_count\":2", json);
            StringAssert.Contains("\"seed\":20261021", json);
        }

        [Test]
        public void EventEnvelope_SerialisesAnObjectPayload()
        {
            var json = JsonUtility.ToJson(new EventEnvelope
            {
                type = "CLASSIFICATION_SUBMITTED",
                timestamp_ms = 60600,
                threat_id = "T01",
                payload = new EventPayload { label = "suspicious" }
            });

            StringAssert.Contains("\"type\":\"CLASSIFICATION_SUBMITTED\"", json);
            StringAssert.Contains("\"timestamp_ms\":60600", json);
            StringAssert.Contains("\"threat_id\":\"T01\"", json);
            StringAssert.Contains("\"payload\":{", json);
            StringAssert.Contains("\"label\":\"suspicious\"", json);
        }

        [Test]
        public void Aar_ParsesScoresAndMistakes()
        {
            var json = @"{
                ""session_id"": ""SES-5EBBAEC0"",
                ""scenario_id"": ""SCN-261021"",
                ""summary"": ""Final score 50.0/100: detected 1/2."",
                ""scores"": {
                    ""session_id"": ""SES-5EBBAEC0"",
                    ""detection_score"": 15.0,
                    ""classification_score"": 15.0,
                    ""response_score"": 12.5,
                    ""timing_score"": 7.5,
                    ""penalty"": 0.0,
                    ""final_score"": 50.0,
                    ""scoring_version"": 1
                },
                ""mistakes"": [
                    {
                        ""kind"": ""missed_threat"",
                        ""timestamp_ms"": 68700,
                        ""threat_id"": ""T02"",
                        ""detail"": ""no detection recorded""
                    }
                ],
                ""strengths"": [],
                ""weaknesses"": [""Detection: lost 15.0 of 30.""],
                ""recommendation"": ""Focus on detection in the next session.""
            }";

            var aar = JsonUtility.FromJson<Aar>(json);

            Assert.That(aar.scores.final_score, Is.EqualTo(50f).Within(0.001f));
            Assert.That(aar.mistakes, Has.Length.EqualTo(1));
            Assert.That(aar.mistakes[0].kind, Is.EqualTo("missed_threat"));
            Assert.That(aar.mistakes[0].threat_id, Is.EqualTo("T02"));
            StringAssert.Contains("detection", aar.recommendation);
        }
    }
}
