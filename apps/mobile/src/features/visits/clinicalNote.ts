import type { NoteItem } from "../../types";

export const FAST_REDACTION_METHOD = "local-conservative-fast-v2";

export type FastClinicalProposal = {
  evolution: NoteItem[];
  tasks: NoteItem[];
  uncertainties: NoteItem[];
  suggested_evolution: string;
  redaction_method: string;
};

const taskStart =
  /^(?:pendiente|plan|solicitar|realizar|continuar|controlar|vigilar|revisar)\b/i;
const uncertainty =
  /\b(?:posible|probable|por confirmar|duda|dudoso|incierto|parece|no queda claro)\b/i;

function item(sourceSpan: string): NoteItem {
  return { text: sourceSpan, source_span: sourceSpan, requires_review: true };
}

export function conservativeRedaction(parts: string[]) {
  return parts
    .map((part) =>
      part
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(?:eh|em|mmm)[,;:]?\s*/i, ""),
    )
    .filter(Boolean)
    .map((part) => {
      const capitalized = part[0].toLocaleUpperCase("es") + part.slice(1);
      return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
    })
    .join(" ");
}

export function buildFastClinicalProposal(
  transcript: string,
): FastClinicalProposal {
  const parts = transcript
    .trim()
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const evolution: NoteItem[] = [];
  const tasks: NoteItem[] = [];
  const uncertainties: NoteItem[] = [];

  for (const part of parts) {
    const target = taskStart.test(part) ? tasks : evolution;
    target.push(item(part));
    if (uncertainty.test(part)) uncertainties.push(item(part));
  }

  const suggestedEvolution = conservativeRedaction(
    evolution.map((entry) => entry.source_span),
  );
  return {
    evolution,
    tasks,
    uncertainties,
    suggested_evolution: suggestedEvolution || conservativeRedaction(parts),
    redaction_method: FAST_REDACTION_METHOD,
  };
}

export function parseJsonObject(text: string): unknown {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const start = withoutThinking.indexOf("{");
  if (start < 0) throw new Error("JSON ausente.");
  let depth = 0;
  let quoted = false;
  let escaped = false;

  for (let index = start; index < withoutThinking.length; index += 1) {
    const character = withoutThinking[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0)
        return JSON.parse(withoutThinking.slice(start, index + 1));
    }
  }
  throw new Error("JSON incompleto.");
}

const allowedConnectors = new Set([
  "a",
  "al",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "los",
  "por",
  "se",
  "su",
  "y",
]);

function tokens(text: string) {
  return text.toLocaleLowerCase("es").match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function isGroundedRedaction(suggestion: string, transcript: string) {
  if (!suggestion.trim()) return false;
  const source = new Set(tokens(transcript));
  return tokens(suggestion).every(
    (token) => source.has(token) || allowedConnectors.has(token),
  );
}
