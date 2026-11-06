import type { Session } from "@/types/api";
import type { LiveSpeaker } from "./types";

export function speakerNamesForSession(session: Session | null): LiveSpeaker[] {
  const participants =
    session?.participants
      ?.map((participant) => participant.name.trim())
      .filter((name) => name.length > 0) ?? [];
  const names = participants.length ? participants : ["Pessoa 1", "Pessoa 2"];
  const expanded = names.length === 1 ? [names[0], "Pessoa 2"] : names;

  return expanded.slice(0, 4).map((name, index) => ({
    id: `speaker_${index + 1}`,
    name,
  }));
}

export function explicitSpeakerIndex(text: string, speakers: LiveSpeaker[]) {
  const match = text.match(
    /^(?<label>pessoa\s*\d+|speaker\s*\d+|professor(?:a)?|teacher|aluno(?:a)?|student|participante\s*\d*)\s*[:,-]\s*/i,
  );
  if (!match?.groups?.label) return undefined;

  const label = match.groups.label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const numeric = label.match(/\d+/)?.[0];
  if (numeric) {
    const index = Number(numeric) - 1;
    return index >= 0 && index < speakers.length ? index : undefined;
  }

  if (label.includes("professor") || label.includes("teacher")) return 0;
  if (label.includes("aluno") || label.includes("student")) return Math.min(1, speakers.length - 1);
  return undefined;
}

export function removeExplicitSpeakerPrefix(text: string) {
  return text.replace(
    /^(pessoa\s*\d+|speaker\s*\d+|professor(?:a)?|teacher|aluno(?:a)?|student|participante\s*\d*)\s*[:,-]\s*/i,
    "",
  );
}

export function inferSpeakerRole(args: {
  sessionType?: string;
  speakerName: string;
  text: string;
  speakerIndex: number;
}) {
  const normalized = args.text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const sessionType = args.sessionType?.toUpperCase();

  if (sessionType === "CLASS" || sessionType === "TRAINING" || sessionType === "WORKSHOP") {
    return args.speakerIndex === 0 ? "Mentor provavel" : "Participante provavel";
  }
  if (sessionType === "SALES_CALL" || sessionType === "CONSULTING") {
    if (/\b(custo|preco|orcamento|proposta|contrato|crm|follow up|follow-up)\b/.test(normalized)) {
      return args.speakerIndex === 0 ? "Comercial provavel" : "Cliente provavel";
    }
    return args.speakerIndex === 0 ? "Condutor provavel" : "Stakeholder provavel";
  }
  if (
    /\?$/.test(args.text.trim()) ||
    /^(como|qual|quando|por que|porque|o que)\b/i.test(args.text.trim())
  ) {
    return "Pergunta forte";
  }
  if (
    /\b(vamos|seguinte|deixa eu|eu vou|eu quero mostrar|o ponto e|a ideia e)\b/.test(normalized)
  ) {
    return "Condutor provavel";
  }
  return args.speakerName || `Canal ${args.speakerIndex + 1}`;
}

export function speakerMapFromMetadata(metadata?: Record<string, unknown>) {
  const raw = metadata?.speakerMap;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const speakerMap = Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [
        key.trim().toLowerCase(),
        typeof value === "string" ? value.trim() : "",
      ])
      .filter(([key, value]) => /^speaker_\d+$/i.test(key) && value),
  );

  return Object.keys(speakerMap).length ? speakerMap : undefined;
}
