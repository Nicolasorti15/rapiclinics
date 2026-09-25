import React, { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, ApiError } from "../../api/client";
import {
  Badge,
  Body,
  Button,
  Card,
  Field,
  Label,
  Loading,
  Notice,
  Page,
  PatientIdentity,
  Title,
  s,
} from "../../components/ui";
import type { Patient, PatientLookup, Routes, User } from "../../types";
import { useAction, useAuth, useResource } from "../core";
import { nfcAvailable, readBedToken } from "../nfc/reader";
import { writePatientToken } from "../nfc/writer";
import { BirthDatePicker } from "./BirthDatePicker";
import { formatBirthDate, isValidBirthDate } from "./birthDate";

export const isAdmin = (role?: string) =>
  role === "ADMIN" || role === "SYSTEM_ADMIN";
type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;

export function AdminScreen({ navigation }: Props<"Admin">) {
  const { session } = useAuth();
  const action = useAction();
  const users = useResource<User[]>("/admin/users");
  const [email, setEmail] = useState("");
  const [unit, setUnit] = useState("Medicina interna");
  const [invitation, setInvitation] = useState<{
    token: string;
    email: string;
    expires_at: string;
  } | null>(null);
  const [deactivate, setDeactivate] = useState<string | null>(null);
  if (!isAdmin(session?.user.role))
    return (
      <Page>
        <Notice error text="Solo ADMIN puede administrar la clínica." />
      </Page>
    );
  return (
    <Page>
      <Badge>ADMINISTRACIÓN</Badge>
      <Title>{session?.user.clinic_name}</Title>
      <Body muted>
        Gestiona el equipo y el ingreso de pacientes de tu clínica.
      </Body>
      <Button
        title="Registrar paciente"
        icon="user-plus"
        onPress={() => navigation.navigate("RegisterPatient")}
      />
      <Card>
        <Text style={s.subtitle}>Invitar a un médico</Text>
        <Body muted>
          El médico define su contraseña al aceptar la invitación. El permiso
          será de médico, nunca de administrador.
        </Body>
        <Field
          label="Correo laboral del médico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field
          label="Servicio autorizado"
          value={unit}
          onChangeText={setUnit}
        />
        <Button
          title="Crear invitación"
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              setInvitation(
                await api("/admin/invitations", "POST", { email, unit }),
              );
            })
          }
        />
        {invitation && (
          <View style={{ gap: 8 }}>
            <Label>INVITACIÓN CREADA</Label>
            <Body>
              Comparte este código únicamente con {invitation.email} por un
              canal laboral de confianza. No se envía un correo automáticamente.
            </Body>
            <Text selectable style={s.subtitle}>
              {invitation.token}
            </Text>
            <Text style={s.small}>
              Caduca: {new Date(invitation.expires_at).toLocaleString("es-CO")}.
              Un solo uso.
            </Text>
          </View>
        )}
      </Card>
      <Title>Equipo de la clínica</Title>
      {users.loading && <Loading />}
      {users.data?.map((user) => (
        <Card key={user.id}>
          <Text style={s.subtitle}>{user.name}</Text>
          <Body muted>{user.email}</Body>
          <Text style={s.small}>
            {user.role} · {user.unit} · {user.active ? "Activo" : "Desactivado"}
          </Text>
          {user.role === "PHYSICIAN" &&
            user.active &&
            (deactivate === user.id ? (
              <>
                <Notice text="Se cerrarán sus sesiones y perderá el acceso. Sus registros clínicos se conservarán." />
                <Button
                  title="Confirmar desactivación"
                  danger
                  loading={action.busy}
                  onPress={() =>
                    action.run(async () => {
                      await api(`/admin/users/${user.id}/deactivate`, "POST");
                      setDeactivate(null);
                      await users.reload();
                    })
                  }
                />
                <Button
                  title="Cancelar"
                  secondary
                  onPress={() => setDeactivate(null)}
                />
              </>
            ) : (
              <Button
                title="Desactivar acceso"
                secondary
                onPress={() => setDeactivate(user.id)}
              />
            ))}
        </Card>
      ))}
      {Boolean(action.error || users.error) && (
        <Notice error text={action.error || users.error} />
      )}
    </Page>
  );
}

