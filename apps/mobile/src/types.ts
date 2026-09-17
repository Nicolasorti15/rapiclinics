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
export type User = { id: string; name: string; role: string; email: string };
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
export type Routes = {
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
