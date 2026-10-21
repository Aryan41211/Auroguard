using NUnit.Framework;

namespace Aeroguard.Tests
{
    public class ClientConfigTests
    {
        [Test]
        public void ResolveBaseUrl_FallsBackToDefault()
        {
            Assert.That(ClientConfig.ResolveBaseUrl(new string[0], null), Is.EqualTo(ClientConfig.DefaultBaseUrl));
            Assert.That(ClientConfig.ResolveBaseUrl(null, ""), Is.EqualTo(ClientConfig.DefaultBaseUrl));
        }

        [Test]
        public void ResolveBaseUrl_PrefersCommandLineAndTrimsTrailingSlash()
        {
            var args = new[] { "-aeroguardApi=http://127.0.0.1:9000/" };
            Assert.That(
                ClientConfig.ResolveBaseUrl(args, "http://ignored:8000"),
                Is.EqualTo("http://127.0.0.1:9000"));
        }

        [Test]
        public void ResolveBaseUrl_AcceptsSeparateArgumentToken()
        {
            var args = new[] { "-aeroguardApi", "http://backend:8000" };
            Assert.That(ClientConfig.ResolveBaseUrl(args, null), Is.EqualTo("http://backend:8000"));
        }

        [Test]
        public void ResolveBaseUrl_UsesEnvironmentWhenNoArgument()
        {
            Assert.That(
                ClientConfig.ResolveBaseUrl(new[] { "-batchmode" }, "http://10.0.0.5:8000/"),
                Is.EqualTo("http://10.0.0.5:8000"));
        }

        [Test]
        public void IntArgument_ParsesValuesAndFallsBack()
        {
            var args = new[] { "-aeroguardSeed=12345", "-aeroguardDifficulty", "7" };
            Assert.That(ClientConfig.IntArgument(args, "aeroguardSeed", 0), Is.EqualTo(12345));
            Assert.That(ClientConfig.IntArgument(args, "aeroguardDifficulty", 1), Is.EqualTo(7));
            Assert.That(ClientConfig.IntArgument(args, "missing", 4), Is.EqualTo(4));
            Assert.That(ClientConfig.IntArgument(new[] { "-aeroguardSeed=nope" }, "aeroguardSeed", 4), Is.EqualTo(4));
        }
    }
}
