import { beforeEach, expect, it, vi } from "vitest";
import { LocalWhisper } from "../src/features/visits/localWhisper.android";

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  download: vi.fn(),
  move: vi.fn(),
  removeFile: vi.fn(),
  init: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  removeListener: vi.fn(),
  on: vi.fn(),
  whisperInit: vi.fn(),
  transcribe: vi.fn(),
  release: vi.fn(),
  abort: vi.fn(),
}));
vi.mock("expo-constants", () => ({
  default: { executionEnvironment: "bare" },
  ExecutionEnvironment: { StoreClient: "storeClient" },
}));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///private/",
  getInfoAsync: mocks.info,
  downloadAsync: mocks.download,
  moveAsync: mocks.move,
  deleteAsync: mocks.removeFile,
}));
vi.mock("@fugood/react-native-audio-pcm-stream", () => ({
  default: {
    init: mocks.init,
    start: mocks.start,
    stop: mocks.stop,
    on: mocks.on,
  },
}));
vi.mock("whisper.rn/utils/common", () => ({
  base64ToUint8Array: (value: string) =>
    new Uint8Array(Buffer.from(value, "base64")),
}));
vi.mock("whisper.rn/index", () => ({ initWhisper: mocks.whisperInit }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.info.mockResolvedValue({ exists: true, size: 77691713 });
  mocks.stop.mockResolvedValue(undefined);
  mocks.on.mockReturnValue({ remove: mocks.removeListener });
  mocks.whisperInit.mockResolvedValue({
    transcribeData: mocks.transcribe,
    release: mocks.release,
  });
  mocks.transcribe.mockReturnValue({
    stop: mocks.abort,
    promise: Promise.resolve({ result: " Nota local ", isAborted: false }),
  });
});
const start = (local: LocalWhisper) => local.start(vi.fn(), vi.fn(), vi.fn());
function feed() {
  mocks.on.mock.calls[0][1](Buffer.from([0, 64, 0, 128]).toString("base64"));
}

it("uses a cached multilingual model offline and transcribes float32 Spanish without uploading audio", async () => {
  const local = new LocalWhisper();
  await start(local);
  feed();
  expect(await local.transcribe()).toBe("Nota local");
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.init).toHaveBeenCalledWith(
    expect.objectContaining({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
    }),
  );
  expect(
    Array.from(new Float32Array(mocks.transcribe.mock.calls[0][0])),
  ).toEqual([0.5, -1]);
  expect(mocks.transcribe.mock.calls[0][1]).toEqual({
    language: "es",
    translate: false,
  });
  expect(mocks.release).toHaveBeenCalledOnce();
  expect(mocks.removeListener).toHaveBeenCalledOnce();
  await local.dispose();
});
it("rejects incomplete downloads before accessing the microphone and removes the partial file", async () => {
  mocks.info.mockResolvedValue({ exists: false });
  mocks.download.mockResolvedValue({ status: 200 });
  await expect(start(new LocalWhisper())).rejects.toThrow("incompleta");
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.move).not.toHaveBeenCalled();
  expect(mocks.removeFile).toHaveBeenCalledWith(
    expect.stringContaining(".partial"),
    { idempotent: true },
  );
});
it("waits for native microphone release before starting again", async () => {
  const local = new LocalWhisper();
  await start(local);
  let finish!: () => void;
  mocks.stop.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const stopped = local.stop();
  const restarted = start(local);
  await Promise.resolve();
  expect(mocks.init).toHaveBeenCalledOnce();
  finish();
  await stopped;
  await restarted;
  expect(mocks.init).toHaveBeenCalledTimes(2);
  mocks.stop.mockResolvedValue(undefined);
  await local.dispose();
});
it("releases Whisper on failure and retains audio for a local retry", async () => {
  const local = new LocalWhisper();
  await start(local);
  feed();
  mocks.transcribe.mockReturnValueOnce({
    stop: mocks.abort,
    promise: Promise.reject(new Error("Whisper failed")),
  });
  await expect(local.transcribe()).rejects.toThrow("Whisper failed");
  expect(mocks.release).toHaveBeenCalledOnce();
  expect(await local.transcribe()).toBe("Nota local");
  await local.dispose();
});
it("does not start recording if the screen closes during model preparation", async () => {
  const local = new LocalWhisper();
  const pending = start(local);
  await local.dispose();
  await expect(pending).rejects.toThrow("cancelada");
  expect(mocks.start).not.toHaveBeenCalled();
});

it("installs a complete model through a temporary file before opening the microphone", async () => {
  mocks.info
    .mockResolvedValueOnce({ exists: false })
    .mockResolvedValueOnce({ exists: true, size: 77691713 });
  mocks.download.mockResolvedValue({ status: 200 });
  const local = new LocalWhisper();
  await start(local);
  expect(mocks.download.mock.calls[0][0]).toMatch(
    /5359861c739e955e79d9a303bcbc70fb988958b1\/ggml-tiny.bin$/,
  );
  expect(mocks.move).toHaveBeenCalledWith({
    from: "file:///private/whisper-tiny-multilingual.bin.partial",
    to: "file:///private/whisper-tiny-multilingual.bin",
  });
  expect(mocks.start).toHaveBeenCalledOnce();
  await local.dispose();
});
it("releases a context that finishes initializing after the screen has closed", async () => {
  const local = new LocalWhisper();
  await start(local);
  feed();
  let finish!: (value: unknown) => void;
  mocks.whisperInit.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const transcribing = local.transcribe();
  await vi.waitFor(() => expect(mocks.whisperInit).toHaveBeenCalledOnce());
  await local.dispose();
  finish({ transcribeData: mocks.transcribe, release: mocks.release });
  await expect(transcribing).rejects.toThrow("cancelada");
  expect(mocks.transcribe).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
});