export function RegisterPatientScreen({
  navigation,
}: Props<"RegisterPatient">) {
  const { session } = useAuth();
  const action = useAction();
  const [form, setForm] = useState({
    name: "",
    identifier: "",
    birth_date: "",
    sex: "ND",
    service: "Medicina interna",
    bed_code: "",
    summary: "",
    allergies: "Sin información registrada",
  });
  const [lookupComplete, setLookupComplete] = useState(false);
  const [existing, setExisting] = useState<PatientLookup | null>(null);
  const [review, setReview] = useState(false);
  const set = (key: keyof typeof form, value: string) => {
    setForm({ ...form, [key]: value });
    setReview(false);
  };
  const setIdentifier = (value: string) => {
    setForm({ ...form, identifier: value.replace(/\D/g, "") });
    setExisting(null);
    setLookupComplete(false);
    setReview(false);
  };
  const lookup = () =>
    action.run(async () => {
      if (!/^\d{3,15}$/.test(form.identifier))
        throw new Error("Introduce una cédula válida, sin puntos.");
      try {
        const result = await api<PatientLookup>(
          `/admin/patients/by-identifier/${encodeURIComponent(form.identifier)}`,
        );
        setExisting(result);
        setLookupComplete(true);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setExisting(null);
          setLookupComplete(true);
          action.setError("");
          return;
        }
        throw error;
      }
    });
  if (!isAdmin(session?.user.role))
    return (
      <Page>
        <Notice error text="Solo ADMIN puede registrar pacientes." />
      </Page>
    );
  return (
    <Page>
      <Label>INGRESO DE PACIENTE</Label>
      <Title>Identificación y ubicación</Title>
      <Body muted>
        Busca primero la cédula. Si el paciente ya estuvo en la clínica, solo
        tendrás que asignar el nuevo servicio y la cama.
      </Body>
      <Card>
        <Field
          label="Cédula de ciudadanía · sin puntos"
          value={form.identifier}
          onChangeText={setIdentifier}
          keyboardType="number-pad"
          maxLength={15}
        />
        <Button
          title="Buscar cédula"
          icon="search"
          loading={action.busy}
          onPress={lookup}
        />
      </Card>
      {action.error && <Notice error text={action.error} />}
      {existing?.active && existing.current && (
        <Card>
          <Badge>INGRESO ACTIVO</Badge>
          <PatientIdentity patient={existing.current} />
          <Notice text="Este paciente ya está hospitalizado. No se creó otro ingreso ni se modificó su historia." />
        </Card>
      )}
      {existing && !existing.active && (
        <Card>
          <Badge>PACIENTE ENCONTRADO</Badge>
          <Text style={s.subtitle}>{existing.patient.name}</Text>
          <Body>
            CC {existing.patient.identifier} ·{" "}
            {formatBirthDate(existing.patient.birth_date)}
          </Body>
          {existing.last_discharge_at && (
            <Body muted>
              Última alta:{" "}
              {new Date(existing.last_discharge_at).toLocaleString("es-CO")}
            </Body>
          )}
          <Notice text="Se conservarán sus evoluciones, documentos, resultados y antecedentes. Este paso crea un nuevo ingreso." />
          <Field
            label="Nuevo servicio"
            value={form.service}
            onChangeText={(v) => set("service", v)}
          />
          <Field
            label="Nueva cama o ubicación"
            value={form.bed_code}
            onChangeText={(v) => set("bed_code", v)}
          />
          <Button
            title="Confirmar nuevo ingreso"
            icon="log-in"
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                if (!form.service.trim() || !form.bed_code.trim())
                  throw new Error("Completa el servicio y la cama.");
                const patient = await api<Patient>(
                  `/admin/patients/${existing.patient.id}/admit`,
                  "POST",
                  { service: form.service, bed_code: form.bed_code },
                );
                navigation.replace("LinkNfc", { patient });
              })
            }
          />
        </Card>
      )}
      {lookupComplete && !existing && (
        <Notice text="La cédula no está registrada en esta clínica. Completa los datos para crear el paciente y su primer ingreso." />
      )}
      {lookupComplete && !existing && (
        <Card>
          <Field
            label="Nombre completo"
            value={form.name}
            onChangeText={(v) => set("name", v)}
          />
          <BirthDatePicker
            value={form.birth_date}
            onChange={(value) => set("birth_date", value)}
          />
          <Label>SEXO REGISTRADO</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {["F", "M", "X", "ND"].map((value) => (
              <Button
                key={value}
                title={value === "ND" ? "Sin dato" : value}
                secondary={form.sex !== value}
                onPress={() => set("sex", value)}
              />
            ))}
          </View>
          <Field
            label="Servicio"
            value={form.service}
            onChangeText={(v) => set("service", v)}
          />
          <Field
            label="Cama o ubicación"
            value={form.bed_code}
            onChangeText={(v) => set("bed_code", v)}
          />
          <Field
            label="Alergias documentadas"
            value={form.allergies}
            onChangeText={(v) => set("allergies", v)}
          />
        </Card>
      )}
      {lookupComplete && !existing && review ? (
        <Card>
          <Text style={s.subtitle}>{form.name}</Text>
          <Body>
            CC {form.identifier} · {formatBirthDate(form.birth_date)}
          </Body>
          <Body>
            {form.service} · Cama {form.bed_code}
          </Body>
          <Button
            title="Confirmar y guardar paciente"
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                const patient = await api<Patient>(
                  "/admin/patients",
                  "POST",
                  form,
                );
                navigation.replace("LinkNfc", { patient });
              })
            }
          />
          <Button
            title="Corregir datos"
            secondary
            onPress={() => setReview(false)}
          />
        </Card>
      ) : lookupComplete && !existing ? (
        <Button
          title="Revisar datos"
          onPress={() =>
            action.run(async () => {
              if (
                form.name.trim().length < 3 ||
                !/^\d{3,15}$/.test(form.identifier) ||
                !isValidBirthDate(form.birth_date) ||
                !form.bed_code.trim()
              )
                throw new Error(
                  "Completa nombre, cédula, fecha y cama antes de continuar.",
                );
              setReview(true);
            })
          }
        />
      ) : null}
    </Page>
  );
}

