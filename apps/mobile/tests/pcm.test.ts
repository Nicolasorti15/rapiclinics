import { expect, it } from "vitest";
import {
  MAX_SAMPLES,
  PcmCapture,
  pcm16ToFloat32,
} from "../src/features/visits/pcm";

it("converts signed PCM16 little-endian including offset views into normalized float32", () => {
  const bytes = new Uint8Array([99, 0, 128, 255, 127, 0, 0, 0, 64, 99]);

  expect(Array.from(pcm16ToFloat32(bytes.subarray(1, 9)))).toEqual([
    -1,
    32767 / 32768,
    0,
    0.5,
  ]);

  expect(() => pcm16ToFloat32(new Uint8Array(1))).toThrow("incompleto");
});

it("caps raw PCM16 audio at three minutes, preserves order and clears between visits", () => {
  const capture = new PcmCapture();

  expect(() => capture.data()).toThrow("No se recibi\u00f3 audio");

  capture.append(new Uint8Array([0, 64]));

  expect(capture.append(new Uint8Array(MAX_SAMPLES * 2))).toBe(true);

  expect(capture.count).toBe(MAX_SAMPLES);

  const data = new Uint8Array(capture.data());

  expect(data.length).toBe(MAX_SAMPLES * 2);
  expect(Array.from(data.subarray(0, 2))).toEqual([0, 64]);

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  expect(view.getInt16(0, true)).toBe(16384);

  capture.append(new Uint8Array([0, 128]));
  expect(capture.count).toBe(MAX_SAMPLES);

  capture.clear();
  expect(() => capture.data()).toThrow();
});

it("measures usable audio and rejects silence, short recordings and clipping", () => {
  const short = new PcmCapture();
  short.append(new Uint8Array([0, 16]));
  expect(() => short.assertUsable()).toThrow("demasiado corta");

  const silence = new PcmCapture();
  silence.append(new Uint8Array(16000 * 2));
  expect(() => silence.assertUsable()).toThrow("demasiado bajo");

  const clipped = new PcmCapture();
  const clippedBytes = new Uint8Array(16000 * 2);
  const clippedView = new DataView(clippedBytes.buffer);
  for (let index = 0; index < 16000; index += 1)
    clippedView.setInt16(index * 2, 32767, true);
  clipped.append(clippedBytes);
  expect(() => clipped.assertUsable()).toThrow("saturado");

  const usable = new PcmCapture();
  const voice = new Uint8Array(16000 * 2);
  const voiceView = new DataView(voice.buffer);
  for (let index = 0; index < 16000; index += 1)
    voiceView.setInt16(index * 2, index % 2 ? -4096 : 4096, true);
  usable.append(voice);
  expect(usable.assertUsable()).toMatchObject({
    durationSeconds: 1,
    rms: 0.125,
    peak: 0.125,
    clippedRatio: 0,
  });
});

it("trims clear leading and trailing silence while keeping speech padding", () => {
  const capture = new PcmCapture();
  capture.append(new Uint8Array(16000 * 2));

  const voice = new Uint8Array(16000 * 2);
  const view = new DataView(voice.buffer);
  for (let index = 0; index < 16000; index += 1)
    view.setInt16(index * 2, index % 2 ? -4096 : 4096, true);

  capture.append(voice);
  capture.append(new Uint8Array(16000 * 2));

  expect(capture.data().byteLength).toBe(16000 * 2 * 3);
  expect(capture.transcriptionData().byteLength).toBe(16000 * 2 * 1.6);
});
