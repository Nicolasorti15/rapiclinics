import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import manager, { NfcTech } from "react-native-nfc-manager";
import { writePatientToken } from "../src/features/nfc/writer.native";

vi.mock("../src/features/nfc/reader", () => ({ nfcAvailable: true }));
vi.mock("react-native-nfc-manager", () => ({
  default: {
    isSupported: vi.fn(),
    start: vi.fn(),
    isEnabled: vi.fn(),
    requestTechnology: vi.fn(),
    getTag: vi.fn(),
    cancelTechnologyRequest: vi.fn(),
    ndefHandler: { writeNdefMessage: vi.fn() },
  },
  NfcTech: { Ndef: "Ndef" },
  Ndef: {
    encodeMessage: () => [1, 2, 3],
    textRecord: (token: string) => token,
    text: {
      decodePayload: (bytes: Uint8Array) => new TextDecoder().decode(bytes),
    },
  },
}));
const token = "rc_" + "a".repeat(43);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(manager.isSupported).mockResolvedValue(true);
  vi.mocked(manager.isEnabled).mockResolvedValue(true);
  vi.mocked(manager.start).mockResolvedValue(undefined);
  vi.mocked(manager.requestTechnology).mockResolvedValue(NfcTech.Ndef);
  vi.mocked(manager.getTag).mockResolvedValue({ ndefMessage: [] });
  vi.mocked(manager.cancelTechnologyRequest).mockResolvedValue(undefined);
  vi.mocked(manager.ndefHandler.writeNdefMessage).mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
describe("patient NFC writing with mocked hardware", () => {
  it("writes an empty tag and releases the session", async () => {
    await writePatientToken(token);
    expect(manager.ndefHandler.writeNdefMessage).toHaveBeenCalledOnce();
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
  it("refuses to overwrite an existing record", async () => {
    vi.mocked(manager.getTag).mockResolvedValue({
      ndefMessage: [
        { tnf: 1, type: [84], id: [], payload: [111, 116, 114, 111] },
      ],
    });
    await expect(writePatientToken(token)).rejects.toThrow("contiene datos");
    expect(manager.ndefHandler.writeNdefMessage).not.toHaveBeenCalled();
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
  it("rejects arbitrary text or a citizenship ID instead of an issued token", async () => {
    await expect(writePatientToken("123456789")).rejects.toThrow("no válido");
    expect(manager.requestTechnology).not.toHaveBeenCalled();
  });
  it("releases the native reader when writing fails", async () => {
    vi.mocked(manager.ndefHandler.writeNdefMessage).mockRejectedValue(
      new Error("read-only"),
    );
    await expect(writePatientToken(token)).rejects.toThrow("read-only");
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
  it("times out without activating anything", async () => {
    vi.useFakeTimers();
    vi.mocked(manager.requestTechnology).mockImplementation(
      () => new Promise(() => {}),
    );
    const result = expect(writePatientToken(token)).rejects.toThrow(
      "25 segundos",
    );
    await vi.advanceTimersByTimeAsync(25000);
    await result;
    expect(manager.cancelTechnologyRequest).toHaveBeenCalledOnce();
  });
});
