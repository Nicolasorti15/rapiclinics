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
it("caps memory and audio at three minutes, preserves order and clears between visits", () => {
  const capture = new PcmCapture();
  expect(() => capture.data()).toThrow("No se recibió audio");
  capture.append(new Uint8Array([0, 64]));
  expect(capture.append(new Uint8Array(MAX_SAMPLES * 2))).toBe(true);
  expect(capture.count).toBe(MAX_SAMPLES);
  expect(new Float32Array(capture.data())[0]).toBe(0.5);
  capture.append(new Uint8Array([0, 128]));
  expect(capture.count).toBe(MAX_SAMPLES);
  capture.clear();
  expect(() => capture.data()).toThrow();
});
