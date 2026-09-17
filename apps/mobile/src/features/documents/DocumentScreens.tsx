import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  api,
  apiResponse,
  API_URL,
  appendFile,
  currentSession,
} from "../../api/client";
import {
  Badge,
  Body,
  Button,
  Card,
  Empty,
  Icon,
  Label,
  Loading,
  Notice,
  Page,
  s,
  Title,
} from "../../components/ui";
import type { ClinicalDocument, Routes } from "../../types";
import { useAction, useResource } from "../core";
import { previewPdf } from "./files";
import { PdfPreview } from "./PdfPreview";

export function DocumentsScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Documents">) {
  const { patient, scan_id } = route.params;
  const { data, error, loading } = useResource<ClinicalDocument[]>(
    `/patients/${patient.id}/documents`,
  );
  const action = useAction();
  const upload = async (form: FormData) => {
    form.append("scan_id", scan_id);
    const document = await api<ClinicalDocument>(
      `/patients/${patient.id}/documents`,
      "POST",
      form,
    );
    navigation.navigate("Document", { ...route.params, document });
  };
  const choose = () =>
    action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (file.size && file.size > 10 * 1024 * 1024)
        throw new Error("El PDF debe pesar menos de 10 MB.");
      const form = new FormData();
      await appendFile(form, file.uri, file.name, "application/pdf");
      try {
        await upload(form);
      } finally {
        if (Platform.OS !== "web")
          await FileSystem.deleteAsync(file.uri, { idempotent: true });
      }
    });
  const sample = () =>
    action.run(async () => {
      const path = `/demo/patients/${patient.id}/sample-pdf`;
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await apiResponse(path)).blob();
        form.append("file", blob, "ejemplo-ficticio.pdf");
        await upload(form);
      } else {
        await apiResponse("/auth/me");
        const uri = `${FileSystem.cacheDirectory}sample-${patient.id}.pdf`;
        try {
          const result = await FileSystem.downloadAsync(API_URL + path, uri, {
            headers: {
              Authorization: `Bearer ${currentSession()?.access_token}`,
            },
          });
          if (result.status !== 200)
            throw new Error("No se pudo preparar el ejemplo.");
          await appendFile(
            form,
            uri,
            "ejemplo-ficticio.pdf",
            "application/pdf",
          );
          await upload(form);
        } finally {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    });
  return (
    <Page patient={patient}>
      <Label>INFORMACIÓN CON TRAZABILIDAD</Label>
      <Title>Documentos</Title>
      <Body muted>
        El original se conserva. Tú revisas y confirmas a quién pertenece.
      </Body>
      <Button
        title="Importar PDF ficticio"
        icon="upload"
        loading={action.busy}
        onPress={choose}
      />
      <Button
        title="Usar un PDF de ejemplo"
        secondary
        icon="file-plus"
        loading={action.busy}
        onPress={sample}
      />
      {Boolean(error || action.error) && (
        <Notice error text={error || action.error} />
      )}
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          title="Un lugar para cada documento"
          text="Importa un PDF ficticio o utiliza el ejemplo incluido para probar la revisión."
        />
      ) : (
        data.map((document) => (
          <Pressable
            key={document.id}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate("Document", { ...route.params, document })
            }
          >
            <Card>
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <View style={s.smallIcon}>
                  <Icon name="file-text" />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={s.subtitle}>{document.filename}</Text>
                  <Text style={s.small}>
                    {new Date(document.created_at).toLocaleDateString("es-CO")}
                  </Text>
                </View>
                <Icon name="chevron-right" />
              </View>
              <Badge warn={document.status !== "VALIDATED"}>
                {document.status === "VALIDATED"
                  ? "VALIDADO"
                  : document.identity_status === "MISMATCH"
                    ? "IDENTIDAD DISCREPANTE"
                    : "PENDIENTE DE REVISIÓN"}
              </Badge>
            </Card>
          </Pressable>
        ))
      )}
    </Page>
  );
}

