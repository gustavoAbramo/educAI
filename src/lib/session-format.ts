import type { SessionType } from "@/types/api";

const sessionTypeLabels: Record<SessionType, string> = {
  CLASS: "Aula",
  MENTORING: "Mentoria",
  MEETING: "Reunião",
  TRAINING: "Treinamento",
  WORKSHOP: "Workshop",
  CONSULTING: "Consultoria",
  SALES_CALL: "Reunião comercial",
  PRESENTATION: "Apresentação",
  OTHER: "Outra",
};

export function getSessionTypeLabel(type: SessionType) {
  return sessionTypeLabels[type] ?? type;
}

export function formatSessionDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatSessionMeta(type: SessionType, createdAt: string) {
  return `${getSessionTypeLabel(type)} · ${formatSessionDate(createdAt)}`;
}

export function formatSessionUpdatedLabel(updatedAt?: string) {
  if (!updatedAt) return "";
  const time = new Date(updatedAt).toLocaleString("pt-BR", { timeStyle: "short" });
  return `Atualizado ${time}`;
}