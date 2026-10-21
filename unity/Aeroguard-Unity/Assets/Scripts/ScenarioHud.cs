using System.Text;
using UnityEngine;

namespace Aeroguard
{
    /// <summary>
    /// Minimal IMGUI HUD for the Unity spike: scenario conditions, one-threat
    /// decision chain, false alarm, finish, and the AAR. Keeping the UI in code
    /// avoids binary scene assets and keeps the spike reviewable.
    /// </summary>
    public class ScenarioHud : MonoBehaviour
    {
        public SimulationManager manager;

        private GUIStyle _title;
        private GUIStyle _body;
        private GUIStyle _small;
        private GUIStyle _wrap;
        private Vector2 _aarScroll;

        private static readonly string[] Labels =
        {
            "friendly", "civilian", "unknown", "suspicious", "hostile"
        };

        private static readonly string[] Responses =
        {
            "monitor", "track", "report", "hold"
        };

        private void EnsureStyles()
        {
            if (_title != null)
            {
                return;
            }

            _title = new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold };
            _body = new GUIStyle(GUI.skin.label) { fontSize = 13 };
            _small = new GUIStyle(GUI.skin.label) { fontSize = 11 };
            _wrap = new GUIStyle(GUI.skin.label) { fontSize = 12, wordWrap = true };
        }

        private void OnGUI()
        {
            if (manager == null)
            {
                return;
            }

            EnsureStyles();
            var width = Mathf.Min(520f, Screen.width - 32f);
            GUILayout.BeginArea(new Rect(16f, 16f, width, Screen.height - 32f), GUI.skin.box);
            GUILayout.Label("AEROGUARD · Unity Spike", _title);
            GUILayout.Label("API " + manager.ApiBaseUrl + "   ·   phase: " + manager.Phase, _small);
            GUILayout.Label(manager.StatusMessage, _wrap);

            if (manager.CurrentScenario != null)
            {
                DrawScenario();
            }

            if (manager.Phase == SimulationPhase.Playing)
            {
                DrawDecisionPanel();
            }

            if (manager.Phase == SimulationPhase.Complete && manager.LastAar != null)
            {
                DrawAar();
            }

            if (manager.Phase == SimulationPhase.Error)
            {
                if (GUILayout.Button("Retry"))
                {
                    manager.NewScenario();
                }
            }

            GUILayout.FlexibleSpace();
            GUILayout.Label(
                "Flags: -aeroguardApi=URL  -aeroguardSeed=N  -aeroguardDifficulty=1-10  -aeroguardThreats=1-5",
                _small);
            GUILayout.EndArea();
        }

        private void DrawScenario()
        {
            var scenario = manager.CurrentScenario;
            GUILayout.Space(6f);
            GUILayout.Label(
                scenario.scenario_id + " · seed " + scenario.seed + " · difficulty " + scenario.difficulty,
                _body);
            GUILayout.Label(
                scenario.environment + " / " + scenario.time_of_day + " / " + scenario.visibility
                + " · sensor " + scenario.sensor_quality.ToString("0.00")
                + " · " + scenario.threats.Length + " threat(s)",
                _body);
            GUILayout.Label(
                "Session " + (string.IsNullOrEmpty(manager.SessionId) ? "-" : manager.SessionId)
                + " · elapsed " + manager.Elapsed.ToString("0.0") + "s / "
                + scenario.duration_seconds.ToString("0") + "s"
                + (manager.PendingEvents > 0 ? " · events pending " + manager.PendingEvents : string.Empty),
                _small);
        }

        private void DrawDecisionPanel()
        {
            GUILayout.Space(8f);

            var selected = manager.Selected;
            if (selected == null)
            {
                GUILayout.Label("No active threats. Waiting for spawns...", _body);
            }
            else
            {
                GUILayout.Label(
                    "Target " + selected.Profile.id + " · " + selected.Stage
                    + (selected.Detected ? " · detected" : string.Empty)
                    + (selected.Classified ? " · classified" : string.Empty),
                    _body);

                GUI.enabled = !selected.Detected;
                if (GUILayout.Button("DETECT"))
                {
                    manager.DetectSelected();
                }

                GUI.enabled = selected.Detected && !selected.Classified;
                GUILayout.Label("Classification", _small);
                GUILayout.BeginHorizontal();
                foreach (var label in Labels)
                {
                    if (GUILayout.Button(label))
                    {
                        manager.ClassifySelected(label);
                    }
                }

                GUILayout.EndHorizontal();

                GUI.enabled = selected.Classified && !selected.Responded;
                GUILayout.Label("Response", _small);
                GUILayout.BeginHorizontal();
                foreach (var response in Responses)
                {
                    if (GUILayout.Button(response))
                    {
                        manager.RespondSelected(response);
                    }
                }

                GUILayout.EndHorizontal();
                GUI.enabled = true;
            }

            GUILayout.Space(6f);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Next threat"))
            {
                manager.SelectNextThreat();
            }

            if (GUILayout.Button("False alarm"))
            {
                manager.RaiseFalseAlarm();
            }

            GUI.enabled = manager.PendingEvents == 0;
            if (GUILayout.Button("End session"))
            {
                manager.RequestFinish();
            }

            GUI.enabled = true;
            GUILayout.EndHorizontal();

            GUILayout.Space(4f);
            foreach (var threat in manager.Threats)
            {
                if (threat.Spawned)
                {
                    GUILayout.Label(" • " + threat.Profile.id + " — " + threat.Stage, _small);
                }
            }
        }

        private void DrawAar()
        {
            GUILayout.Space(8f);
            GUILayout.Label("AFTER-ACTION REVIEW", _title);

            _aarScroll = GUILayout.BeginScrollView(_aarScroll, false, true);
            GUILayout.Label(manager.LastAar.summary, _wrap);

            var scores = manager.LastAar.scores;
            if (scores != null)
            {
                GUILayout.Label(
                    "Final " + scores.final_score.ToString("0.0") + " / 100  ·  detection "
                    + scores.detection_score.ToString("0.0") + "  ·  classification "
                    + scores.classification_score.ToString("0.0") + "  ·  response "
                    + scores.response_score.ToString("0.0") + "  ·  timing "
                    + scores.timing_score.ToString("0.0") + "  ·  penalty "
                    + scores.penalty.ToString("0.0"),
                    _body);
            }

            var text = new StringBuilder();
            if (manager.LastAar.mistakes != null)
            {
                foreach (var mistake in manager.LastAar.mistakes)
                {
                    text.AppendLine("✗ " + mistake.kind + " · " + (mistake.threat_id ?? "-") + " · " + mistake.detail);
                }
            }

            if (manager.LastAar.strengths != null)
            {
                foreach (var strength in manager.LastAar.strengths)
                {
                    text.AppendLine("✓ " + strength);
                }
            }

            if (manager.LastAar.weaknesses != null)
            {
                foreach (var weakness in manager.LastAar.weaknesses)
                {
                    text.AppendLine("– " + weakness);
                }
            }

            text.AppendLine();
            text.AppendLine("Next: " + manager.LastAar.recommendation);
            GUILayout.Label(text.ToString(), _wrap);
            GUILayout.EndScrollView();

            if (GUILayout.Button("New scenario"))
            {
                manager.NewScenario();
            }
        }
    }
}
