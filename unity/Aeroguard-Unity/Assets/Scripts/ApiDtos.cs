using System;

namespace Aeroguard
{
    // Request/response DTOs mirroring docs/api/openapi.yaml. Field names use
    // the JSON contract's snake_case so Unity's JsonUtility maps them without
    // custom converters. Ground truth stays in the scenario payload; the
    // client uses classification_label/expected_response only after scoring
    // for AAR display, never to preselect answers.

    [Serializable]
    public class ScenarioGenerateRequest
    {
        public int difficulty;
        public string environment;
        public string time_of_day;
        public int threat_count;
        public int seed;
    }

    [Serializable]
    public class ThreatProfile
    {
        public string id;
        public string category;
        public string classification_label;
        public string expected_response;
        public float spawn_time;
        public string speed_class;
        public string visibility_class;
    }

    [Serializable]
    public class Scenario
    {
        public string scenario_id;
        public int seed;
        public string generator_version;
        public int difficulty;
        public string environment;
        public string time_of_day;
        public string visibility;
        public float sensor_quality;
        public float duration_seconds;
        public ThreatProfile[] threats;
    }

    [Serializable]
    public class SessionCreateRequest
    {
        public string trainee_id;
        public string scenario_id;
    }

    [Serializable]
    public class SessionCreated
    {
        public string session_id;
        public string status;
    }

    [Serializable]
    public class EventPayload
    {
        public string label;
        public string response;
        public float confidence;
        public string scenario_id;
        public string trainee_id;
        public float spawn_time;
    }

    [Serializable]
    public class EventEnvelope
    {
        public string type;
        public int timestamp_ms;
        public string threat_id;
        public EventPayload payload;
    }

    [Serializable]
    public class EventCreated
    {
        public string event_id;
        public bool accepted;
    }

    [Serializable]
    public class ScoreResult
    {
        public string session_id;
        public float detection_score;
        public float classification_score;
        public float response_score;
        public float timing_score;
        public float penalty;
        public float final_score;
        public int scoring_version;
    }

    [Serializable]
    public class TimingMetrics
    {
        public float mean_time_to_detection_ms;
        public float mean_detection_to_classification_ms;
        public float mean_classification_to_response_ms;
        public float mean_total_decision_ms;
    }

    [Serializable]
    public class Mistake
    {
        public string kind;
        public int timestamp_ms;
        public string threat_id;
        public string detail;
    }

    [Serializable]
    public class Aar
    {
        public string session_id;
        public string scenario_id;
        public string summary;
        public ScoreResult scores;
        public TimingMetrics timing;
        public Mistake[] mistakes;
        public string[] strengths;
        public string[] weaknesses;
        public string recommendation;
    }

    [Serializable]
    public class HealthResponse
    {
        public string status;
    }
}
