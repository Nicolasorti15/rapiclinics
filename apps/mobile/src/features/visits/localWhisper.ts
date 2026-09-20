export const localWhisperAvailable = false;
export class LocalWhisper {
  async start(
    _onDuration: (ms: number) => void,
    _onLimit: () => void,
    _onStatus: (text: string) => void,
  ): Promise<void> {
    throw new Error(
      "La transcripción local requiere la app Android compilada.",
    );
  }
  async stop(): Promise<void> {}
  async transcribe(): Promise<string> {
    throw new Error("Transcripción local no disponible.");
  }
  async dispose(): Promise<void> {}
}
