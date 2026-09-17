import React, { useState, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api } from "../api/client";
import {
  Badge,
  Body,
  Button,
  Card,
  c,
  Empty,
  Field,
  Icon,
  IconName,
  Label,
  Loading,
  Notice,
  Page,
  PatientIdentity,
  RowLink,
  s,
  Title,
} from "../components/ui";
import type { Patient, Routes, Scan, Task, Visit } from "../types";
import { useAction, useAuth, useResource } from "./core";
import { readBedToken } from "./nfc/reader";
import { PatientDrafts } from "./visits/PatientDrafts";

type Props<T extends keyof Routes> = NativeStackScreenProps<Routes, T>;

function Logo({ large = false }: { large?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={[
          styles.logo,
          large && { width: 52, height: 52, borderRadius: 17 },
        ]}
      >
        <Icon name="activity" color="white" size={large ? 30 : 23} />
      </View>
      <Text
        style={{
          color: c.ink,
          fontSize: large ? 22 : 17,
          fontWeight: "800",
          letterSpacing: 1.6,
        }}
      >
        RAPICLINICS
      </Text>
    </View>
  );
}

export function LoginScreen({ onPrivacy }: { onPrivacy: () => void }) {
  const auth = useAuth();
  const action = useAction();
  const [email, setEmail] = useState("demo@rapiclinics.app");
  const [password, setPassword] = useState("RapiDemo2026!");
  return (
    <Page safeTop>
      <View style={{ paddingTop: 26, paddingBottom: 12 }}>
        <Logo large />
      </View>
      <Badge>ENTORNO DE DEMOSTRACIÓN</Badge>
      <View style={{ gap: 12 }}>
        <Title>Más cerca del paciente.{"\n"}Todo en una ronda.</Title>
        <Body muted>
          Un espacio claro para registrar visitas y organizar el cuidado.
        </Body>
      </View>
      <Card>
        <Text style={s.subtitle}>Te damos la bienvenida</Text>
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />
        {Boolean(action.error) && <Notice error text={action.error} />}
        <Button
          title="Iniciar sesión"
          icon="arrow-right"
          loading={action.busy}
          onPress={() => action.run(() => auth.login(email, password))}
        />
        <Text style={s.small}>
          La cuenta de demostración está lista para explorar.
        </Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 8 }}>
        <Icon name="shield" size={20} />
        <Text style={[s.small, { flex: 1 }]}>
          Solo pacientes y documentos ficticios. Esta demo no ofrece
          diagnósticos ni recomendaciones médicas.
        </Text>
      </View>
      <Pressable
        onPress={onPrivacy}
        accessibilityRole="button"
        style={{ padding: 14 }}
      >
        <Text style={{ textAlign: "center", color: c.teal, fontSize: 14 }}>
          Privacidad y uso de datos
        </Text>
      </Pressable>
    </Page>
  );
}