export function DocumentScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Document">) {
  const [document, setDocument] = useState(route.params.document);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [ehrConfirm, setEhrConfirm] = useState(false);
  const action = useAction();
  const { patient } = route.params;
  const mismatch = document.identity_status === "MISMATCH";
  const validate = () =>
    action.run(async () =>
      setDocument(
        await api<ClinicalDocument>(
          `/documents/${document.id}/validate`,
          "POST",
          {
            reviewed: true,
            scan_id: route.params.scan_id,
            confirmed_patient_id: patient.id,
            identity_manually_checked: checked,
          },
        ),
      ),
    );
  return (
    <Page patient={patient}>
      <Label>REVISIÓN DOCUMENTAL</Label>
      <PdfPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
      <Title>{document.filename}</Title>
      <Badge warn={document.status !== "VALIDATED"}>
        {document.status === "VALIDATED"
          ? "VALIDADO POR UNA PERSONA"
          : "PENDIENTE DE REVISIÓN"}
      </Badge>
      <Button
        title="Abrir PDF original"
        secondary
        icon="external-link"
        loading={action.busy}
        onPress={() =>
          action.run(async () => {
            const url = await previewPdf(document.id);
            if (url) setPreviewUrl(url);
          })
        }
      />
      <Notice
        error={mismatch}
        text={
          mismatch
            ? "El documento contiene un identificador distinto. La asociación está bloqueada."
            : document.identity_status === "MATCH"
              ? "El identificador del documento coincide. Revisa el original antes de confirmar."
              : "No se encontraron identificadores compatibles. Revisa el original y verifica manualmente la identidad."
        }
      />
      <Card>
        <Text style={s.subtitle}>Comparación de identidad</Text>
        <Body>Paciente activo: {patient.identifier}</Body>
        <Body>
          En el PDF:{" "}
          {document.extraction.identifiers.join(", ") || "No detectado"}
        </Body>
        <Text style={s.small}>
          La demo reconoce identificadores SIM-0000. Otros formatos requieren
          revisión manual.
        </Text>
      </Card>
      <Card>
        <Label>EXTRACTO DEL DOCUMENTO</Label>
        <Body>{document.extraction.summary}</Body>
        <Text style={s.small}>
          Fragmento literal. No es una interpretación clínica.
        </Text>
      </Card>
      <Card>
        <Label>INTEGRIDAD DEL ORIGINAL</Label>
        <Text selectable style={[s.small, { fontSize: 11 }]}>
          {document.sha256}
        </Text>
        <Text style={s.small}>
          Huella SHA-256 · Original almacenado sin modificaciones
        </Text>
      </Card>
      {document.status !== "VALIDATED" && !mismatch && (
        <>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="He revisado el PDF original y verificado la identidad del paciente"
            accessibilityState={{ checked }}
            onPress={() => setChecked(!checked)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 56,
              padding: 8,
            }}
          >
            <Icon name={checked ? "check-square" : "square"} />
            <Text style={[s.body, { flex: 1 }]}>
              He revisado el original y verificado la identidad del paciente.
            </Text>
          </Pressable>
          <Button
            title="Confirmar asociación"
            icon="check"
            disabled={!checked}
            loading={action.busy}
            onPress={validate}
          />
        </>
      )}
      {document.status !== "VALIDATED" && (
        <Button
          title="Descartar importación"
          danger
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              await api(`/documents/${document.id}/discard`, "POST");
              navigation.goBack();
            })
          }
        />
      )}
      {document.status === "VALIDATED" && (
        <Card>
          <Label>HISTORIA CLÍNICA SIMULADA</Label>
          <Body>
            {document.ehr_status === "ACCEPTED"
              ? "Envío aceptado por el sistema de demostración."
              : document.ehr_status === "ERROR"
                ? "El envío falló. El documento validado sigue guardado; puedes reintentar."
                : "El documento está listo para un envío simulado."}
          </Body>
          {document.ehr_status !== "ACCEPTED" &&
            (!ehrConfirm ? (
              <Button
                title="Preparar envío simulado"
                secondary
                icon="send"
                onPress={() => setEhrConfirm(true)}
              />
            ) : (
              <>
                <Body muted>
                  Se asociará el PDF validado a {patient.name} en el EHR de
                  demostración.
                </Body>
                <Button
                  title="Confirmar envío al EHR simulado"
                  loading={action.busy}
                  onPress={() =>
                    action.run(async () => {
                      setDocument(
                        await api<ClinicalDocument>(
                          `/documents/${document.id}/ehr-submit`,
                          "POST",
                          { confirmed: true },
                        ),
                      );
                      setEhrConfirm(false);
                    })
                  }
                />
                <Button
                  title="Cancelar envío"
                  secondary
                  onPress={() => setEhrConfirm(false)}
                />
              </>
            ))}
        </Card>
      )}
      {Boolean(action.error) && <Notice error text={action.error} />}
    </Page>
  );
}
