import Constants, { ExecutionEnvironment } from "expo-constants";

export const nfcAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export async function readBedToken(signal?: AbortSignal): Promise<string> {
  if (!nfcAvailable)
    throw new Error(
      "En Expo Go selecciona una cama de demostración. NFC requiere la app compilada.",
    );
  // Never initialize the missing native NFC module in Expo Go.
  const {
    default: NfcManager,
    Ndef,
    NfcTech,
  } = await import("react-native-nfc-manager");
  if (signal?.aborted) throw new Error("Lectura cancelada.");
  if (!(await NfcManager.isSupported()))
    throw new Error(
      "Este teléfono no tiene NFC. Utiliza la selección de cama de demostración.",
    );
  await NfcManager.start();
  if (signal?.aborted) throw new Error("Lectura cancelada.");
  if (!(await NfcManager.isEnabled()))
    throw new Error(
      "Activa NFC en los ajustes del teléfono y vuelve a intentarlo.",
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    if (signal?.aborted) throw new Error("Lectura cancelada.");
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(new Error("Lectura cancelada."));
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(
        () =>
          reject(
            new Error(
              "No se detectó una etiqueta en 25 segundos. Acércala al teléfono y vuelve a intentarlo.",
            ),
          ),
        25000,
      );
    });
    await Promise.race([
      NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: "Acerca el teléfono a la etiqueta de la cama.",
      }),
      cancelled,
    ]);
    const tag = await NfcManager.getTag();
    if (signal?.aborted) throw new Error("Lectura cancelada.");
    const record = tag?.ndefMessage?.find(
      (item) => item.tnf === 1 && item.type.length === 1 && item.type[0] === 84,
    );
    if (!record)
      throw new Error(
        "La etiqueta no contiene un identificador de cama compatible.",
      );
    const token = Ndef.text.decodePayload(new Uint8Array(record.payload));
    if (!/^[A-Za-z0-9_-]{8,256}$/.test(token))
      throw new Error("Identificador de etiqueta no válido.");
    return token;
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
