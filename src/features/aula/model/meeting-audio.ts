import type { MeetingAudioCaptureStatus } from "./types";

export function meetingAudioStatusLabel(status: MeetingAudioCaptureStatus) {
  if (status === "active") return "Audio da reuniao ativo";
  if (status === "pending") return "Aguardando aba/tela";
  if (status === "missing") return "Audio da reuniao ausente";
  if (status === "blocked") return "Captura da reuniao bloqueada";
  if (status === "unsupported") return "Navegador sem captura de aba";
  if (status === "stopped") return "Captura da reuniao encerrada";
  return "Captura da reuniao nao solicitada";
}

export function meetingAudioStatusTone(status: MeetingAudioCaptureStatus) {
  if (status === "active") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "pending" || status === "stopped") {
    return "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export function readableDisplayAudioError(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (name === "NotAllowedError" || name === "AbortError") {
    return "Audio da reuniao nao capturado: selecione a aba do Google Meet/Teams e marque compartilhar audio da aba.";
  }

  if (name === "NotFoundError") {
    return "Audio da reuniao nao capturado: nenhuma fonte compartilhavel com audio foi encontrada.";
  }

  return message
    ? `Audio da reuniao nao capturado: ${message}`
    : "Audio da reuniao nao capturado. O microfone continua sendo gravado.";
}
