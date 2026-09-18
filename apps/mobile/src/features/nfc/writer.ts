export async function writePatientToken(
  _token: string,
  _signal?: AbortSignal,
): Promise<void> {
  throw new Error(
    "Para escribir NFC utiliza la app instalada en un teléfono compatible.",
  );
}