export function LinkNfcScreen({ route }: Props<"LinkNfc">) {
  const { session } = useAuth();
  const { patient } = route.params;
  const action = useAction();
  const controller = useRef<AbortController | null>(null);
  const [pending, setPending] = useState<{ token: string } | null>(null);
  const [written, setWritten] = useState(false);
  const [done, setDone] = useState(false);
  const [revoke, setRevoke] = useState(false);
  useFocusEffect(useCallback(() => () => controller.current?.abort(), []));
  if (!isAdmin(session?.user.role))
    return (
      <Page>
        <Notice error text="Solo ADMIN puede vincular etiquetas NFC." />
      </Page>
    );
  const base = `/admin/patients/${patient.id}/nfc`;
  return (
    <Page>
      <Badge>REGISTRO GUARDADO</Badge>
      <Title>Vincular NFC al paciente</Title>
      <PatientIdentity patient={patient} />
      <Body muted>
        Usa una etiqueta NDEF vacía. Solo guardaremos un código aleatorio: la
        cédula y la historia permanecen en el servidor.
      </Body>
      {!nfcAvailable && (
        <Notice text="Abre esta pantalla en la app instalada en un teléfono con NFC para escribir la etiqueta." />
      )}
      {done ? (
        <Notice text="Etiqueta vinculada. Los médicos autorizados ya pueden identificar al paciente por NFC." />
      ) : (
        <>
          <Button
            title={
              written
                ? "Volver a escribir etiqueta"
                : "1. Escribir etiqueta vacía"
            }
            disabled={!nfcAvailable}
            loading={action.busy}
            onPress={() =>
              action.run(async () => {
                controller.current = new AbortController();
                const prepared =
                  pending ??
                  (await api<{ token: string }>(`${base}/prepare`, "POST"));
                if (controller.current.signal.aborted) return;
                setPending(prepared);
                await writePatientToken(
                  prepared.token,
                  controller.current.signal,
                );
                setWritten(true);
              })
            }
          />
          {written && (
            <Card>
              <Body>
                Retira la etiqueta. Pulsa verificar y vuelve a acercarla para
                comprobar la escritura. Al activarla se revocará la etiqueta
                anterior del paciente.
              </Body>
              <Button
                title="2. Leer y activar vínculo"
                loading={action.busy}
                onPress={() =>
                  action.run(async () => {
                    controller.current = new AbortController();
                    const token = await readBedToken(controller.current.signal);
                    if (controller.current.signal.aborted) return;
                    if (token !== pending?.token)
                      throw new Error(
                        "La etiqueta leída no corresponde a esta escritura. Vuelve a acercar la etiqueta correcta.",
                      );
                    await api(`${base}/activate`, "POST", { token });
                    setDone(true);
                    setPending(null);
                  })
                }
              />
            </Card>
          )}
        </>
      )}
      {action.busy && (
        <Button
          title="Cancelar lectura o escritura"
          secondary
          onPress={() => controller.current?.abort()}
        />
      )}
      {action.error && <Notice error text={action.error} />}
      <Card>
        <Text style={s.subtitle}>Etiqueta perdida o retirada</Text>
        {revoke ? (
          <>
            <Notice text="Las etiquetas actuales dejarán de identificar a este paciente. Su historia se conserva." />
            <Button
              title="Confirmar revocación NFC"
              danger
              loading={action.busy}
              onPress={() =>
                action.run(async () => {
                  await api(`${base}/revoke`, "POST");
                  setRevoke(false);
                  setDone(false);
                  setWritten(false);
                  setPending(null);
                })
              }
            />
            <Button
              title="Cancelar"
              secondary
              onPress={() => setRevoke(false)}
            />
          </>
        ) : (
          <Button
            title="Revocar etiquetas del paciente"
            secondary
            onPress={() => setRevoke(true)}
          />
        )}
      </Card>
    </Page>
  );
}
