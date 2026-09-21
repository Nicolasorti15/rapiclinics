export const MAX_SAMPLES = 16000 * 180;
const BYTES_PER_SAMPLE = 2;

// Android streams raw signed little-endian PCM16.
// whisper.rn transcribeData() expects raw PCM16, mono, 16 kHz.
export function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  if (bytes.length % BYTES_PER_SAMPLE)
    throw new Error("Audio PCM incompleto.");

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );

  const samples = new Float32Array(bytes.length / BYTES_PER_SAMPLE);

  for (let i = 0; i < samples.length; i++)
    samples[i] = view.getInt16(i * BYTES_PER_SAMPLE, true) / 32768;

  return samples;
}

export class PcmCapture {
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  count = 0;

  append(input: Uint8Array) {
    const remainingSamples = MAX_SAMPLES - this.count;

    if (remainingSamples <= 0)
      return true;

    const maxBytes = remainingSamples * BYTES_PER_SAMPLE;
    const usableBytes =
      Math.min(input.length, maxBytes) & ~1;

    if (usableBytes > 0) {
      const chunk = input.slice(0, usableBytes);

      this.chunks.push(chunk);
      this.bytes += chunk.length;
      this.count += chunk.length / BYTES_PER_SAMPLE;
    }

    return this.count >= MAX_SAMPLES;
  }

  data(): ArrayBuffer {
    if (!this.count)
      throw new Error(
        "No se recibi\u00f3 audio. Vuelve a grabar o escribe la nota.",
      );

    const result = new Uint8Array(this.bytes);
    let offset = 0;

    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  clear() {
    this.chunks = [];
    this.bytes = 0;
    this.count = 0;
  }
}
