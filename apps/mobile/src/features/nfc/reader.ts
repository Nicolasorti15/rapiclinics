export async function readBedToken(_signal?: AbortSignal): Promise<string> {
  throw new Error(
    "La lectura NFC está disponible en la app de Android o iOS. En la vista web utiliza la selección de cama de demostración.",
  );
}
export const nfcAvailable = false;
export const uidDemoEnabled = false;
