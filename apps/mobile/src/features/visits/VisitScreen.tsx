import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Platform, Text, View } from "react-native";
import { usePreventRemove, NavigationAction } from "@react-navigation/native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, appendFile } from "../../api/client";
import {
  Badge,
  Body,
  Button,
  Card,
  c,
  Field,
  Icon,
  Label,
  Loading,
  Notice,
  Page,
  PatientIdentity,
  s,
  Title,
} from "../../components/ui";
import type { Routes, Visit } from "../../types";
import { message, useAction } from "../core";
import { LocalWhisper, localWhisperAvailable } from "./localWhisper";
import { LocalClinicalAI, localClinicalAIAvailable } from "./localClinicalAI";

export function VisitScreen({
  route,
  navigation,
}: NativeStackScreenProps<Routes, "Visit">) {
  const action = useAction();
  const setError = action.setError;
  const visitId = useRef<string | null>(null);
  const creatingVisit = useRef<Promise<string> | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveLatest = useRef<(() => Promise<string>) | null>(null);
  const draftRevision = useRef(0);
  const [transcript, setTranscript] = useState("");
  const [step, setStep] = useState<"capture" | "review" | "done">("capture");
  const [evolution, setEvolution] = useState("");
  const [tasks, setTasks] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState("");
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const serverRecording = useAudioRecorderState(recorder);
  const [localMode, setLocalMode] = useState(localWhisperAvailable);
  const local = useRef<LocalWhisper | null>(null);
  const clinicalAI = useRef<LocalClinicalAI | null>(null);
  const [localRecording, setLocalRecording] = useState(false);
  const [localDuration, setLocalDuration] = useState(0);
  const [localStatus, setLocalStatus] = useState("");
  const localActive = useRef(false);
  const mounted = useRef(true);
  const recording = localMode
    ? { isRecording: localRecording, durationMillis: localDuration }
    : serverRecording;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void local.current?.dispose().catch(() => {});
      void clinicalAI.current?.dispose().catch(() => {});
    };
  }, []);
  const [interrupted, setInterrupted] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(route.params.visit_id));
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [exitAction, setExitAction] = useState<NavigationAction | null>(null);
  const [allowExit, setAllowExit] = useState(false);
  const dirtyDraft = Boolean(transcript.trim()) && !saved;
  const dirtyDraftRef = useRef(dirtyDraft);
  useEffect(() => {
    dirtyDraftRef.current = dirtyDraft;
  }, [dirtyDraft]);
  const markDirty = () => {
    draftRevision.current += 1;
    setSaved(false);
    setSaveState("pending");
    setSaveError("");
  };
  usePreventRemove(
    !allowExit &&
      step !== "done" &&
      (action.busy ||
        recording.isRecording ||
        audioReady ||
        (Boolean(transcript.trim()) && !saved)),
    ({ data }) => setExitAction(data.action),
  );
  useEffect(() => {
    if (allowExit && exitAction) navigation.dispatch(exitAction);
  }, [allowExit, exitAction, navigation]);
  const { visit_id: resumeId, scan_id: scanId } = route.params;
  useEffect(() => {
    if (!resumeId) return;
    let active = true;
    api<Visit>(`/visits/${resumeId}/resume`, "POST", { scan_id: scanId })
      .then((visit) => {
        if (!active) return;
        visitId.current = visit.id;
        setTranscript(visit.transcript);
        setOriginalTranscript(visit.original_transcript || "");
        setSuggestion(visit.note.suggested_evolution || "");
        if (visit.status === "REVIEW_REQUIRED") {
          setEvolution(
            visit.note.draft_evolution ??
              visit.note.evolution?.map((item) => item.text).join("\n") ??
              visit.transcript,
          );
          setTasks(
            (
              visit.note.draft_tasks ??
              visit.note.tasks?.map((item) => item.text) ??
              []
            ).join("\n"),
          );
          setStep("review");
        }
        setSaved(true);
        setSaveState("saved");
        setRestoring(false);
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setRestoreFailed(true);
          setRestoring(false);
        }
      });
    return () => {
      active = false;
    };
  }, [resumeId, scanId, setError, restoreAttempt]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active" && localActive.current) {
        localActive.current = false;
        void local.current
          ?.stop()
          .then(() => {
            if (!mounted.current) return;
            setLocalRecording(false);
            setAudioReady(true);
            setInterrupted(true);
          })
          .catch(() => setInterrupted(true));
      }
      if (state !== "active" && recorder.isRecording) {
        recorder
          .stop()
          .then(() => {
            setAudioReady(true);
            setInterrupted(true);
          })
          .catch(() => setInterrupted(true));
      }
      if (state !== "active" && dirtyDraftRef.current) {
        void saveLatest.current?.().catch(() => {});
      }
    });
    return () => listener.remove();
  }, [recorder]);
  const ensureVisit = useCallback(async () => {
    if (visitId.current) return visitId.current;
    creatingVisit.current ??= api<Visit>("/visits", "POST", {
      scan_id: route.params.scan_id,
    })
      .then((visit) => {
        visitId.current = visit.id;
        return visit.id;
      })
      .finally(() => {
        creatingVisit.current = null;
      });
    return creatingVisit.current;
  }, [route.params.scan_id]);
  const toggleRecord = () =>
    action.run(async () => {
      if (recording.isRecording) {
        if (localMode) {
          localActive.current = false;
          await local.current?.stop();
          setLocalRecording(false);
        } else await recorder.stop();
        setAudioReady(true);
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Activa el permiso del micrófono en los ajustes del teléfono o escribe la nota.",
        );
      await ensureVisit();
      if (localMode) {
        setAudioReady(false);
        setLocalDuration(0);
        setInterrupted(false);
        local.current ??= new LocalWhisper();
        try {
          await local.current.start(
            setLocalDuration,
            () => {
              localActive.current = false;
              setLocalRecording(false);
              setAudioReady(true);
            },
            setLocalStatus,
          );
          if (!mounted.current || AppState.currentState !== "active") {
            await local.current.stop();
            throw new Error("Mantén la app abierta para grabar.");
          }
          localActive.current = true;
          setLocalRecording(true);
        } finally {
          if (mounted.current) setLocalStatus("");
        }
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setAudioReady(false);
      setInterrupted(false);
    });
  const transcribe = () =>
    action.run(async () => {
      if (localMode) {
        if (!local.current) throw new Error("Graba un audio primero.");
        setLocalStatus("Transcribiendo en el teléfono…");
        try {
          const text = await local.current.transcribe();
          if (!mounted.current) return;
          setTranscript(text);
          setOriginalTranscript(text);
          markDirty();
        } finally {
          if (mounted.current) setLocalStatus("");
        }
        return;
      }
      if (!recorder.uri) throw new Error("Graba un audio primero.");
      const id = await ensureVisit();
      const form = new FormData();
      await appendFile(
        form,
        recorder.uri,
        Platform.OS === "web" ? "visita.webm" : "visita.m4a",
        Platform.OS === "web" ? "audio/webm" : "audio/mp4",
      );
      await api(`/visits/${id}/audio`, "POST", form);
      const result = await api<{ transcript: string }>(
        `/visits/${id}/transcribe`,
        "POST",
      );
      setTranscript(result.transcript);
      setOriginalTranscript(result.transcript);
      markDirty();
    });
  const saveDraft = useCallback(async () => {
    const revision = draftRevision.current;
    const snapshot = {
      transcript,
      ...(originalTranscript
        ? { original_transcript: originalTranscript }
        : {}),
      ...(step === "review"
        ? {
            evolution,
            tasks: tasks.split("\n").filter((item) => item.trim()),
          }
        : {}),
    };
    if (mounted.current) {
      setSaveState("saving");
      setSaveError("");
    }

    const perform = async () => {
      try {
        const id = await ensureVisit();
        await api(`/visits/${id}/draft`, "PATCH", snapshot);
        if (mounted.current && draftRevision.current === revision) {
          setSaved(true);
          setSaveState("saved");
          setAudioReady(false);
        }
        return id;
      } catch (error) {
        if (mounted.current) {
          setSaveState("error");
          setSaveError(message(error));
        }
        throw error;
      }
    };

    const result = saveQueue.current.then(perform, perform);
    saveQueue.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }, [ensureVisit, evolution, originalTranscript, step, tasks, transcript]);
  useEffect(() => {
    saveLatest.current = saveDraft;
  }, [saveDraft]);

  useEffect(() => {
    if (
      restoring ||
      saved ||
      !transcript.trim() ||
      recording.isRecording ||
      step === "done"
    )
      return;
    const timer = setTimeout(() => {
      void saveDraft().catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [recording.isRecording, restoring, saveDraft, saved, step, transcript]);
  const review = () =>
    action.run(async () => {
      const id = await saveDraft();

      let proposal: Visit;

      if (localClinicalAIAvailable) {
        const ai = clinicalAI.current ?? new LocalClinicalAI();
        clinicalAI.current = ai;

        try {
          if (mounted.current) {
            setLocalStatus("Preparando propuesta clínica en el teléfono…");
          }

          const localProposal = await ai.structure(transcript, (text) => {
            if (mounted.current) setLocalStatus(text);
          });

          proposal = await api<Visit>(`/visits/${id}/local-structure`, "POST", {
            evolution: localProposal.evolution.map(({ text, source_span }) => ({
              text,
              source_span,
            })),
            tasks: localProposal.tasks.map(({ text, source_span }) => ({
              text,
              source_span,
            })),
            uncertainties: localProposal.uncertainties.map(
              ({ text, source_span }) => ({ text, source_span }),
            ),
            suggested_evolution: localProposal.suggested_evolution,
            redaction_method: localProposal.redaction_method,
          });
        } finally {
          if (mounted.current) setLocalStatus("");
        }
      } else {
        proposal = await api<Visit>(`/visits/${id}/structure`, "POST");
      }

      if (!mounted.current) return;

      setEvolution(
        proposal.note.evolution?.map((item) => item.text).join("\n") ||
          transcript,
      );
      setTasks(proposal.note.tasks?.map((item) => item.text).join("\n") || "");
      setSuggestion(proposal.note.suggested_evolution || "");
      setStep("review");
    });
  const confirm = () =>
    action.run(async () => {
      await api(`/visits/${visitId.current}/confirm`, "POST", {
        reviewed: true,
        evolution,
        tasks: tasks.split("\n").filter((item) => item.trim()),
      });
      setConfirmingSave(false);
      setStep("done");
    });
  const discard = () =>
    action.run(async () => {
      if (visitId.current)
        await api(`/visits/${visitId.current}/discard`, "POST");
      setExitAction({ type: "GO_BACK" });
      setAllowExit(true);
    });
  if (restoring)
    return (
      <Page patient={route.params.patient}>
        <Loading />
      </Page>
    );
  if (step === "done")
    return (
      <Page patient={route.params.patient}>
        <View style={{ alignItems: "center", gap: 22, paddingVertical: 40 }}>
          <View
            style={{ backgroundColor: c.pale, borderRadius: 50, padding: 28 }}
          >
            <Icon name="check" size={44} />
          </View>
          <Title>Visita guardada</Title>
          <Body muted>
            La nota quedó confirmada y sus pendientes ya están disponibles.
          </Body>
        </View>
        <Button
          title="Volver al paciente"
          icon="arrow-left"
          onPress={() => navigation.goBack()}
        />
      </Page>
    );
  if (restoreFailed)
    return (
      <Page patient={route.params.patient}>
        <Title>No se pudo retomar la visita</Title>
        <Notice error text={action.error} />
        <Body muted>
          No se ha creado otra visita. Si la identificación venció, vuelve a
          confirmar al paciente antes de retomarlo.
        </Body>
        <Button
          title="Volver a intentar"
          onPress={() => {
            setRestoring(true);
            setRestoreFailed(false);
            setRestoreAttempt((value) => value + 1);
          }}
        />
        <Button
          title="Volver al paciente"
          secondary
          onPress={() => navigation.goBack()}
        />
      </Page>
    );
  return (
    <Page patient={route.params.patient}>
      <Label>
        {step === "capture" ? "REGISTRAR VISITA" : "REVISIÓN HUMANA"}
      </Label>
      <Title>
        {step === "capture"
          ? "Tu voz, con contexto."
          : "Revisa antes de guardar."}
      </Title>
      {step === "capture" ? (
        <>
          <Card style={{ alignItems: "center", paddingVertical: 28 }}>
            <View
              style={{
                backgroundColor: recording.isRecording ? "#FCEAEA" : c.pale,
                borderRadius: 40,
                padding: 21,
              }}
            >
              <Icon
                name="mic"
                color={recording.isRecording ? c.danger : c.teal}
                size={32}
              />
            </View>
            <Text
              style={{
                fontSize: 32,
                color: c.ink,
                fontVariant: ["tabular-nums"],
              }}
            >
              {String(Math.floor(recording.durationMillis / 60000)).padStart(
                2,
                "0",
              )}
              :
              {String(
                Math.floor(recording.durationMillis / 1000) % 60,
              ).padStart(2, "0")}
            </Text>
            <Text style={s.small}>
              {recording.isRecording
                ? "Grabando · Mantén la app abierta"
                : audioReady
                  ? "Audio listo para transcribir"
                  : "Graba o escribe tu visita"}
            </Text>
            <Button
              title={
                recording.isRecording ? "Detener grabación" : "Grabar visita"
              }
              icon={recording.isRecording ? "square" : "mic"}
              loading={action.busy}
              onPress={toggleRecord}
            />
            {Boolean(localStatus) && <Body muted>{localStatus}</Body>}
            {audioReady && !recording.isRecording && (
              <Button
                title={
                  localMode
                    ? "Transcribir en el teléfono"
                    : "Enviar audio y transcribir en servidor"
                }
                secondary
                loading={action.busy}
                onPress={transcribe}
              />
            )}
          </Card>
          <Notice
            text={
              localMode
                ? "Whisper base cuantizado se prepara mientras grabas, recorta silencios claros y conserva vocabulario clínico. La primera grabación descarga 60 MB; luego puedes dictar sin conexión hasta 3 minutos. La app rechazará audio demasiado bajo o saturado. Revisa siempre nombres, dosis, cifras y negaciones."
                : "Modo servidor: al pulsar transcribir se sube el audio. Dicta hasta 3 minutos y revisa siempre el resultado."
            }
          />
          {localWhisperAvailable && (
            <Button
              title={
                localMode
                  ? "Cambiar a grabación para servidor"
                  : "Cambiar a transcripción local"
              }
              secondary
              disabled={recording.isRecording || action.busy}
              onPress={() =>
                action.run(async () => {
                  await local.current?.dispose();
                  local.current = null;
                  setAudioReady(false);
                  setLocalMode(!localMode);
                  setLocalDuration(0);
                })
              }
            />
          )}
          {interrupted && (
            <Notice
              error
              text="La grabación se detuvo al salir de la app. Revisa el audio antes de continuar."
            />
          )}
          <Field
            label="Transcripción o nota escrita"
            placeholder="Escribe la evolución. Usa «Pendiente:» para separar una tarea."
            multiline
            value={transcript}
            editable={!recording.isRecording && !action.busy}
            onChangeText={(text) => {
              setTranscript(text);
              markDirty();
            }}
          />
          {Boolean(originalTranscript) && (
            <Card>
              <Label>TRANSCRIPCIÓN AUTOMÁTICA ORIGINAL</Label>
              <Body muted>{originalTranscript}</Body>
            </Card>
          )}
          {saveState !== "idle" && (
            <View style={{ gap: 10 }}>
              <Badge>
                {saveState === "saved"
                  ? "BORRADOR GUARDADO · RECUPERACIÓN ACTIVA"
                  : saveState === "error"
                    ? "AUTOGUARDADO PENDIENTE"
                    : "AUTOGUARDANDO…"}
              </Badge>
              {saveState === "error" && (
                <>
                  <Notice
                    error
                    text={`${saveError} Mantén esta pantalla abierta y vuelve a intentarlo.`}
                  />
                  <Button
                    title="Reintentar autoguardado"
                    secondary
                    onPress={() => void saveDraft().catch(() => {})}
                  />
                </>
              )}
            </View>
          )}
          <Button
            title="Preparar nota para revisión"
            icon="arrow-right"
            disabled={!transcript.trim() || recording.isRecording}
            loading={action.busy}
            onPress={review}
          />
        </>
      ) : (
        <>
          <Badge>PROPUESTA · PENDIENTE DE REVISIÓN</Badge>
          <Notice text="Comprueba medicamentos, dosis, números, fechas y negaciones. La propuesta local organiza frases, espacios y puntuación; no interpreta ni completa información clínica." />
          {Boolean(suggestion) && (
            <Card>
              <Label>PROPUESTA DE REDACCIÓN · OPCIONAL</Label>
              <Body>{suggestion}</Body>
              <Button
                title="Usar propuesta en la evolución"
                secondary
                disabled={action.busy}
                onPress={() => {
                  setEvolution(suggestion);
                  markDirty();
                }}
              />
            </Card>
          )}
          <Field
            label="Evolución revisada"
            multiline
            value={evolution}
            editable={!action.busy}
            onChangeText={(text) => {
              setEvolution(text);
              markDirty();
            }}
          />
          <Field
            label="Pendientes · uno por línea"
            multiline
            value={tasks}
            editable={!action.busy}
            onChangeText={(text) => {
              setTasks(text);
              markDirty();
            }}
          />
          <Card>
            <Label>TEXTO ORIGINAL</Label>
            <Body muted>{originalTranscript || transcript}</Body>
          </Card>
          <Button
            title="Revisar paciente y guardar"
            icon="check"
            loading={action.busy}
            disabled={!evolution.trim()}
            onPress={() => setConfirmingSave(true)}
          />
          {saveState !== "idle" && (
            <View style={{ gap: 10 }}>
              <Badge>
                {saveState === "saved"
                  ? "BORRADOR GUARDADO · RECUPERACIÓN ACTIVA"
                  : saveState === "error"
                    ? "AUTOGUARDADO PENDIENTE"
                    : "AUTOGUARDANDO…"}
              </Badge>
              {saveState === "error" && (
                <Button
                  title="Reintentar autoguardado"
                  secondary
                  onPress={() => void saveDraft().catch(() => {})}
                />
              )}
            </View>
          )}
          <Button
            title="Volver a editar transcripción"
            secondary
            disabled={action.busy}
            onPress={() =>
              action.run(async () => {
                await saveDraft();
                setStep("capture");
              })
            }
          />
        </>
      )}
      {Boolean(action.error) && <Notice error text={action.error} />}
      <Button
        title="Descartar visita"
        danger
        disabled={recording.isRecording || action.busy}
        onPress={discard}
      />
      <Modal
        transparent
        visible={Boolean(exitAction) && !allowExit}
        onRequestClose={() => setExitAction(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "#19343CAA",
          }}
        >
          <Card>
            <Text style={s.subtitle}>Tu visita sigue en curso</Text>
            <Body muted>
              {recording.isRecording
                ? "Detén la grabación antes de salir."
                : "El audio local no se guarda como borrador. Transcribe y guarda el texto antes de salir."}
            </Body>
            <Button
              title="Continuar editando"
              onPress={() => setExitAction(null)}
            />
            {!recording.isRecording &&
              !action.busy &&
              Boolean(transcript.trim()) && (
                <Button
                  title="Guardar y salir"
                  secondary
                  loading={action.busy}
                  onPress={() =>
                    action.run(async () => {
                      await saveDraft();
                      setAllowExit(true);
                    })
                  }
                />
              )}
            {Boolean(action.error) && <Notice error text={action.error} />}
          </Card>
        </View>
      </Modal>
      <Modal
        transparent
        visible={confirmingSave}
        onRequestClose={() => setConfirmingSave(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "#19343ACC",
          }}
        >
          <Card>
            <Label>CONFIRMACIÓN FINAL</Label>
            <Text style={s.subtitle}>
              ¿Guardar esta evolución en este paciente?
            </Text>
            <PatientIdentity patient={route.params.patient} />
            <Notice text="Comprueba nombre, documento, cama y servicio. Al confirmar, la evolución formará parte de esta historia clínica." />
            <Button
              title={`Guardar en ${route.params.patient.name}`}
              icon="check"
              loading={action.busy}
              disabled={!evolution.trim()}
              onPress={confirm}
            />
            <Button
              title="Volver a revisar"
              secondary
              disabled={action.busy}
              onPress={() => setConfirmingSave(false)}
            />
            {Boolean(action.error) && <Notice error text={action.error} />}
          </Card>
        </View>
      </Modal>
    </Page>
  );
}
