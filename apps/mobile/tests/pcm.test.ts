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

  expect(
    capture.append(new Uint8Array(MAX_SAMPLES * 2)),
  ).toBe(true);

  expect(capture.count).toBe(MAX_SAMPLES);

  const data = new Uint8Array(capture.data());

  expect(data.length).toBe(MAX_SAMPLES * 2);
  expect(Array.from(data.subarray(0, 2))).toEqual([0, 64]);

  const view = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  );

  expect(view.getInt16(0, true)).toBe(16384);

  capture.append(new Uint8Array([0, 128]));
  expect(capture.count).toBe(MAX_SAMPLES);

  capture.clear();
  expect(() => capture.data()).toThrow();
});
