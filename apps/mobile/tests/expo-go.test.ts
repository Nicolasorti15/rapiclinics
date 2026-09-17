import { expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { executionEnvironment: "storeClient" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("react-native-nfc-manager", () => {
  throw new Error("NFC must never be initialized in Expo Go");
});

it("loads the app NFC adapter in Expo Go without touching the unavailable module", async () => {
  const { nfcAvailable, readBedToken } =
    await import("../src/features/nfc/reader.native");
  expect(nfcAvailable).toBe(false);
  await expect(readBedToken()).rejects.toThrow("En Expo Go selecciona");
});
