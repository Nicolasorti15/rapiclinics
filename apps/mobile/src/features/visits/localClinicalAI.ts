import type { NoteItem } from "../../types";

export const localClinicalAIAvailable = false;

export type LocalClinicalProposal = {
  evolution: NoteItem[];
  tasks: NoteItem[];
  uncertainties: NoteItem[];
  suggested_evolution: string;
  redaction_method: string;
};

export class LocalClinicalAI {
  async warmUp(_onStatus: (text: string) => void = () => {}): Promise<void> {}

  async structure(
    _transcript: string,
    _onStatus: (text: string) => void = () => {},
  ): Promise<LocalClinicalProposal> {
    throw new Error("La IA clínica local requiere la app Android compilada.");
  }

  async dispose(): Promise<void> {}
}
