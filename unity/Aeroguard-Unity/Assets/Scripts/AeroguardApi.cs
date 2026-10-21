using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Aeroguard
{
    /// <summary>
    /// Thin coroutine HTTP client for the Aeroguard API. The client only sends
    /// recorded actions and renders responses; it never computes a score.
    /// </summary>
    public class AeroguardApi : MonoBehaviour
    {
        [Tooltip("Backend base URL, e.g. http://127.0.0.1:8000")]
        public string baseUrl = "";

        public float timeoutSeconds = 10f;

        private void Awake()
        {
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                baseUrl = ClientConfig.BaseUrl;
            }
        }

        public IEnumerator Health(Action<HealthResponse> onSuccess, Action<string> onError)
        {
            yield return Send<HealthResponse>("GET", "/health", null, onSuccess, onError);
        }

        public IEnumerator GenerateScenario(
            ScenarioGenerateRequest body,
            Action<Scenario> onSuccess,
            Action<string> onError)
        {
            yield return Send("POST", "/api/v1/scenarios/generate", JsonUtility.ToJson(body), onSuccess, onError);
        }

        public IEnumerator CreateSession(
            SessionCreateRequest body,
            Action<SessionCreated> onSuccess,
            Action<string> onError)
        {
            yield return Send("POST", "/api/v1/sessions", JsonUtility.ToJson(body), onSuccess, onError);
        }

        public IEnumerator SubmitEvent(
            string sessionId,
            EventEnvelope body,
            Action<EventCreated> onSuccess,
            Action<string> onError)
        {
            var path = "/api/v1/sessions/" + UnityWebRequest.EscapeURL(sessionId) + "/events";
            yield return Send("POST", path, ApiJson.SerializeEvent(body), onSuccess, onError);
        }

        public IEnumerator CompleteSession(
            string sessionId,
            Action<ScoreResult> onSuccess,
            Action<string> onError)
        {
            var path = "/api/v1/sessions/" + UnityWebRequest.EscapeURL(sessionId) + "/complete";
            yield return Send("POST", path, null, onSuccess, onError);
        }

        public IEnumerator GetAar(
            string sessionId,
            Action<Aar> onSuccess,
            Action<string> onError)
        {
            var path = "/api/v1/sessions/" + UnityWebRequest.EscapeURL(sessionId) + "/aar";
            yield return Send<Aar>("GET", path, null, onSuccess, onError);
        }

        private IEnumerator Send<T>(
            string method,
            string path,
            string jsonBody,
            Action<T> onSuccess,
            Action<string> onError)
            where T : class
        {
            var url = (string.IsNullOrWhiteSpace(baseUrl) ? ClientConfig.DefaultBaseUrl : baseUrl.TrimEnd('/')) + path;
            using (var request = new UnityWebRequest(url, method))
            {
                request.timeout = Mathf.Max(1, Mathf.RoundToInt(timeoutSeconds));
                request.downloadHandler = new DownloadHandlerBuffer();

                if (jsonBody != null)
                {
                    var bytes = Encoding.UTF8.GetBytes(jsonBody);
                    request.uploadHandler = new UploadHandlerRaw(bytes);
                    request.SetRequestHeader("Content-Type", "application/json");
                }

                yield return request.SendWebRequest();

                var responseBody = request.downloadHandler != null ? request.downloadHandler.text : string.Empty;

                if (request.result != UnityWebRequest.Result.Success || request.responseCode >= 400)
                {
                    var detail = string.IsNullOrWhiteSpace(request.error) ? "HTTP " + request.responseCode : request.error;
                    if (!string.IsNullOrWhiteSpace(responseBody))
                    {
                        detail += " " + responseBody;
                    }

                    Debug.LogWarning("Aeroguard API " + method + " " + url + " failed: " + detail);
                    onError?.Invoke(detail);
                    yield break;
                }

                T parsed;
                try
                {
                    parsed = JsonUtility.FromJson<T>(responseBody);
                }
                catch (Exception exception)
                {
                    Debug.LogWarning("Aeroguard API " + method + " " + url + " returned invalid JSON: " + exception.Message);
                    onError?.Invoke("Invalid JSON from " + path + ": " + exception.Message);
                    yield break;
                }

                if (parsed == null)
                {
                    onError?.Invoke("Empty response from " + path);
                    yield break;
                }

                onSuccess?.Invoke(parsed);
            }
        }
    }
}
