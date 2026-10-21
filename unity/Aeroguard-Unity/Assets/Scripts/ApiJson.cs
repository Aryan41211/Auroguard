using System;
using System.Text;
using UnityEngine;

namespace Aeroguard
{
    /// <summary>
    /// JSON helpers for payloads Unity's JsonUtility cannot express directly.
    /// Event envelopes must omit <c>threat_id</c> for session-level events;
    /// JsonUtility would emit an empty string, which the backend rejects as an
    /// unknown threat.
    /// </summary>
    public static class ApiJson
    {
        public static string SerializeEvent(EventEnvelope envelope)
        {
            if (envelope == null)
            {
                throw new ArgumentNullException(nameof(envelope));
            }

            var builder = new StringBuilder(160);
            builder.Append('{');
            builder.Append("\"type\":\"").Append(Escape(envelope.type)).Append("\",");
            builder.Append("\"timestamp_ms\":").Append(Math.Max(0, envelope.timestamp_ms));

            if (!string.IsNullOrEmpty(envelope.threat_id))
            {
                builder.Append(",\"threat_id\":\"").Append(Escape(envelope.threat_id)).Append('"');
            }

            builder.Append(",\"payload\":").Append(JsonUtility.ToJson(envelope.payload ?? new EventPayload()));
            builder.Append('}');
            return builder.ToString();
        }

        /// <summary>Minimal JSON string escaping for identifiers and labels.</summary>
        public static string Escape(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            var builder = new StringBuilder(value.Length + 8);
            foreach (var character in value)
            {
                switch (character)
                {
                    case '"':
                        builder.Append("\\\"");
                        break;
                    case '\\':
                        builder.Append("\\\\");
                        break;
                    case '\n':
                        builder.Append("\\n");
                        break;
                    case '\r':
                        builder.Append("\\r");
                        break;
                    case '\t':
                        builder.Append("\\t");
                        break;
                    default:
                        builder.Append(character);
                        break;
                }
            }

            return builder.ToString();
        }
    }
}
