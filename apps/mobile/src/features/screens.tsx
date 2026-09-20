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
import { nfcAvailable, readBedToken, uidDemoEnabled } from "./nfc/reader";
import { isAdmin } from "./admin/AdminScreens";
import { PatientDrafts } from "./visits/PatientDrafts";
import { HomeBanner } from "./ads/HomeBanner";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  return (
    <Page safeTop>
      <View style={{ paddingTop: 26, paddingBottom: 12 }}>
        <Logo large />
      </View>
      <Badge>ACCESO DE LA CLÍNICA</Badge>
      <View style={{ gap: 12 }}>
        <Title>Más cerca del paciente.{"\n"}Todo en una ronda.</Title>
        <Body muted>
          Un espacio claro para registrar visitas y organizar el cuidado.
        </Body>
      </View>
      <Card>
        <Text style={s.subtitle}>
          {register ? "Crear cuenta de médico" : "Te damos la bienvenida"}
        </Text>
        {register && (
          <>
            <Field
              label="Código de invitación de tu clínica"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="Nombre completo"
              value={name}
              onChangeText={setName}
            />
          </>
        )}
        <Field
          label="Correo laboral"
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
        {register && (
          <>
            <Body muted>
              Mínimo 8 caracteres. No necesitas símbolos ni mayúsculas.
            </Body>
            <Field
              label="Repite tu contraseña"
              value={repeatPassword}
              onChangeText={setRepeatPassword}
              secureTextEntry
            />
          </>
        )}
        {Boolean(action.error) && <Notice error text={action.error} />}
        <Button
          title={register ? "Crear mi cuenta" : "Iniciar sesión"}
          icon="arrow-right"
          loading={action.busy}
          onPress={() =>
            action.run(async () => {
              if (register) {
                if (password.length < 8 || password !== repeatPassword)
                  throw new Error(
                    "Las contraseñas deben coincidir y tener al menos 8 caracteres.",
                  );
                await auth.register({ email, password, name, token });
              } else await auth.login(email, password);
            })
          }
        />
        <Button
          secondary
          title={register ? "Ya tengo cuenta" : "Tengo una invitación"}
          onPress={() => {
            setRegister(!register);
            action.setError("");
          }}
        />
        <Text style={s.small}>
          ¿Necesitas acceso o recuperar tu cuenta? Contacta al administrador de
          tu clínica.
        </Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 8 }}>
        <Icon name="shield" size={20} />
        <Text style={[s.small, { flex: 1 }]}>
          Cada cuenta accede solo a su clínica y servicio autorizado. La
          administración de usuarios depende de tu clínica.
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
        await api<Scan>(`/patients/${id}/identify`, "POST"),
      ),
    );
  const pending = tasks.data?.filter((task) => task.status === "OPEN");
  return (
    <Page safeTop footer={<BottomNav navigation={navigation} active="Home" />}>
      <View style={styles.between}>
        <Logo />
        <Badge>
          {session?.user.clinic_id === "demo"
            ? "DEMO"
            : session?.user.clinic_name || "CLÍNICA"}
        </Badge>
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
          {nfcAvailable
            ? "Acerca el teléfono a la etiqueta de la cama y confirma al paciente."
            : "Busca al paciente por su cédula y confirma su identidad."}
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
      {isAdmin(session?.user.role) && (
        <Button
          title="Administrar clínica"
          icon="settings"
          secondary
          onPress={() => navigation.navigate("Admin")}
        />
      )}
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
        <Text style={s.small}>Acceso por clínica · Identidad confirmada</Text>
      </View>
      <HomeBanner />
    </Page>
  );
}

