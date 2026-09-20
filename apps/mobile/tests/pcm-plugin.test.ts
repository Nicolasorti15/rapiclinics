import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { patchPcmSource } = require("../plugins/withPcmStop.cjs");
it("patches the actual installed Android implementation reproducibly", () => {
  const source = readFileSync(
    require.resolve("@fugood/react-native-audio-pcm-stream/android/src/main/java/com/imxiqi/rnliveaudiostream/RNLiveAudioStreamModule.java"),
    "utf8",
  );
  const patched = patchPcmSource(source);
  expect(patched).toContain("previous.join()");
  expect(patched).toContain("volatile boolean isRecording");
  expect(patched).toContain("buffer, 0, bytesRead");
  expect(patchPcmSource(patched)).toBe(patched);
  expect(() => patchPcmSource("unexpected version")).toThrow("source changed");
});
