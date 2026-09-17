import React from "react";
import { Text } from "react-native";
import { Badge, Button, Card, Notice, s } from "../../components/ui";
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
      <Badge>BORRADORES POR COMPLETAR</Badge>
      {data.map((visit) => (
        <React.Fragment key={visit.id}>
          <Text style={s.small}>
            {new Date(visit.created_at).toLocaleString("es-CO")} ·{" "}
            {visit.transcript.slice(0, 90) || "Visita iniciada"}
          </Text>
          <Button
            title="Retomar borrador"
            secondary
            onPress={() => onResume(visit.id)}
          />
        </React.Fragment>
      ))}
    </Card>
  );
}
