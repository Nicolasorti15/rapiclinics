import React from "react";
import { Text, View } from "react-native";
import {
  Body,
  Button,
  Card,
  Label,
  Loading,
  Notice,
  s,
} from "../../components/ui";
import type { ClinicalBrief } from "../../types";
import { useResource } from "../core";

export function ClinicalBriefCard({ patientId }: { patientId: string }) {
  const brief = useResource<ClinicalBrief>(
    `/patients/${patientId}/clinical-brief`,
  );

  return (
    <Card>
      <Label>IA DE SÍNTESIS · FUENTES CONFIRMADAS</Label>
      <Body muted>
        Reúne hechos confirmados, documentos validados, pendientes y cambios
        numéricos. Cada elemento conserva su fuente en la historia.
      </Body>
      {brief.loading && !brief.data ? (
        <Loading />
      ) : brief.error ? (
        <Notice error text={brief.error} />
      ) : brief.data ? (
        <>
          <Notice text={brief.data.disclaimer} />
          <Text style={s.subtitle}>{brief.data.overview}</Text>
          {brief.data.key_points.slice(0, 4).map((item) => (
            <View
              key={`${item.source_type}-${item.source_id}`}
              style={{ gap: 4 }}
            >
              <Text style={s.fieldLabel}>{item.label}</Text>
              <Body>{item.text}</Body>
            </View>
          ))}
          {brief.data.lab_trends.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={s.fieldLabel}>Últimos resultados confirmados</Text>
              {brief.data.lab_trends.slice(0, 5).map((item) => (
                <Body key={`${item.analyte}-${item.unit}`}>
                  {item.analyte}: {item.value} {item.unit} · {item.date}
                  {item.previous_value === null ? "" : ` · ${item.direction}`}
                </Body>
              ))}
            </View>
          )}
          {brief.data.open_tasks.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={s.fieldLabel}>Pendientes abiertos</Text>
              {brief.data.open_tasks.slice(0, 4).map((item) => (
                <Body key={item.id}>
                  • {item.urgent ? "URGENTE · " : ""}{item.text}
                </Body>
              ))}
            </View>
          )}
          <Text style={s.small}>
            Actualizado:{" "}
            {new Date(brief.data.generated_at).toLocaleString("es-CO")}
          </Text>
        </>
      ) : null}
      <Button
        title="Actualizar resumen"
        secondary
        loading={brief.loading}
        onPress={() => void brief.reload()}
      />
    </Card>
  );
}