export function PatientsScreen({ navigation }: Props<"Patients">) {
  const { session } = useAuth();
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
        <Label>{session?.user.clinic_name}</Label>
        <Title>Tus pacientes</Title>
        <Body muted>
          Busca por nombre o cédula y confirma la identidad antes de continuar.
        </Body>
      </View>
      {isAdmin(session?.user.role) && (
        <Button
          title="Registrar paciente"
          icon="user-plus"
          onPress={() => navigation.navigate("RegisterPatient")}
        />
      )}
      <Field
        label="Buscar en tu servicio"
        placeholder="Nombre, cama o cédula"
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
                  await api<Scan>(`/patients/${patient.id}/identify`, "POST"),
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
      {uidDemoEnabled && (
        <Notice text="Prueba NFC: la tarjeta 0FC401B6 identifica la cama ficticia 302-B. Acércala sin formatearla; no se escribe en ella. Las etiquetas NDEF siguen funcionando." />
      )}
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
        {nfcAvailable
          ? "Acerca la parte superior del teléfono a la etiqueta NFC de la cama."
          : "Busca al paciente por cédula. La lectura NFC requiere la app instalada en un teléfono compatible."}
      </Body>
      {Boolean(action.error) && <Notice error text={action.error} />}
      {nfcAvailable && (
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
      )}
      {action.busy && (
        <Button
          title="Cancelar lectura"
          secondary
          onPress={() => reading.current?.abort()}
        />
      )}
      <Card>
        <Text style={s.subtitle}>Identificación por cédula</Text>
        <Body muted>
          También puedes buscar al paciente en tu servicio y confirmar su
          documento de identidad.
        </Body>
        <Button
          title="Buscar paciente"
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
  const { session } = useAuth();
  const { patient } = route.params;
  return (
    <Page patient={patient}>
      <View style={{ gap: 8 }}>
        <Badge>IDENTIDAD CONFIRMADA</Badge>
        <Title>Una mirada a la visita</Title>
      </View>
      {isAdmin(session?.user.role) && (
        <Button
          title="Administrar etiqueta NFC"
          secondary
          icon="radio"
          onPress={() => navigation.navigate("LinkNfc", { patient })}
        />
      )}
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
      {session?.user.role !== "ADMIN" && (
        <>
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
        </>
      )}
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
      <Notice text="Toda propuesta requiere revisión del profesional antes de guardarse." />
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
          <Badge>
            {session?.user.clinic_id === "demo"
              ? "DEMO"
              : session?.user.clinic_name || "CLÍNICA"}
          </Badge>
        </View>
        <Text style={s.subtitle}>{session?.user.name}</Text>
        <Body muted>{session?.user.email}</Body>
        <Text style={s.small}>Rol: {session?.user.role}</Text>
      </Card>
      {isAdmin(session?.user.role) && (
        <Button
          title="Administración de la clínica"
          secondary
          icon="settings"
          onPress={() => navigation.navigate("Admin")}
        />
      )}
      <Card>
        <RowLink
          title="Privacidad y datos"
          detail="Acceso, almacenamiento y permisos"
          icon="shield"
          onPress={() => navigation.navigate("Privacy")}
        />
        <Text style={s.small}>
          RAPICLINICS · Versión 1.3.0{"\n"}
          {session?.user.clinic_name}
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
      <Title>Privacidad y uso{"\n"}de los datos</Title>
      <Card>
        <Text style={s.subtitle}>Publicidad</Text>
        <Body>
          En Android podemos mostrar un banner de Google AdMob en el inicio.
          Solicitamos anuncios no personalizados y no enviamos datos clínicos,
          cédulas, correos ni audios a la publicidad. Google puede tratar datos
          del dispositivo, la conexión y la interacción con el anuncio. Cuando
          corresponda, podrás gestionar el consentimiento desde las opciones de
          privacidad publicitaria del inicio.
        </Body>
        <Text style={s.subtitle}>Acceso de tu clínica</Text>
        <Body>
          La clínica administra el acceso a los pacientes de su institución. Las
          cuentas médicas se crean por invitación; solo ADMIN registra pacientes
          y vincula sus etiquetas NFC. Los entornos marcados DEMO admiten
          únicamente datos ficticios.
        </Body>
        <Text style={s.subtitle}>Qué se almacena</Text>
        <Body>
          El servidor de la clínica guarda las notas, los pendientes, los PDFs,
          el audio que decidas subir y un registro de acciones. La sesión se
          guarda en el almacenamiento seguro del teléfono.
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
          envío a un EHR externo necesita una integración contratada y
          configurada por la clínica. No se envía contenido a proveedores de IA
          externos.
        </Body>
        <Text style={s.subtitle}>Sin decisiones clínicas</Text>
        <Body>
          Esta versión no proporciona diagnóstico, tratamiento ni dosificación.
          Las propuestas solo se guardan tras una revisión explícita.
        </Body>
        <Text style={s.subtitle}>Gestión de cuentas</Text>
        <Body>
          El administrador invita a cada médico a su correo laboral y puede
          revocar su acceso. La clínica define la conservación de registros y
          atiende las solicitudes sobre los datos.
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
