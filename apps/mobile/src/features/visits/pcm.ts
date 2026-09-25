export const MAX_SAMPLES = 16000 * 180;
const BYTES_PER_SAMPLE = 2;
const SAMPLE_RATE = 16000;
const SILENCE_FRAME_SAMPLES = 320;
const SILENCE_PADDING_SAMPLES = SAMPLE_RATE * 0.3;

// Android streams raw signed little-endian PCM16.
// whisper.rn transcribeData() expects raw PCM16, mono, 16 kHz.
export function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  if (bytes.length % BYTES_PER_SAMPLE) throw new Error("Audio PCM incompleto.");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const samples = new Float32Array(bytes.length / BYTES_PER_SAMPLE);

  for (let i = 0; i < samples.length; i++)
    samples[i] = view.getInt16(i * BYTES_PER_SAMPLE, true) / 32768;

  return samples;
}

export class PcmCapture {
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  private squaredAmplitude = 0;
  private clippedSamples = 0;
  private peakAmplitude = 0;
  count = 0;

  append(input: Uint8Array) {
    const remainingSamples = MAX_SAMPLES - this.count;

    if (remainingSamples <= 0) return true;

    const maxBytes = remainingSamples * BYTES_PER_SAMPLE;
    const usableBytes = Math.min(input.length, maxBytes) & ~1;

    if (usableBytes > 0) {
      const chunk = input.slice(0, usableBytes);
      const view = new DataView(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength,
      );

      for (let offset = 0; offset < chunk.length; offset += BYTES_PER_SAMPLE) {
        const amplitude = Math.abs(view.getInt16(offset, true)) / 32768;
        this.squaredAmplitude += amplitude * amplitude;
        this.peakAmplitude = Math.max(this.peakAmplitude, amplitude);
        if (amplitude >= 0.99) this.clippedSamples += 1;
      }

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

  transcriptionData(): ArrayBuffer {
    const raw = this.data();
    const bytes = new Uint8Array(raw);
    const view = new DataView(raw);
    const quality = this.quality();
    const threshold = Math.max(0.0025, Math.min(0.012, quality.rms * 0.35));
    let firstSpeechSample = -1;
    let lastSpeechSample = -1;

    for (
      let frameStart = 0;
      frameStart < this.count;
      frameStart += SILENCE_FRAME_SAMPLES
    ) {
      const frameEnd = Math.min(frameStart + SILENCE_FRAME_SAMPLES, this.count);
      let squaredAmplitude = 0;

      for (let sample = frameStart; sample < frameEnd; sample += 1) {
        const amplitude =
          view.getInt16(sample * BYTES_PER_SAMPLE, true) / 32768;
        squaredAmplitude += amplitude * amplitude;
      }

      const rms = Math.sqrt(squaredAmplitude / (frameEnd - frameStart));
      if (rms >= threshold) {
        if (firstSpeechSample < 0) firstSpeechSample = frameStart;
        lastSpeechSample = frameEnd;
      }
    }

    if (firstSpeechSample < 0 || lastSpeechSample < 0) return raw;

    const start = Math.max(0, firstSpeechSample - SILENCE_PADDING_SAMPLES);
    const end = Math.min(
      this.count,
      lastSpeechSample + SILENCE_PADDING_SAMPLES,
    );

    if (start === 0 && end === this.count) return raw;

    return bytes.slice(start * BYTES_PER_SAMPLE, end * BYTES_PER_SAMPLE).buffer;
  }

  quality() {
    return {
      durationSeconds: this.count / 16000,
      rms: this.count ? Math.sqrt(this.squaredAmplitude / this.count) : 0,
      peak: this.peakAmplitude,
      clippedRatio: this.count ? this.clippedSamples / this.count : 0,
    };
  }

  assertUsable() {
    const quality = this.quality();
    if (quality.durationSeconds < 1)
      throw new Error(
        "La grabación es demasiado corta. Dicta al menos un segundo.",
      );
    if (quality.rms < 0.003)
      throw new Error(
        "El audio se escucha demasiado bajo. Acerca el teléfono y vuelve a grabar.",
      );
    if (quality.clippedRatio > 0.15)
      throw new Error(
        "El audio está saturado. Aleja un poco el teléfono y vuelve a grabar.",
      );
    return quality;
  }

  clear() {
    this.chunks = [];
    this.bytes = 0;
    this.squaredAmplitude = 0;
    this.clippedSamples = 0;
    this.peakAmplitude = 0;
    this.count = 0;
  }
}
