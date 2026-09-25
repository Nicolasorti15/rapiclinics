export type Patient = {
  id: string;
  name: string;
  identifier: string;
  birth_date: string;
  sex: string;
  summary: string;
  allergies: string;
  encounter_id: string;
  service: string;
  bed: string;
  admission_at: string;
};
export type PatientLookup = {
  patient: Pick<
    Patient,
    | "id"
    | "name"
    | "identifier"
    | "birth_date"
    | "sex"
    | "summary"
    | "allergies"
  >;
  active: boolean;
  current: Patient | null;
  last_discharge_at: string | null;
};
export type User = {
  id: string;
  name: string;
  role: string;
  email: string;
  clinic_id: string;
  clinic_name: string;
  unit: string;
  active?: boolean;
};
export type Session = {
  access_token: string;
  refresh_token: string;
  user: User;
};
export type Scan = { scan_id: string; patient: Patient };
export type Task = {
  id: string;
  patient_id: string;
  patient_name: string;
  description: string;
  status: "OPEN" | "DONE" | "CANCELLED";
  urgent: boolean;
  due_at: string | null;
};
export type NoteItem = {
  text: string;
  source_span: string;
  requires_review: boolean;
};
export type Visit = {
  id: string;
  status: string;
  transcript: string;
  original_transcript?: string;
  created_at: string;
  note: {
    evolution?: NoteItem[];
    tasks?: NoteItem[];
    uncertainties?: NoteItem[];
    reviewed_evolution?: string;
    reviewed_tasks?: string[];
    draft_evolution?: string;
    draft_tasks?: string[];
    suggested_evolution?: string;
  };
};
export type ClinicalDocument = {
  id: string;
  filename: string;
  sha256: string;
  created_at: string;
  status: string;
  identity_status: "MATCH" | "MISMATCH" | "NO_IDENTIFIERS";
  document_type: string;
  ehr_status: string;
  extraction: { text: string; summary: string; identifiers: string[] };
};
export type ClinicalBrief = {
  generated_at: string;
  method: string;
  disclaimer: string;
  overview: string;
  key_points: {
    kind: "allergy" | "evolution" | "document";
    label: string;
    text: string;
    source_id: string;
    source_type: "patient" | "visit" | "document";
  }[];
  open_tasks: { id: string; text: string; due_at: string | null; urgent: boolean }[];
  lab_trends: {
    date: string;
    value: number;
    analyte: string;
    unit: string;
    report_id: string;
    filename: string;
    previous_date: string | null;
    previous_value: number | null;
    delta: number | null;
    direction: "aumentó" | "disminuyó" | "estable" | "sin comparación";
    count: number;
  }[];
};
export type Routes = {
  Admin: undefined;
  RegisterPatient: undefined;
  LinkNfc: { patient: Patient };
  Home: undefined;
  Patients: undefined;
  Tasks: undefined;
  PatientTasks: Scan;
  Settings: undefined;
  Privacy: undefined;
  Scan: undefined;
  Confirm: Scan;
  Patient: Scan;
  Visit: Scan & { visit_id?: string };
  Documents: Scan;
  Document: Scan & { document: ClinicalDocument };
  History: Scan;
  Labs: Scan;
};