function BottomNav({
  navigation,
  active,
}: {
  navigation: Pick<Props<"Home">["navigation"], "navigate">;
  active: string;
}) {
  const tabs: {
    name: "Home" | "Patients" | "Tasks" | "Settings";
    label: string;
    icon: IconName;
  }[] = [
    { name: "Home", label: "Inicio", icon: "grid" },
    { name: "Patients", label: "Pacientes", icon: "users" },
    { name: "Tasks", label: "Pendientes", icon: "check-square" },
    { name: "Settings", label: "Mi cuenta", icon: "user" },
  ];
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.name}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab.name }}
          onPress={() => navigation.navigate(tab.name)}
          style={styles.tab}
        >
          <Icon
            name={tab.icon}
            color={active === tab.name ? c.teal : c.muted}
          />
          <Text
            style={{
              fontSize: 11,
              color: active === tab.name ? c.teal : c.muted,
              fontWeight: active === tab.name ? "700" : "400",
            }}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function HomeScreen({ navigation }: Props<"Home">) {
  const { session } = useAuth();
  const patients = useResource<Patient[]>("/patients");
  const tasks = useResource<Task[]>("/tasks");
  const action = useAction();
  const open = (id: string) =>
    action.run(async () =>
      navigation.navigate(
        "Confirm",
        await api<Scan>(`/demo/patients/${id}/identify`, "POST"),
      ),
    );
  const pending = tasks.data?.filter((task) => task.status === "OPEN");
  return (
    <Page safeTop footer={<BottomNav navigation={navigation} active="Home" />}>
      <View style={styles.between}>
        <Logo />
        <Badge>DEMO</Badge>
      </View>
      <View style={{ gap: 8, marginTop: 8 }}>
        <Label>TU ESPACIO DE RONDA</Label>
        <Title>
          Hola, {session?.user.name.replace("Dra. ", "").split(" ")[0]}.
        </Title>
        <Body muted>Menos pasos. Más tiempo para cuidar.</Body>
      </View>
      <View style={styles.hero}>
        <View style={styles.between}>
          <View style={styles.heroIcon}>
            <Icon name="radio" color="white" size={27} />
          </View>
          <Text style={styles.heroLabel}>IDENTIFICACIÓN SEGURA</Text>
        </View>
        <Text style={styles.heroTitle}>
          Tu próxima visita{"\n"}empieza aquí.
        </Text>
        <Text style={styles.heroBody}>
          Acerca el teléfono a la etiqueta de la cama y confirma al paciente.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Scan")}
          style={styles.heroButton}
        >
          <Text style={{ color: c.teal, fontSize: 16, fontWeight: "700" }}>
            Iniciar ronda
          </Text>
          <Icon name="arrow-up-right" size={21} />
        </Pressable>
      </View>
      <View style={styles.stats}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Patients")}
          style={styles.stat}
        >
          <Text style={styles.statNumber}>{patients.data?.length ?? "—"}</Text>
          <Text style={s.small}>Pacientes asignados</Text>
        </Pressable>
        <View
          style={{ width: 1, backgroundColor: c.line, marginVertical: 16 }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Tasks")}
          style={styles.stat}
        >
          <Text style={styles.statNumber}>{pending?.length ?? "—"}</Text>
          <Text style={s.small}>Pendientes de ronda</Text>
        </Pressable>
      </View>
      <View style={styles.between}>
        <Text style={s.subtitle}>En tu servicio</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Patients")}
          style={{ padding: 10 }}
        >
          <Text style={{ color: c.teal, fontSize: 13, fontWeight: "600" }}>
            Ver todos
          </Text>
        </Pressable>
      </View>
      {Boolean(patients.error || tasks.error || action.error) && (
        <Notice error text={patients.error || tasks.error || action.error} />
      )}
      {patients.loading ? (
        <Loading />
      ) : (
        <Card style={{ paddingVertical: 6 }}>
          {patients.data?.slice(0, 3).map((patient, index) => (
            <Pressable
              key={patient.id}
              accessibilityRole="button"
              disabled={action.busy}
              onPress={() => open(patient.id)}
              style={[
                styles.patientRow,
                index > 0 && { borderTopWidth: 1, borderTopColor: c.line },
              ]}
            >
              <View style={styles.bed}>
                <Text
                  style={{ color: c.teal, fontSize: 12, fontWeight: "700" }}
                >
                  {patient.bed}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.subtitle}>{patient.name}</Text>
                <Text style={s.small}>{patient.service}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={c.muted} />
            </Pressable>
          ))}
        </Card>
      )}
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
        <Icon name="lock" size={13} color={c.muted} />
        <Text style={s.small}>Datos ficticios · Cuidado con intención</Text>
      </View>
    </Page>
  );
}

