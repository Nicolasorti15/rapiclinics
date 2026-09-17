import React, { useEffect } from "react";
import { Modal, View } from "react-native";
import { Button, c } from "../../components/ui";

export function PdfPreview({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  if (!url) return null;
  return (
    <Modal visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 16, gap: 12 }}>
        <Button title="Cerrar PDF original" secondary onPress={onClose} />
        <iframe
          title="PDF original del paciente ficticio"
          src={`/pdf-viewer.html#${encodeURIComponent(url)}`}
          style={{ flex: 1, border: 0, width: "100%", backgroundColor: "#fff" }}
        />
        <a
          href={url}
          download="documento-ficticio.pdf"
          style={{
            color: c.teal,
            fontSize: 16,
            padding: 12,
            textAlign: "center",
          }}
        >
          Descargar original si el visor no está disponible
        </a>
      </View>
    </Modal>
  );
}
