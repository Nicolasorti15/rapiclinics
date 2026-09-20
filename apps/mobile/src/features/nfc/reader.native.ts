import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

// Explicit opt-in for the test APK only. This is a public demo identifier,
// never an authentication factor or a replacement for server authorization.
export const uidDemoEnabled =
  Platform.OS === "android" &&
  Constants.expoConfig?.extra?.mode === "demo" &&
  Constants.expoConfig?.extra?.nfcUidDemo === true;

function demoTokenForUid(id?: string): string | undefined {
  if (!uidDemoEnabled || !id) return;
  const uid = id.replace(/[:-]/g, "").toUpperCase();
  if (uid === "0FC401B6") return "demo_b9bfb5b5ba90bc35d7b742f70982fec3";
}

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
      NfcManager.requestTechnology(
        uidDemoEnabled ? [NfcTech.Ndef, NfcTech.NfcA] : NfcTech.Ndef,
        {
          alertMessage: "Acerca el teléfono a la etiqueta de la cama.",
        },
      ),
      cancelled,
    ]);
    const tag = await Promise.race([NfcManager.getTag(), cancelled]);
    if (signal?.aborted) throw new Error("Lectura cancelada.");
    const record = tag?.ndefMessage?.find(
      (item) => item.tnf === 1 && item.type.length === 1 && item.type[0] === 84,
    );
    if (!record) {
      const demoToken = demoTokenForUid(tag?.id);
      if (demoToken) return demoToken;
      throw new Error(
        uidDemoEnabled
          ? "La etiqueta no contiene un identificador compatible. En esta prueba solo está asociada la tarjeta 0FC401B6 a la cama demo 302-B."
          : "La etiqueta no contiene un identificador de cama compatible.",
      );
    }
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
