const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

// Source of truth for the 1.1.4 Android stop barrier. Applied during Expo prebuild.
function patchPcmSource(source) {
  if (source.includes("RAPICLINICS_STOP_BARRIER")) return source;
  const replacements = [
    [
      "private boolean isRecording;",
      "private volatile boolean isRecording;\n    private Thread recordingThread;",
    ],
    ["Thread recordingThread = new Thread", "recordingThread = new Thread"],
    [
      "Base64.encodeToString(buffer, Base64.NO_WRAP)",
      "Base64.encodeToString(buffer, 0, bytesRead, Base64.NO_WRAP)",
    ],
    [
      "public void stop() {\n        isRecording = false;\n    }",
      `public void stop(final Promise promise) {
        // RAPICLINICS_STOP_BARRIER: do not reinitialize until AudioRecord is released.
        isRecording = false;
        final Thread previous = recordingThread;
        new Thread(() -> {
            try {
                if (previous != null) previous.join();
                promise.resolve(null);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                promise.reject("PCM_STOP_FAILED", error);
            }
        }).start();
    }`,
    ],
  ];
  let result = source.replace(/\r\n/g, "\n");
  for (const [before, after] of replacements) {
    if (!result.includes(before))
      throw new Error(
        "PCM 1.1.4 source changed; review the Expo stop-barrier plugin.",
      );
    result = result.replace(before, after);
  }
  return result;
}
module.exports = function withPcmStop(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const root = path.dirname(
        require.resolve("@fugood/react-native-audio-pcm-stream/package.json", {
          paths: [config.modRequest.projectRoot],
        }),
      );
      if (
        JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
          .version !== "1.1.4"
      )
        throw new Error("Review the PCM plugin before upgrading past 1.1.4.");
      const file = path.join(
        root,
        "android/src/main/java/com/imxiqi/rnliveaudiostream/RNLiveAudioStreamModule.java",
      );
      fs.writeFileSync(file, patchPcmSource(fs.readFileSync(file, "utf8")));
      return config;
    },
  ]);
};
module.exports.patchPcmSource = patchPcmSource;
