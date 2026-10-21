using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Aeroguard
{
    public enum SimulationPhase
    {
        Connecting,
        Playing,
        Completing,
        Complete,
        Error
    }

    /// <summary>Per-threat runtime state (never used to score locally).</summary>
    public class ThreatRuntime
    {
        public ThreatProfile Profile;
        public int Index;
        public bool Spawned;
        public bool Detected;
        public bool Classified;
        public bool Responded;
        public bool Missed;
        public GameObject View;

        public bool Resolved => Responded || Missed;

        public string Stage
        {
            get
            {
                if (Missed) return "missed";
                if (Responded) return "responded";
                if (Classified) return "classified";
                if (Detected) return "detected";
                if (Spawned) return "spawned";
                return "pending";
            }
        }
    }

    /// <summary>
    /// Orchestrates one training session: generate a seeded scenario, create a
    /// backend session, spawn threats, record the trainee's actions and show
    /// the AAR. Scoring stays server-side; this class only mirrors state for UI.
    /// </summary>
    public class SimulationManager : MonoBehaviour
    {
        public AeroguardApi api;
        public ScenarioHud hud;
        public EnvironmentView environment;

        private readonly List<ThreatRuntime> _threats = new List<ThreatRuntime>();
        private float _sessionStartedAt;
        private int _pendingEvents;
        private bool _finishing;

        public SimulationPhase Phase { get; private set; } = SimulationPhase.Connecting;
        public string StatusMessage { get; private set; } = "Connecting to the backend...";
        public Scenario CurrentScenario { get; private set; }
        public string SessionId { get; private set; }
        public Aar LastAar { get; private set; }
        public float Elapsed { get; private set; }
        public ThreatRuntime Selected { get; private set; }
        public IReadOnlyList<ThreatRuntime> Threats => _threats;
        public int PendingEvents => _pendingEvents;

        public string ApiBaseUrl => api != null ? api.baseUrl : ClientConfig.DefaultBaseUrl;
        public float DurationSeconds => CurrentScenario != null ? CurrentScenario.duration_seconds : 0f;
        public int NowMs => Mathf.RoundToInt(Elapsed * 1000f);

        private void Start()
        {
            if (api == null)
            {
                api = gameObject.AddComponent<AeroguardApi>();
            }

            Phase = SimulationPhase.Connecting;
            StartCoroutine(HealthThenScenario());
        }

        private IEnumerator HealthThenScenario()
        {
            var healthy = false;
            string error = null;
            yield return api.Health(
                response => healthy = response.status == "ok",
                message => error = message);

            if (!healthy)
            {
                Fail("Backend unavailable at " + ApiBaseUrl + ". " + (error ?? "Health check failed."));
                yield break;
            }

            yield return GenerateNewScenario();
        }

        private IEnumerator GenerateNewScenario()
        {
            ResetSession();
            Phase = SimulationPhase.Connecting;
            StatusMessage = "Generating scenario...";

            var request = new ScenarioGenerateRequest
            {
                difficulty = ClientConfig.Difficulty,
                environment = "urban",
                time_of_day = "day",
                threat_count = ClientConfig.ThreatCount,
                seed = ClientConfig.Seed
            };

            Scenario scenario = null;
            string error = null;
            yield return api.GenerateScenario(request, value => scenario = value, message => error = message);

            if (scenario == null)
            {
                Fail("Scenario generation failed. " + (error ?? string.Empty));
                yield break;
            }

            CurrentScenario = scenario;
            BuildThreats(scenario);
            if (environment != null)
            {
                environment.Apply(scenario);
            }

            StatusMessage = "Creating session...";
            SessionCreated session = null;
            error = null;
            yield return api.CreateSession(
                new SessionCreateRequest
                {
                    trainee_id = ClientConfig.TraineeId,
                    scenario_id = scenario.scenario_id
                },
                value => session = value,
                message => error = message);

            if (session == null)
            {
                Fail("Session creation failed. " + (error ?? string.Empty));
                yield break;
            }

            SessionId = session.session_id;
            SendEvent("SESSION_STARTED", 0, null, new EventPayload { trainee_id = ClientConfig.TraineeId });
            SendEvent(
                "SCENARIO_LOADED",
                0,
                null,
                new EventPayload
                {
                    scenario_id = scenario.scenario_id,
                    confidence = 0f,
                    spawn_time = 0f
                });

            Phase = SimulationPhase.Playing;
            _sessionStartedAt = Time.time;
            Elapsed = 0f;
            StatusMessage = "Scenario ready. Detect, classify and respond.";
        }

        private void BuildThreats(Scenario scenario)
        {
            _threats.Clear();
            if (scenario == null || scenario.threats == null)
            {
                return;
            }

            for (var index = 0; index < scenario.threats.Length; index++)
            {
                _threats.Add(new ThreatRuntime
                {
                    Profile = scenario.threats[index],
                    Index = index
                });
            }
        }

        private void Update()
        {
            if (Phase != SimulationPhase.Playing || CurrentScenario == null)
            {
                return;
            }

            Elapsed = Time.time - _sessionStartedAt;

            foreach (var threat in _threats)
            {
                if (!threat.Spawned && Elapsed >= threat.Profile.spawn_time)
                {
                    Spawn(threat);
                }

                if (threat.Spawned && !threat.Resolved && !threat.Detected
                    && ThreatPath.PastHorizon(
                        threat.Index,
                        threat.Profile.spawn_time,
                        Elapsed,
                        threat.Profile.speed_class))
                {
                    MarkMissed(threat);
                }

                if (threat.View != null)
                {
                    var controller = threat.View.GetComponent<ThreatController>();
                    if (controller != null)
                    {
                        controller.Tick(Elapsed);
                    }
                }
            }

            if (Selected == null || Selected.Resolved)
            {
                SelectNextThreat();
            }

            if (Elapsed >= CurrentScenario.duration_seconds)
            {
                StartCoroutine(FinishSession());
            }
        }

        private void Spawn(ThreatRuntime threat)
        {
            threat.Spawned = true;

            var view = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            view.name = "Threat " + threat.Profile.id;
            view.transform.localScale = Vector3.one * 0.9f;
            var renderer = view.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.material.color = new Color(0.75f, 0.78f, 0.82f);
            }

            var controller = view.AddComponent<ThreatController>();
            controller.index = threat.Index;
            controller.spawnTime = threat.Profile.spawn_time;
            controller.speedClass = threat.Profile.speed_class;
            controller.Tick(Elapsed);
            threat.View = view;

            SendEvent(
                "THREAT_SPAWNED",
                NowMs,
                threat.Profile.id,
                new EventPayload { spawn_time = threat.Profile.spawn_time });
        }

        private void MarkMissed(ThreatRuntime threat)
        {
            if (threat.Missed)
            {
                return;
            }

            threat.Missed = true;
            SendEvent("THREAT_MISSED", NowMs, threat.Profile.id, new EventPayload { spawn_time = threat.Profile.spawn_time });
            if (threat.View != null)
            {
                Destroy(threat.View);
                threat.View = null;
            }
        }

        public void SelectNextThreat()
        {
            Selected = null;
            foreach (var threat in _threats)
            {
                if (threat.Spawned && !threat.Resolved)
                {
                    Selected = threat;
                    return;
                }
            }
        }

        public void DetectSelected()
        {
            if (!CanAct() || Selected == null || Selected.Detected)
            {
                return;
            }

            Selected.Detected = true;
            SendEvent("THREAT_DETECTED", NowMs, Selected.Profile.id, new EventPayload { confidence = 0.92f });
            StatusMessage = "Detected " + Selected.Profile.id + ". Choose a classification.";
        }

        public void ClassifySelected(string label)
        {
            if (!CanAct() || Selected == null || !Selected.Detected || Selected.Classified)
            {
                return;
            }

            Selected.Classified = true;
            SendEvent("CLASSIFICATION_SUBMITTED", NowMs, Selected.Profile.id, new EventPayload { label = label });
            StatusMessage = "Classified as " + label + ". Choose a response.";
        }

        public void RespondSelected(string response)
        {
            if (!CanAct() || Selected == null || !Selected.Classified || Selected.Responded)
            {
                return;
            }

            Selected.Responded = true;
            SendEvent("RESPONSE_SUBMITTED", NowMs, Selected.Profile.id, new EventPayload { response = response });
            StatusMessage = "Response '" + response + "' recorded for " + Selected.Profile.id + ".";
            Selected = null;
            SelectNextThreat();
        }

        public void RaiseFalseAlarm()
        {
            if (!CanAct())
            {
                return;
            }

            SendEvent("FALSE_ALARM", NowMs, null, new EventPayload());
            StatusMessage = "False alarm recorded.";
        }

        public void RequestFinish()
        {
            StartCoroutine(FinishSession());
        }

        public void NewScenario()
        {
            if (Phase == SimulationPhase.Completing)
            {
                return;
            }

            StartCoroutine(GenerateNewScenario());
        }

        private bool CanAct()
        {
            return Phase == SimulationPhase.Playing && CurrentScenario != null && !string.IsNullOrEmpty(SessionId);
        }

        private IEnumerator FinishSession()
        {
            if (_finishing || Phase != SimulationPhase.Playing)
            {
                yield break;
            }

            _finishing = true;
            Phase = SimulationPhase.Completing;
            StatusMessage = "Scoring session...";

            foreach (var threat in _threats)
            {
                if (threat.Spawned && !threat.Detected && !threat.Missed)
                {
                    MarkMissed(threat);
                }
            }

            while (_pendingEvents > 0)
            {
                yield return null;
            }

            ScoreResult score = null;
            string error = null;
            yield return api.CompleteSession(SessionId, value => score = value, message => error = message);

            if (score == null)
            {
                _finishing = false;
                Fail("Session completion failed. " + (error ?? string.Empty));
                yield break;
            }

            Aar aar = null;
            error = null;
            yield return api.GetAar(SessionId, value => aar = value, message => error = message);

            if (aar == null)
            {
                _finishing = false;
                Fail("Session scored, but the AAR could not be loaded. " + (error ?? string.Empty));
                yield break;
            }

            LastAar = aar;
            Phase = SimulationPhase.Complete;
            StatusMessage = "Session complete.";
            Selected = null;
            _finishing = false;
        }

        private void SendEvent(string type, int timestampMs, string threatId, EventPayload payload)
        {
            if (string.IsNullOrEmpty(SessionId))
            {
                return;
            }

            _pendingEvents++;
            var envelope = new EventEnvelope
            {
                type = type,
                timestamp_ms = Mathf.Max(0, timestampMs),
                threat_id = threatId,
                payload = payload ?? new EventPayload()
            };

            StartCoroutine(api.SubmitEvent(
                SessionId,
                envelope,
                _ => _pendingEvents = Mathf.Max(0, _pendingEvents - 1),
                message =>
                {
                    _pendingEvents = Mathf.Max(0, _pendingEvents - 1);
                    StatusMessage = "Event '" + type + "' rejected: " + message;
                    Debug.LogWarning(StatusMessage);
                }));
        }

        private void ResetSession()
        {
            foreach (var threat in _threats)
            {
                if (threat.View != null)
                {
                    Destroy(threat.View);
                }
            }

            _threats.Clear();
            _pendingEvents = 0;
            _finishing = false;
            Selected = null;
            LastAar = null;
            SessionId = null;
            CurrentScenario = null;
            Elapsed = 0f;
        }

        private void Fail(string message)
        {
            Phase = SimulationPhase.Error;
            StatusMessage = message;
            Debug.LogError("Aeroguard: " + message);
        }
    }
}
