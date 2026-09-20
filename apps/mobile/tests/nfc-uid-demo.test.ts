import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import manager, { NfcTech } from "react-native-nfc-manager";

const config = vi.hoisted(() => ({
  mode: "demo",
  enabled: true,
  os: "android",
}));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return config.os;
    },
  },
}));
vi.mock("expo-constants", () => ({
  default: {
    executionEnvironment: "bare",
    get expoConfig() {
      return { extra: { mode: config.mode, nfcUidDemo: config.enabled } };
    },
  },
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
    ndefHandler: { writeNdefMessage: vi.fn() },
    transceive: vi.fn(),
  },
  NfcTech: { Ndef: "Ndef", NfcA: "NfcA" },
  Ndef: {
    text: {
      decodePayload: (bytes: Uint8Array) => new TextDecoder().decode(bytes),
    },
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  config.mode = "demo";
  config.enabled = true;
  config.os = "android";
  vi.mocked(manager.isSupported).mockResolvedValue(true);
  vi.mocked(manager.start).mockResolvedValue(undefined);
  vi.mocked(manager.isEnabled).mockResolvedValue(true);
  vi.mocked(manager.requestTechnology).mockResolvedValue(NfcTech.NfcA);
  vi.mocked(manager.getTag).mockResolvedValue({
    id: "0FC401B6",
    ndefMessage: [],
    techTypes: ["android.nfc.tech.IsoDep", "android.nfc.tech.NfcA"],
  });
  vi.mocked(manager.cancelTechnologyRequest).mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("read-only UID demo", () => {
  it("maps only the selected card to the existing demo bed token", async () => {
    const { readBedToken } = await import("../src/features/nfc/reader.native");
    await expect(readBedToken()).resolves.toBe(
      "demo_b9bfb5b5ba90bc35d7b742f70982fec3",
    );
    expect(manager.requestTechnology).toHaveBeenCalledWith(
      [NfcTech.Ndef, NfcTech.NfcA],
      expect.anything(),
    );
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
  });
  it("accepts Android UID case and separator variations", async () => {
    vi.mocked(manager.getTag).mockResolvedValue({
      id: "0f:c4:01:b6",
      ndefMessage: [],
    });
    const { readBedToken } = await import("../src/features/nfc/reader.native");
    await expect(readBedToken()).resolves.toMatch(/^demo_/);
  });
  it("rejects the second, unassigned card", async () => {
    vi.mocked(manager.getTag).mockResolvedValue({
      id: "5C0B78B6",
      ndefMessage: [],
    });
    const { readBedToken } = await import("../src/features/nfc/reader.native");
    await expect(readBedToken()).rejects.toThrow("solo está asociada");
  });
  it.each(["clinical", "disabled", "ios"])(
    "does not map a UID in %s mode",
    async (mode) => {
      if (mode === "clinical") config.mode = "clinical";
      if (mode === "disabled") config.enabled = false;
      if (mode === "ios") config.os = "ios";
      const { readBedToken } =
        await import("../src/features/nfc/reader.native");
      await expect(readBedToken()).rejects.toThrow("no contiene");
      expect(manager.requestTechnology).toHaveBeenCalledWith(
        NfcTech.Ndef,
        expect.anything(),
      );
    },
  );
  it("preserves a valid NDEF token even on the demo UID", async () => {
    vi.mocked(manager.getTag).mockResolvedValue({
      id: "0FC401B6",
      ndefMessage: [
        {
          tnf: 1,
          type: [84],
          id: [],
          payload: Array.from(new TextEncoder().encode("other_token_123")),
        },
      ],
    });
    const { readBedToken } = await import("../src/features/nfc/reader.native");
    await expect(readBedToken()).resolves.toBe("other_token_123");
  });
  it("does not hide a malformed NDEF token using the UID fallback", async () => {
    vi.mocked(manager.getTag).mockResolvedValue({
      id: "0FC401B6",
      ndefMessage: [{ tnf: 1, type: [84], id: [], payload: [33] }],
    });
    const { readBedToken } = await import("../src/features/nfc/reader.native");
    await expect(readBedToken()).rejects.toThrow("no válido");
  });
  it("cancels while obtaining tag metadata and releases the reader", async () => {
    vi.mocked(manager.getTag).mockImplementation(() => new Promise(() => {}));
    const { readBedToken } = await import("../src/features/nfc/reader.native");
    const controller = new AbortController();
    const result = expect(readBedToken(controller.signal)).rejects.toThrow(
      "cancelada",
    );
    await vi.waitFor(() => expect(manager.getTag).toHaveBeenCalled());
    controller.abort();
    await result;
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
  it("bounds a hung getTag call with the existing timeout", async () => {
    vi.useFakeTimers();
    vi.mocked(manager.getTag).mockImplementation(() => new Promise(() => {}));
    const { readBedToken } = await import("../src/features/nfc/reader.native");
    const result = expect(readBedToken()).rejects.toThrow("25 segundos");
    await vi.advanceTimersByTimeAsync(25000);
    await result;
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
});
