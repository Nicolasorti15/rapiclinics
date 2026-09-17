import React, { useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { api, appendFile } from "../../api/client";
import {
  Badge,
  Body,
  Button,
  Card,
  c,
  Empty,
  Field,
  Label,
  Loading,
  Notice,
  Page,
  Title,
} from "../../components/ui";
import { useAction, useResource } from "../core";
import type { Routes } from "../../types";
import { previewPdf } from "../documents/files";
import { PdfPreview } from "../documents/PdfPreview";

type Row = {
  date: string;
  analyte: string;
  value: string | number;
  unit: string;
};
type Report = {
  id: string;
  filename: string;
  content_type: string;
  status: string;
  identity_status: string;
  rows: Row[];
  extracted_text: string;
};
type Point = Row & { value: number; file: string; reportId: string };
const key = (row: Row) =>
  `${row.analyte.trim().toLocaleLowerCase("es")} · ${row.unit.trim()}`;

export function LabsScreen({ route }: NativeStackScreenProps<Routes, "Labs">) {
  const { patient, scan_id } = route.params;
  const path = `/patients/${patient.id}/labs`;
  const { data, loading, error, reload } = useResource<Report[]>(path);
  const action = useAction();
  const [review, setReview] = useState<Report | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [confirmedIdentity, setConfirmedIdentity] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [selected, setSelected] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [point, setPoint] = useState<Point | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const openOriginal = (id: string) =>
    action.run(async () => {
      const url = await previewPdf(id, "labs");
      if (url) setPreviewUrl(url);
    });
  const points = useMemo(
    () =>
      (data || [])
        .filter((r) => r.status === "CONFIRMED")
        .flatMap((r) =>
          r.rows.map((row) => ({
            ...row,
            value: Number(row.value),
            file: r.filename,
            reportId: r.id,
          })),
        ),
    [data],
  );
  const variables = [...new Set(points.map(key))].sort();
  const current = variables.includes(selected) ? selected : variables[0];
  const datesValid =
    [from, to].every(
      (d) =>
        !d ||
        (/^\d{4}-\d{2}-\d{2}$/.test(d) &&
          Number.isFinite(Date.parse(d)) &&
          new Date(d).toISOString().slice(0, 10) === d),
    ) &&
    (!from || !to || from <= to);
  const series = points
    .filter(
      (p) =>
        key(p) === current &&
        datesValid &&
        (!from || p.date >= from) &&
        (!to || p.date <= to),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const choose = () =>
    action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv", "text/comma-separated-values"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      if (result.assets.length > 10)
        throw new Error("Selecciona hasta 10 informes por lote.");
      const messages: string[] = [];
      for (const file of result.assets) {
        try {
          if (file.size && file.size > 10 * 1024 * 1024)
            throw new Error("Máximo 10 MB por archivo.");
          const form = new FormData();
          form.append("scan_id", scan_id);
          await appendFile(
            form,
            file.uri,
            file.name,
            file.name.toLowerCase().endsWith(".csv")
              ? "text/csv"
              : "application/pdf",
          );
          await api(path, "POST", form);
          messages.push(`${file.name}: listo para revisar`);
        } catch (e) {
          messages.push(
            `${file.name}: ${e instanceof Error ? e.message : "No se pudo importar"}`,
          );
        } finally {
          if (Platform.OS !== "web")
            await FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(
              () => undefined,
            );
        }
      }
      setBatchMessage(messages.join("\n"));
      await reload();
    });
  const begin = (report: Report) => {
    setReview(report);
    setRows(report.rows.map((r) => ({ ...r })));
    setConfirmedIdentity(false);
    action.setError("");
  };
  const change = (index: number, field: keyof Row, value: string) =>
    setRows((previous) =>
      previous.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  if (review)
    return (
      <Page patient={patient}>
        <PdfPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
        <Title>Revisar resultados</Title>
        <Body>{review.filename}</Body>
        {review.content_type === "application/pdf" && (
          <Button
            secondary
            title="Abrir PDF original"
            onPress={() => openOriginal(review.id)}
            loading={action.busy}
          />
        )}
        <Notice text="Comprueba el informe original: identidad, fecha de la muestra, variable, valor y unidad. Las gráficas solo incluyen resultados confirmados." />
        <Card>
          <Label>TEXTO EXTRAÍDO DEL INFORME</Label>
          <Body>{review.extracted_text.slice(0, 20000)}</Body>
        </Card>
        {review.identity_status === "MISMATCH" ? (
          <Notice
            error
            text="El informe contiene otro identificador de paciente. No se puede confirmar."
          />
        ) : (
          <Button
            secondary
            title={
              confirmedIdentity
                ? "Identidad y valores revisados ✓"
                : "He comprobado la identidad y los valores"
            }
            onPress={() => setConfirmedIdentity((v) => !v)}
          />
        )}
        {rows.map((row, i) => (
          <Card key={i}>
            <Label>RESULTADO {i + 1}</Label>
            <Field
              label={`Variable ${i + 1}`}
              value={row.analyte || ""}
              onChangeText={(v) => change(i, "analyte", v)}
            />
            <Field
              label={`Fecha ${i + 1} · AAAA-MM-DD`}
              value={row.date || ""}
              onChangeText={(v) => change(i, "date", v)}
            />
            <Field
              label={`Valor ${i + 1}`}
              value={String(row.value ?? "")}
              keyboardType="decimal-pad"
              onChangeText={(v) => change(i, "value", v)}
            />
            <Field
              label={`Unidad ${i + 1}`}
              value={row.unit || ""}
              onChangeText={(v) => change(i, "unit", v)}
            />
            <Button
              secondary
              title={`Quitar fila ${i + 1}`}
              onPress={() => setRows((old) => old.filter((_, j) => j !== i))}
            />
          </Card>
        ))}
        <Button
          secondary
          title="Añadir valor del informe"
          disabled={rows.length >= 100}
          onPress={() =>
            setRows((old) => [
              ...old,
              { date: "", analyte: "", value: "", unit: "" },
            ])
          }
        />
        {Boolean(action.error) && <Notice error text={action.error} />}
        <Button
          title="Confirmar e incorporar a las gráficas"
          disabled={
            !confirmedIdentity ||
            !rows.length ||
            review.identity_status === "MISMATCH"
          }
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              const parsed = rows.map((r) => ({
                ...r,
                value: Number(String(r.value).replace(",", ".")),
              }));
              if (
                rows.some((r) => !String(r.value).trim()) ||
                parsed.some((r) => !Number.isFinite(r.value))
              )
                throw new Error(
                  "Revisa los valores numéricos; no se aceptan valores vacíos ni intervalos.",
                );
              await api(`/labs/${review.id}/confirm`, "POST", {
                scan_id,
                reviewed: true,
                identity_manually_checked: confirmedIdentity,
                rows: parsed,
              });
              setReview(null);
              setPoint(null);
              await reload();
            })
          }
        />
        <Button
          secondary
          title="Volver sin confirmar"
          disabled={action.busy}
          onPress={() => setReview(null)}
        />
      </Page>
    );
  return (
    <Page patient={patient}>
      <PdfPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
      <Label>EVOLUCIÓN DE RESULTADOS</Label>
      <Title>Laboratorio</Title>
      <Body muted>
        Explora cada variable en el tiempo. Las unidades se mantienen separadas;
        las líneas no son predicciones.
      </Body>
      <Button
        title="Subir varios resultados"
        icon="upload"
        loading={action.busy}
        onPress={choose}
      />
      <Body muted>
        PDF con texto o CSV · Hasta 10 archivos · Sin OCR de imágenes
      </Body>
      {Boolean(batchMessage) && <Notice text={batchMessage} />}
      {Boolean(error || action.error) && (
        <Notice error text={error || action.error} />
      )}
      {loading ? (
        <Loading />
      ) : (
        <>
          {(data || [])
            .filter((r) => r.status === "REVIEW_REQUIRED")
            .map((r) => (
              <Card key={r.id}>
                <Badge>PENDIENTE DE REVISIÓN</Badge>
                <Body>{r.filename}</Body>
                <Button
                  title="Revisar informe"
                  secondary
                  onPress={() => begin(r)}
                />
              </Card>
            ))}
          {!variables.length ? (
            <Empty
              title="Tus gráficas empiezan aquí"
              text="Importa y confirma resultados de varias fechas para ver su evolución."
            />
          ) : (
            <>
              <Label>VARIABLE Y UNIDAD</Label>
              <View style={{ gap: 8 }}>
                {variables.map((v) => (
                  <Button
                    key={v}
                    title={v}
                    secondary={v !== current}
                    onPress={() => {
                      setSelected(v);
                      setPoint(null);
                    }}
                  />
                ))}
              </View>
              <Field
                label="Desde · AAAA-MM-DD (opcional)"
                value={from}
                onChangeText={(v) => {
                  setFrom(v);
                  setPoint(null);
                }}
              />
              <Field
                label="Hasta · AAAA-MM-DD (opcional)"
                value={to}
                onChangeText={(v) => {
                  setTo(v);
                  setPoint(null);
                }}
              />
              {!datesValid && (
                <Notice
                  error
                  text="Usa fechas AAAA-MM-DD y un intervalo válido."
                />
              )}
              <Trend points={series} onSelect={setPoint} />
              {point && (
                <Card>
                  <Label>RESULTADO SELECCIONADO</Label>
                  <Body>
                    {point.date} · {point.value} {point.unit}
                  </Body>
                  <Body muted>{point.file}</Body>
                  {data?.find((r) => r.id === point.reportId)?.content_type ===
                    "application/pdf" && (
                    <Button
                      secondary
                      title="Abrir informe original"
                      onPress={() => openOriginal(point.reportId)}
                      loading={action.busy}
                    />
                  )}
                </Card>
              )}
              <Label>DATOS DE LA GRÁFICA · {series.length} RESULTADOS</Label>
              {series.map((p, i) => (
                <Button
                  key={`${p.reportId}-${i}`}
                  secondary
                  title={`${p.date} · ${p.value} ${p.unit}`}
                  onPress={() => setPoint(p)}
                />
              ))}
              {!series.length && (
                <Body muted>No hay resultados para este filtro.</Body>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}

function Trend({
  points,
  onSelect,
}: {
  points: Point[];
  onSelect: (p: Point) => void;
}) {
  if (!points.length) return null;
  const min = Math.min(...points.map((p) => p.value)),
    max = Math.max(...points.map((p) => p.value));
  const pad = (max - min) * 0.12 || Math.max(Math.abs(max) * 0.1, 1);
  const low = Math.max(0, min - pad),
    high = max + pad;
  const start = Date.parse(points[0].date),
    end = Date.parse(points[points.length - 1].date);
  const x = (p: Point) =>
    end === start
      ? 180
      : 48 + ((Date.parse(p.date) - start) / (end - start)) * 276;
  const y = (p: Point) => 190 - ((p.value - low) / (high - low)) * 155;
  return (
    <Card>
      <Label>
        {points[0].analyte} · {points[0].unit}
      </Label>
      <Svg
        width="100%"
        height={245}
        viewBox="0 0 360 245"
        accessibilityLabel="Evolución temporal. Los valores también están disponibles debajo de la gráfica."
      >
        {[0, 0.5, 1].map((f) => (
          <React.Fragment key={f}>
            <Line
              x1={48}
              x2={324}
              y1={190 - f * 155}
              y2={190 - f * 155}
              stroke={c.line}
            />
            <SvgText
              x={42}
              y={194 - f * 155}
              fontSize={10}
              textAnchor="end"
              fill={c.ink}
            >
              {(low + f * (high - low)).toFixed(1)}
            </SvgText>
          </React.Fragment>
        ))}
        <Polyline
          points={points.map((p) => `${x(p)},${y(p)}`).join(" ")}
          fill="none"
          stroke={c.teal}
          strokeWidth={2}
        />
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={x(p)}
            cy={y(p)}
            r={8}
            fill={c.teal}
            onPress={() => onSelect(p)}
          />
        ))}
        <SvgText x={48} y={218} fontSize={10} fill={c.ink}>
          {points[0].date}
        </SvgText>
        <SvgText x={324} y={236} textAnchor="end" fontSize={10} fill={c.ink}>
          {points[points.length - 1].date}
        </SvgText>
      </Svg>
      <Text style={{ color: c.muted, fontSize: 14 }}>
        Toca un punto o una fila para consultar su informe.
      </Text>
    </Card>
  );
}