export function PatientsScreen({ navigation }: Props<"Patients">) {
  const { data, loading, error, reload } = useResource<Patient[]>("/patients");
  const action = useAction();
  const [query, setQuery] = useState("");
  const filtered = data?.filter((patient) =>
    `${patient.name} ${patient.bed} ${patient.identifier}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <Page footer={<BottomNav navigation={navigation} active="Patients" />}>
      <View style={{ gap: 8 }}>
        <Label>MEDICINA INTERNA</Label>
        <Title>Tus pacientes</Title>
        <Body muted>
          Selecciona una cama de demostración y confirma la identidad antes de
          continuar.
        </Body>
      </View>
      <Field
        label="Buscar en tu servicio"
        placeholder="Nombre, cama o identificador"
        value={query}
        onChangeText={setQuery}
      />
      {Boolean(error || action.error) && (
        <>
          <Notice error text={error || action.error} />
          <Button title="Volver a cargar" secondary onPress={reload} />
        </>
      )}
      {loading ? (
        <Loading />
      ) : filtered?.length ? (
        filtered.map((patient) => (
          <Pressable
            key={patient.id}
            accessibilityRole="button"
            disabled={action.busy}
            onPress={() =>
              action.run(async () =>
                navigation.navigate(
                  "Confirm",
                  await api<Scan>(
                    `/demo/patients/${patient.id}/identify`,
                    "POST",
                  ),
                ),
              )
            }
          >
            <PatientIdentity patient={patient} />
          </Pressable>
        ))
      ) : (
        <Empty
          title="Sin resultados"
          text="Prueba con otro nombre o número de cama."
        />
      )}
    </Page>
  );
}

export function ScanScreen({ navigation }: Props<"Scan">) {
  const action = useAction();
  const reading = useRef<AbortController | null>(null);
  useFocusEffect(useCallback(() => () => reading.current?.abort(), []));
  return (
    <Page>
      <Label>PASO 1 DE 2 · IDENTIFICAR</Label>
      <Title>Conecta con{"\n"}la siguiente visita.</Title>
      <View style={styles.scanVisual}>
        <View style={styles.scanRing}>
          <View style={styles.scanInner}>
            <Icon name="smartphone" size={60} />
            <View style={{ position: "absolute", right: 24, top: 36 }}>
              <Icon name="wifi" size={30} />
            </View>
          </View>
        </View>
      </View>
      <Body muted>
        Acerca la parte superior del teléfono a la etiqueta NFC de la cama.
      </Body>
      {Boolean(action.error) && <Notice error text={action.error} />}
      <Button
        title="Leer etiqueta NFC"
        icon="radio"
        loading={action.busy}
        onPress={() =>
          action.run(async () => {
            const controller = new AbortController();
            reading.current = controller;
            const token = await readBedToken(controller.signal);
            if (controller.signal.aborted) return;
            const scan = await api<Scan>("/nfc/resolve", "POST", { token });
            if (controller.signal.aborted) return;
            navigation.navigate("Confirm", scan);
          })
        }
      />
      {action.busy && (
        <Button
          title="Cancelar lectura"
          secondary
          onPress={() => reading.current?.abort()}
        />
      )}
      <Card>
        <Text style={s.subtitle}>Explora sin una etiqueta</Text>
        <Body muted>
          En esta demo puedes seleccionar una cama para recorrer el mismo flujo
          de confirmación.
        </Body>
        <Button
          title="Elegir cama de demostración"
          secondary
          icon="grid"
          onPress={() => navigation.navigate("Patients")}
        />
      </Card>
    </Page>
  );
}

export function ConfirmScreen({ route, navigation }: Props<"Confirm">) {
  const { patient, scan_id } = route.params;
  const action = useAction();
  return (
    <Page>
      <Label>PASO 2 DE 2 · CONFIRMAR</Label>
      <Title>La persona correcta,{"\n"}antes de continuar.</Title>
      <Body muted>
        Verifica estos datos con la identificación del paciente.
      </Body>
      <Card style={{ alignItems: "center", paddingVertical: 32 }}>
        <View
          style={{ padding: 24, backgroundColor: c.pale, borderRadius: 50 }}
        >
          <Icon name="user" size={42} />
        </View>
        <Badge>CAMA {patient.bed}</Badge>
        <Text style={[s.title, { textAlign: "center", fontSize: 26 }]}>
          {patient.name}
        </Text>
        <Text style={[s.subtitle, { letterSpacing: 1 }]}>
          {patient.identifier}
        </Text>
        <Text style={s.small}>
          Nacimiento: {patient.birth_date} · {patient.sex}
        </Text>
        <Text style={s.small}>{patient.service}</Text>
      </Card>
      {Boolean(action.error) && <Notice error text={action.error} />}
      <Button
        title="Confirmar paciente"
        icon="check"
        loading={action.busy}
        onPress={() =>
          action.run(async () => {
            await api(`/nfc/scans/${scan_id}/confirm`, "POST", {
              confirmed_patient_id: patient.id,
            });
            navigation.replace("Patient", route.params);
          })
        }
      />
      <Button
        title="No corresponde · Volver"
        secondary
        onPress={() => navigation.goBack()}
      />
    </Page>
  );
}

export function PatientScreen({ route, navigation }: Props<"Patient">) {
  const { patient } = route.params;
  return (
    <Page patient={patient}>
      <View style={{ gap: 8 }}>
        <Badge>IDENTIDAD CONFIRMADA</Badge>
        <Title>Una mirada a la visita</Title>
      </View>
      <Card>
        <Label>RESUMEN DEL PACIENTE</Label>
        <Body>{patient.summary}</Body>
        <View
          style={{
            borderTopWidth: 1,
            borderColor: c.line,
            paddingTop: 15,
            gap: 5,
          }}
        >
          <Text style={s.fieldLabel}>Alergias</Text>
          <Body muted>{patient.allergies}</Body>
        </View>
      </Card>
      <PatientDrafts
        patientId={patient.id}
        onResume={(visit_id) =>
          navigation.navigate("Visit", { ...route.params, visit_id })
        }
      />
      <Button
        title="Registrar visita"
        icon="mic"
        onPress={() => navigation.navigate("Visit", route.params)}
      />
      <Card style={{ paddingVertical: 6 }}>
        <RowLink
          title="Documentos"
          detail="Importar y revisar archivos PDF"
          icon="file-text"
          onPress={() => navigation.navigate("Documents", route.params)}
        />
        <View style={{ height: 1, backgroundColor: c.line }} />
        <RowLink
          title="Resultados y gráficas"
          detail="Importa estudios y explora su evolución"
          icon="activity"
          onPress={() => navigation.navigate("Labs", route.params)}
        />
        <View style={{ height: 1, backgroundColor: c.line }} />
        <RowLink
          title="Historial de visitas"
          detail="Notas revisadas y confirmadas"
          icon="clock"
          onPress={() => navigation.navigate("History", route.params)}
        />
        <View style={{ height: 1, backgroundColor: c.line }} />
        <RowLink
          title="Pendientes del paciente"
          detail="Organiza el siguiente paso"
          icon="check-square"
          onPress={() => navigation.navigate("PatientTasks", route.params)}
        />
      </Card>
      <Notice text="La información de esta demo es ficticia. Toda propuesta requiere revisión antes de guardarse." />
    </Page>
  );
}

export function TasksScreen({ navigation }: Props<"Tasks">) {
  return (
    <TaskList footer={<BottomNav navigation={navigation} active="Tasks" />} />
  );
}

export function PatientTasksScreen({ route }: Props<"PatientTasks">) {
  return <TaskList patient={route.params.patient} />;
}

function TaskList({
  patient,
  footer,
}: {
  patient?: Patient;
  footer?: React.ReactNode;
}) {
  const { data, loading, error, reload } = useResource<Task[]>(
    patient ? `/tasks?patient_id=${encodeURIComponent(patient.id)}` : "/tasks",
  );
  const action = useAction();
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState("");
  const items = data?.filter(
    (task) =>
      task.status === (showDone ? "DONE" : "OPEN") &&
      `${task.description} ${task.patient_name}`
        .toLocaleLowerCase("es")
        .includes(search.trim().toLocaleLowerCase("es")),
  );
  return (
    <Page patient={patient} footer={footer}>
      <Label>EL SIGUIENTE PASO</Label>
      <Title>Pendientes</Title>
      <Field
        label="Buscar pendientes"
        placeholder={patient ? "Busca una tarea" : "Busca una tarea o paciente"}
        value={search}
        onChangeText={setSearch}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          title="Por completar"
          secondary={showDone}
          onPress={() => setShowDone(false)}
        />
        <Button
          title="Completados"
          secondary={!showDone}
          onPress={() => setShowDone(true)}
        />
      </View>
      {Boolean(error || action.error) && (
        <Notice error text={error || action.error} />
      )}
      {Boolean(error) && (
        <Button
          title="Volver a intentar"
          secondary
          onPress={() => void reload()}
        />
      )}
      {loading ? (
        <Loading />
      ) : error ? null : !items?.length ? (
        <Empty
          title={
            search.trim()
              ? "Sin coincidencias"
              : showDone
                ? "Aún no hay completados"
                : "Todo al día"
          }
          text={
            search.trim()
              ? "Prueba con otro nombre o palabra."
              : "Los pendientes aparecen después de confirmar una visita."
          }
        />
      ) : (
        <>
          <Label>SIN FECHA ASIGNADA</Label>
          {items.map((task) => (
            <Card key={task.id}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${showDone ? "Reabrir" : "Completar"}: ${task.description}`}
                  accessibilityState={{
                    checked: task.status === "DONE",
                    disabled: action.busy,
                  }}
                  disabled={action.busy}
                  style={{
                    minWidth: 48,
                    minHeight: 48,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  onPress={() =>
                    action.run(async () => {
                      await api(`/tasks/${task.id}`, "PATCH", {
                        status: showDone ? "OPEN" : "DONE",
                      });
                      await reload();
                    })
                  }
                >
                  <Icon name={showDone ? "check-square" : "square"} size={26} />
                </Pressable>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.subtitle}>{task.description}</Text>
                  <Text style={s.small}>{task.patient_name}</Text>
                </View>
              </View>
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}

export function HistoryScreen({ route }: Props<"History">) {
  const { data, loading, error } = useResource<Visit[]>(
    `/patients/${route.params.patient.id}/timeline`,
  );
  return (
    <Page patient={route.params.patient}>
      <Title>Historial de visitas</Title>
      {Boolean(error) && <Notice error text={error} />}
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty
          title="La primera visita está por llegar"
          text="Las notas confirmadas aparecerán aquí, con su fecha de registro."
        />
      ) : (
        data.map((visit) => (
          <Card key={visit.id}>
            <Badge>NOTA CONFIRMADA</Badge>
            <Text style={s.small}>
              {new Date(visit.created_at).toLocaleString("es-CO")}
            </Text>
            <Body>{visit.note.reviewed_evolution}</Body>
            {visit.note.reviewed_tasks?.map((task, index) => (
              <Text key={index} style={s.small}>
                • {task}
              </Text>
            ))}
          </Card>
        ))
      )}
    </Page>
  );
}

