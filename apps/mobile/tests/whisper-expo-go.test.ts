import { expect, it, vi } from "vitest";
vi.mock("expo-constants", () => ({
  default: { executionEnvironment: "storeClient" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("@fugood/react-native-audio-pcm-stream", () => {
  throw new Error("Must not load PCM in Expo Go");
});
vi.mock("whisper.rn/index", () => {
  throw new Error("Must not load Whisper in Expo Go");
});
it("keeps Expo Go usable without loading either native module", async () => {
  const { LocalWhisper, localWhisperAvailable } =
    await import("../src/features/visits/localWhisper.android");
  expect(localWhisperAvailable).toBe(false);
  await expect(
    new LocalWhisper().start(vi.fn(), vi.fn(), vi.fn()),
  ).rejects.toThrow("Expo Go");
});
