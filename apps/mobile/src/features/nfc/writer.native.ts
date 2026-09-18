import { nfcAvailable } from "./reader";

export async function writePatientToken(
  token: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!nfcAvailable)
    throw new Error("La escritura NFC requiere la app instalada.");
  if (!/^rc_[A-Za-z0-9_-]{32,64}$/.test(token))
    throw new Error("Código NFC no válido.");
  const {
    default: manager,
    Ndef,
    NfcTech,
  } = await import("react-native-nfc-manager");
  if (signal?.aborted) throw new Error("Escritura cancelada.");
  if (!(await manager.isSupported()))
    throw new Error("Este teléfono no tiene NFC.");
  await manager.start();
  if (!(await manager.isEnabled()))
    throw new Error("Activa NFC en los ajustes del teléfono.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    if (signal?.aborted) throw new Error("Escritura cancelada.");
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(new Error("Escritura cancelada."));
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "No se pudo escribir en 25 segundos. Vuelve a intentarlo.",
            ),
          ),
        25000,
      );
    });
    await Promise.race([
      manager.requestTechnology(NfcTech.Ndef, {
        alertMessage: "Acerca una etiqueta vacía para registrar al paciente.",
      }),
      cancelled,
    ]);
    if (signal?.aborted) throw new Error("Escritura cancelada.");
    const tag = await Promise.race([manager.getTag(), cancelled]);
    if (signal?.aborted) throw new Error("Escritura cancelada.");
    // Never silently replace someone else's tag or a URL already stored on it.
    const records = tag?.ndefMessage ?? [];
    const same =
      records.length === 1 &&
      records[0].tnf === 1 &&
      records[0].type[0] === 84 &&
      Ndef.text.decodePayload(new Uint8Array(records[0].payload)) === token;
    if (records.some((record) => record.tnf !== 0) && !same)
      throw new Error(
        "Esta etiqueta contiene datos. Usa una etiqueta NDEF vacía para evitar sobrescribir otra identificación.",
      );
    await Promise.race([
      manager.ndefHandler.writeNdefMessage(
        Ndef.encodeMessage([Ndef.textRecord(token)]),
      ),
      cancelled,
    ]);
    if (signal?.aborted) throw new Error("Escritura cancelada.");
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
    await manager.cancelTechnologyRequest().catch(() => undefined);
  }
}
