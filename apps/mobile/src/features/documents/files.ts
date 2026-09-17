import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { apiResponse, API_URL, currentSession } from "../../api/client";

export async function previewPdf(
  documentId: string,
  kind: "documents" | "labs" = "documents",
) {
  const path = `/${kind}/${documentId}/file`;
  if (Platform.OS === "web") {
    const blob = await (await apiResponse(path)).blob();
    return URL.createObjectURL(blob);
  }
  // Refresh authorization before the native authenticated download.
  await apiResponse(`/auth/me`);
  const local = `${FileSystem.cacheDirectory}${documentId}.pdf`;
  try {
    const result = await FileSystem.downloadAsync(API_URL + path, local, {
      headers: { Authorization: `Bearer ${currentSession()?.access_token}` },
    });
    if (result.status !== 200)
      throw new Error("No se pudo abrir el PDF. Vuelve a intentarlo.");
    if (!(await Sharing.isAvailableAsync()))
      throw new Error("No hay un visor de documentos disponible.");
    await Sharing.shareAsync(local, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Abrir PDF ficticio",
    });
  } finally {
    await FileSystem.deleteAsync(local, { idempotent: true });
  }
}