export function SettingsScreen({ navigation }: Props<"Settings">) {
  const { session, logout } = useAuth();
  const action = useAction();
  return (
    <Page footer={<BottomNav navigation={navigation} active="Settings" />}>
      <Title>Tu cuenta</Title>
      <Card>
        <View style={styles.between}>
          <View style={s.avatar}>
            <Icon name="user" />
          </View>
          <Badge>DEMO</Badge>
        </View>
        <Text style={s.subtitle}>{session?.user.name}</Text>
        <Body muted>{session?.user.email}</Body>
        <Text style={s.small}>Rol: {session?.user.role}</Text>
      </Card>
      <Card>
        <RowLink
          title="Privacidad y datos"
          detail="Cómo funciona esta demostración"
          icon="shield"
          onPress={() => navigation.navigate("Privacy")}
        />
        <Text style={s.small}>
          RAPICLINICS · Versión 1.0.0{"\n"}Pacientes ficticios · EHR simulado
        </Text>
      </Card>
      {Boolean(action.error) && <Notice error text={action.error} />}
      <Button
        title="Cerrar sesión"
        secondary
        icon="log-out"
        loading={action.busy}
        onPress={() => action.run(logout)}
      />
    </Page>
  );
}

export function PrivacyScreen() {
  return (
    <Page>
      <Label>TRANSPARENCIA</Label>
      <Title>Privacidad y uso{"\n"}de la demo</Title>
      <Card>
        <Text style={s.subtitle}>Solo información ficticia</Text>
        <Body>
          RAPICLINICS demuestra un flujo de rondas hospitalarias. No introduzcas
          nombres, historias clínicas, grabaciones ni documentos de pacientes
          reales.
        </Body>
        <Text style={s.subtitle}>Qué se almacena</Text>
        <Body>
          El servidor de la demo guarda las notas, los pendientes, los PDFs, el
          audio que decidas subir y un registro de acciones. La sesión se guarda
          en el almacenamiento seguro del teléfono.
        </Body>
        <Text style={s.subtitle}>Permisos bajo tu control</Text>
        <Body>
          El micrófono se solicita al pulsar grabar. NFC se activa al iniciar
          una lectura. Los documentos se eligen con el selector del sistema. No
          se solicita acceso a contactos, ubicación ni biblioteca de fotos.
        </Body>
        <Text style={s.subtitle}>Procesamiento del audio</Text>
        <Body>
          El audio se transcribe en el servidor con un modelo local. Conservamos
          la transcripción original y una propuesta revisable de redacción. El
          envío a historia clínica es simulado. No se envía contenido a
          proveedores de IA externos.
        </Body>
        <Text style={s.subtitle}>Sin decisiones clínicas</Text>
        <Body>
          Esta versión no proporciona diagnóstico, tratamiento ni dosificación.
          Las propuestas solo se guardan tras una revisión explícita.
        </Body>
        <Text style={s.subtitle}>Cuenta de demostración</Text>
        <Body>
          No se crean cuentas personales desde la app. El administrador del
          entorno gestiona las cuentas, la conservación y la eliminación de los
          datos sintéticos.
        </Body>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 35,
    height: 35,
    backgroundColor: c.teal,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  hero: { backgroundColor: "#176B70", borderRadius: 24, padding: 25, gap: 19 },
  heroIcon: {
    width: 46,
    height: 46,
    backgroundColor: "#358087",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#D9EFE9",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: c.white,
    fontSize: 29,
    fontWeight: "600",
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroBody: { fontSize: 15, color: "#E0F0ED", lineHeight: 24, maxWidth: 320 },
  heroButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: c.white,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  stats: {
    flexDirection: "row",
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 18,
  },
  stat: { flex: 1, padding: 20, gap: 4 },
  statNumber: { fontSize: 28, fontWeight: "600", color: c.ink },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 19,
  },
  bed: {
    paddingHorizontal: 9,
    paddingVertical: 12,
    backgroundColor: c.pale,
    borderRadius: 11,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: c.white,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingVertical: 9,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    minHeight: 52,
  },
  scanVisual: { alignItems: "center", justifyContent: "center", padding: 15 },
  scanRing: {
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: "#CADFDB",
    backgroundColor: "#EDF5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  scanInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#DDEDE7",
    alignItems: "center",
    justifyContent: "center",
  },
});
