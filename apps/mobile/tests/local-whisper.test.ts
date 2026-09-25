import { beforeEach, expect, it, vi } from "vitest";
import { LocalWhisper } from "../src/features/visits/localWhisper.android";
import { MEDICAL_TRANSCRIPTION_PROMPT } from "../src/features/visits/medicalVocabulary";

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
  mocks.info.mockResolvedValue({ exists: true, size: 59707625 });
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
  const pcm = Buffer.alloc(16000 * 2);
  for (let index = 0; index < 16000; index += 1)
    pcm.writeInt16LE(index % 2 ? -4096 : 4096, index * 2);
  mocks.on.mock.calls[0][1](pcm.toString("base64"));
}

it("uses a cached multilingual model offline and transcribes raw PCM16 Spanish without uploading audio", async () => {
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
    Array.from(new Uint8Array(mocks.transcribe.mock.calls[0][0]).slice(0, 4)),
  ).toEqual([0, 16, 0, 240]);
  expect(mocks.transcribe.mock.calls[0][1]).toEqual({
    language: "es",
    translate: false,
    prompt: MEDICAL_TRANSCRIPTION_PROMPT,
    beamSize: 2,
    bestOf: 2,
    temperature: 0,
  });
  expect(mocks.release).not.toHaveBeenCalled();
  expect(mocks.removeListener).toHaveBeenCalledOnce();
  await local.dispose();
  expect(mocks.release).toHaveBeenCalledOnce();
});

it("warms Whisper while recording and reuses one context for another recording", async () => {
  const local = new LocalWhisper();
  await start(local);
  expect(mocks.whisperInit).toHaveBeenCalledOnce();
  feed();
  await local.transcribe();

  await start(local);
  feed();
  await local.transcribe();

  expect(mocks.whisperInit).toHaveBeenCalledOnce();
  expect(mocks.transcribe).toHaveBeenCalledTimes(2);
  expect(mocks.release).not.toHaveBeenCalled();
  await local.dispose();
  expect(mocks.release).toHaveBeenCalledOnce();
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
  expect(mocks.release).not.toHaveBeenCalled();
  expect(await local.transcribe()).toBe("Nota local");
  await local.dispose();
  expect(mocks.release).toHaveBeenCalledOnce();
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
    .mockResolvedValueOnce({ exists: true, size: 59707625 });
  mocks.download.mockResolvedValue({ status: 200 });
  const local = new LocalWhisper();
  await start(local);
  expect(mocks.download.mock.calls[0][0]).toMatch(
    /5359861c739e955e79d9a303bcbc70fb988958b1\/ggml-base-q5_1.bin$/,
  );
  expect(mocks.move).toHaveBeenCalledWith({
    from: "file:///private/whisper-base-q5-fast.bin.partial",
    to: "file:///private/whisper-base-q5-fast.bin",
  });
  expect(mocks.removeFile).toHaveBeenCalledWith(
    "file:///private/whisper-tiny-multilingual.bin",
    { idempotent: true },
  );
  expect(mocks.removeFile).toHaveBeenCalledWith(
    "file:///private/whisper-base-multilingual.bin",
    { idempotent: true },
  );
  expect(mocks.removeFile).toHaveBeenCalledWith(
    "file:///private/whisper-small-q5-clinical.bin",
    { idempotent: true },
  );
  expect(mocks.start).toHaveBeenCalledOnce();
  await local.dispose();
});
it("releases a context that finishes initializing after the screen has closed", async () => {
  const local = new LocalWhisper();
  let finish!: (value: unknown) => void;
  mocks.whisperInit.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await start(local);
  feed();
  const transcribing = local.transcribe();
  await vi.waitFor(() => expect(mocks.whisperInit).toHaveBeenCalledOnce());
  const disposing = local.dispose();
  finish({ transcribeData: mocks.transcribe, release: mocks.release });
  await disposing;
  await expect(transcribing).rejects.toThrow("cancelada");
  expect(mocks.transcribe).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
});
