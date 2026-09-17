import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NfcManager, { NfcTech } from "react-native-nfc-manager";
import { readBedToken } from "../src/features/nfc/reader.native";

vi.mock("expo-constants", () => ({
  default: { executionEnvironment: "bare" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));

vi.mock("react-native-nfc-manager", () => ({
  default: {
    isSupported: vi.fn(),
    start: vi.fn(),
    isEnabled: vi.fn(),
    requestTechnology: vi.fn(),
    getTag: vi.fn(),
    cancelTechnologyRequest: vi.fn(),
  },
  NfcTech: { Ndef: "Ndef" },
  Ndef: {
    text: {
      decodePayload: (bytes: Uint8Array) => new TextDecoder().decode(bytes),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(NfcManager.isSupported).mockResolvedValue(true);
  vi.mocked(NfcManager.isEnabled).mockResolvedValue(true);
  vi.mocked(NfcManager.start).mockResolvedValue(undefined);
  vi.mocked(NfcManager.requestTechnology).mockResolvedValue(NfcTech.Ndef);
  vi.mocked(NfcManager.cancelTechnologyRequest).mockResolvedValue(undefined);
  vi.mocked(NfcManager.getTag).mockResolvedValue({
    ndefMessage: [
      {
        tnf: 1,
        type: [84],
        id: [],
        payload: Array.from(new TextEncoder().encode("demo_12345678")),
      },
    ],
  });
});
afterEach(() => vi.useRealTimers());

describe("NFC session lifecycle (mocked hardware)", () => {
  it("reads an opaque text token and releases the reader", async () => {
    await expect(readBedToken()).resolves.toBe("demo_12345678");
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
  it("explains unsupported phones", async () => {
    vi.mocked(NfcManager.isSupported).mockResolvedValue(false);
    await expect(readBedToken()).rejects.toThrow("no tiene NFC");
    expect(NfcManager.requestTechnology).not.toHaveBeenCalled();
  });
  it("explains disabled NFC", async () => {
    vi.mocked(NfcManager.isEnabled).mockResolvedValue(false);
    await expect(readBedToken()).rejects.toThrow("Activa NFC");
  });
  it("rejects a tag without a text record and releases the reader", async () => {
    vi.mocked(NfcManager.getTag).mockResolvedValue({ ndefMessage: [] });
    await expect(readBedToken()).rejects.toThrow("no contiene");
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
  it("cancels a waiting session", async () => {
    vi.mocked(NfcManager.requestTechnology).mockImplementation(
      () => new Promise(() => {}),
    );
    const controller = new AbortController();
    const result = expect(readBedToken(controller.signal)).rejects.toThrow(
      "cancelada",
    );
    await vi.waitFor(() =>
      expect(NfcManager.requestTechnology).toHaveBeenCalled(),
    );
    controller.abort();
    await result;
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
  it("times out and releases a session after 25 seconds", async () => {
    vi.useFakeTimers();
    vi.mocked(NfcManager.requestTechnology).mockImplementation(
      () => new Promise(() => {}),
    );
    const result = expect(readBedToken()).rejects.toThrow("25 segundos");
    await vi.advanceTimersByTimeAsync(25000);
    await result;
    expect(NfcManager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
});
