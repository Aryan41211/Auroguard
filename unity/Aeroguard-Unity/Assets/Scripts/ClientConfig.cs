using System;
using System.Globalization;

namespace Aeroguard
{
    /// <summary>
    /// Resolves the backend endpoint and demo scenario settings from command
    /// line arguments and environment variables, with offline-first defaults.
    /// </summary>
    public static class ClientConfig
    {
        public const string DefaultBaseUrl = "http://127.0.0.1:8000";
        public const string DefaultTraineeId = "UNITY-TRAINEE";
        public const int DefaultDifficulty = 4;
        public const int DefaultThreatCount = 2;
        public const int DefaultSeed = 20261021;

        /// <summary>
        /// Normalise a base URL by trimming whitespace and trailing slashes.
        /// Falls back to <see cref="DefaultBaseUrl"/> when empty.
        /// </summary>
        public static string NormaliseBaseUrl(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return DefaultBaseUrl;
            }

            return value.Trim().TrimEnd('/');
        }

        /// <summary>
        /// Resolve the base URL from <c>-aeroguardApi=URL</c> (or
        /// <c>-aeroguardApi URL</c>), then <c>AEROGUARD_API_URL</c>, then the
        /// offline default.
        /// </summary>
        public static string ResolveBaseUrl(string[] args, string environmentValue)
        {
            var fromArgs = StringArgument(args, "aeroguardApi");
            if (!string.IsNullOrWhiteSpace(fromArgs))
            {
                return NormaliseBaseUrl(fromArgs);
            }

            return NormaliseBaseUrl(environmentValue);
        }

        /// <summary>Current process base URL.</summary>
        public static string BaseUrl =>
            ResolveBaseUrl(
                Environment.GetCommandLineArgs(),
                Environment.GetEnvironmentVariable("AEROGUARD_API_URL"));

        /// <summary>Current trainee id (<c>-aeroguardTrainee</c>).</summary>
        public static string TraineeId => IntOrStringArgument("aeroguardTrainee", DefaultTraineeId);

        /// <summary>Current difficulty (<c>-aeroguardDifficulty</c>, 1-10).</summary>
        public static int Difficulty =>
            Math.Max(1, Math.Min(10, IntArgument(Environment.GetCommandLineArgs(), "aeroguardDifficulty", DefaultDifficulty)));

        /// <summary>Current threat count (<c>-aeroguardThreats</c>).</summary>
        public static int ThreatCount =>
            Math.Max(1, Math.Min(5, IntArgument(Environment.GetCommandLineArgs(), "aeroguardThreats", DefaultThreatCount)));

        /// <summary>Current seed (<c>-aeroguardSeed</c>).</summary>
        public static int Seed =>
            IntArgument(Environment.GetCommandLineArgs(), "aeroguardSeed", DefaultSeed);

        /// <summary>
        /// Find <c>-name=value</c> or <c>-name value</c> in an argument array.
        /// </summary>
        public static string StringArgument(string[] args, string name)
        {
            if (args == null || string.IsNullOrEmpty(name))
            {
                return null;
            }

            for (var index = 0; index < args.Length; index++)
            {
                var argument = args[index] ?? string.Empty;
                var prefix = "-" + name + "=";
                if (argument.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    return argument.Substring(prefix.Length);
                }

                if (argument.Equals("-" + name, StringComparison.OrdinalIgnoreCase)
                    && index + 1 < args.Length)
                {
                    return args[index + 1];
                }
            }

            return null;
        }

        /// <summary>Parse an integer command line argument with a fallback.</summary>
        public static int IntArgument(string[] args, string name, int fallback)
        {
            var raw = StringArgument(args, name);
            return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
                ? value
                : fallback;
        }

        private static string IntOrStringArgument(string name, string fallback)
        {
            var raw = StringArgument(Environment.GetCommandLineArgs(), name);
            return string.IsNullOrWhiteSpace(raw) ? fallback : raw;
        }
    }
}
