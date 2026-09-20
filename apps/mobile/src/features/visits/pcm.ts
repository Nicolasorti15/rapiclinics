export const MAX_SAMPLES = 16000 * 180;

// Android streams signed little-endian PCM16; Whisper's data API needs float32.
export function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  if (bytes.length % 2) throw new Error("Audio PCM incompleto.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = new Float32Array(bytes.length / 2);
  for (let i = 0; i < samples.length; i++)
    samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

export class PcmCapture {
  private chunks: Float32Array[] = [];
  count = 0;
  append(bytes: Uint8Array) {
    const samples = pcm16ToFloat32(bytes).subarray(0, MAX_SAMPLES - this.count);
    if (samples.length) this.chunks.push(samples);
    this.count += samples.length;
    return this.count === MAX_SAMPLES;
  }
  data(): ArrayBuffer {
    if (!this.count)
      throw new Error(
        "No se recibió audio. Vuelve a grabar o escribe la nota.",
      );
    const result = new Float32Array(this.count);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result.buffer;
  }
  clear() {
    this.chunks = [];
    this.count = 0;
  }
}
