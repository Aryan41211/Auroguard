using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Aeroguard.EditorTools
{
    /// <summary>
    /// One-shot project setup for headless/CI checkouts: creates the empty
    /// Main scene, registers it in build settings and applies player settings.
    /// Run with:
    /// Unity -batchmode -quit -projectPath unity/Aeroguard-Unity
    ///       -executeMethod Aeroguard.EditorTools.ProjectSetup.Configure
    /// </summary>
    public static class ProjectSetup
    {
        private const string ScenePath = "Assets/Scenes/Main.unity";

        [MenuItem("Aeroguard/Configure Project")]
        public static void Configure()
        {
            Directory.CreateDirectory("Assets/Scenes");
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(ScenePath, true)
            };

            PlayerSettings.companyName = "Aeroguard";
            PlayerSettings.productName = "Aeroguard Simulator";
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;

            AssetDatabase.SaveAssets();
            Debug.Log("Aeroguard project configured: " + ScenePath);
        }

        /// <summary>Build a Windows player for smoke verification.</summary>
        [MenuItem("Aeroguard/Build Windows Player")]
        public static void BuildWindows()
        {
            Configure();
            Directory.CreateDirectory("Builds");
            var report = BuildPipeline.BuildPlayer(
                new[] { ScenePath },
                "Builds/Aeroguard.exe",
                BuildTarget.StandaloneWindows64,
                BuildOptions.None);

            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                throw new UnityEditor.Build.BuildFailedException("Windows build failed: " + report.summary.result);
            }

            Debug.Log("Aeroguard Windows build succeeded: " + report.summary.totalSize + " bytes");
        }
    }
}
