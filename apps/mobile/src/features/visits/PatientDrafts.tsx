import React from "react";
import { Text } from "react-native";
import { Badge, Body, Button, Card, Notice, s } from "../../components/ui";
import { useResource } from "../core";
import type { Visit } from "../../types";

export function PatientDrafts({
  patientId,
  onResume,
}: {
  patientId: string;
  onResume: (visitId: string) => void;
}) {
  const { data, error } = useResource<Visit[]>(`/patients/${patientId}/drafts`);
  if (error) return <Notice error text={error} />;
  if (!data?.length) return null;
  return (
    <Card>
      <Badge>RECUPERACIÓN ACTIVA</Badge>
      <Body muted>
        Tienes evoluciones sin confirmar. Puedes continuar donde las dejaste.
      </Body>
      {data.map((visit) => (
        <React.Fragment key={visit.id}>
          <Text style={s.small}>
            Iniciada {new Date(visit.created_at).toLocaleString("es-CO")} ·{" "}
            {visit.transcript.slice(0, 90) || "Evolución iniciada"}
          </Text>
          <Button
            title="Continuar evolución"
            icon="edit-3"
            onPress={() => onResume(visit.id)}
          />
        </React.Fragment>
      ))}
    </Card>
  );
}
