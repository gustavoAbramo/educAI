import type {
  FasterWhisperConnectionStatus,
  GenerationProviderMode,
  ProviderCapabilityRuntime,
  ProviderCatalogItem,
  ProviderRuntimeCheck,
  ProviderRuntimeHealthEnvelope,
  TranscriptionProviderMode,
} from "@/lib/voice-intelligence";
import type { BrowserCaptureSupport, ApiEnvelope } from "./defaults";

export function safeLocalStorageGet(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

export function providerLabel(
  items: ProviderCatalogItem[],
  provider: TranscriptionProviderMode | GenerationProviderMode,
) {
  return items.find((item) => item.id === provider)?.label ?? provider;
}

export function providerOptionSuffix(item: ProviderCatalogItem) {
  if (item.selectable) return "";
  if (item.availability === "development_only") return " (somente desenvolvimento)";
  if (item.availability === "coming_soon") return " (planejado)";
  return " (indisponivel)";
}

export async function readApiJson<T>(response: Response) {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || "Falha ao carregar configuracoes.");
  }
  return payload.data;
}

export function runtimeStatusLabel(
  status: "ready" | "unreachable" | "model_missing" | "mock_mode" | "misconfigured",
) {
  if (status === "ready") return "Conectado e modelo disponivel";
  if (status === "mock_mode") return "Conectado, mas em modo simulado";
  if (status === "misconfigured") return "Conectado, mas incompleto";
  if (status === "model_missing") return "Conectado, mas modelo ausente";
  return "Nao conectado";
}

export function runtimeStatusTone(
  status: "ready" | "unreachable" | "model_missing" | "mock_mode" | "misconfigured",
) {
  if (status === "ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "mock_mode") {
    return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  if (status === "misconfigured") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (status === "model_missing") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function checkTone(status: ProviderRuntimeCheck["status"]) {
  if (status === "pass") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "warn") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-destructive/25 bg-destructive/10 text-destructive";
}

export function appSettingsStatusTone(status: "ready" | "attention" | "blocked" | "unknown") {
  if (status === "ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "attention") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (status === "blocked") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  return "border-border bg-background text-muted-foreground";
}

export function appSettingsStatusLabel(status: "ready" | "attention" | "blocked" | "unknown") {
  if (status === "ready") return "Pronto";
  if (status === "attention") return "Atencao";
  if (status === "blocked") return "Bloqueado";
  return "Nao configurado";
}

export function browserCaptureStatus(support: BrowserCaptureSupport) {
  if (!support.secureContext || !support.getUserMedia || !support.mediaRecorder) return "blocked";
  if (!support.getDisplayMedia) return "attention";
  return "ready";
}

export function browserCaptureStatusDetail(support: BrowserCaptureSupport) {
  if (!support.secureContext) {
    return "Captura de midia exige contexto seguro. Use localhost ou HTTPS.";
  }
  if (!support.getUserMedia || !support.mediaRecorder) {
    return "Este navegador nao tem APIs suficientes para gravar microfone.";
  }
  if (!support.getDisplayMedia) {
    return "Microfone funciona, mas captura da aba/reuniao nao esta disponivel aqui.";
  }
  return "Navegador pronto para microfone e captura de aba/tela com audio.";
}

export function fasterWhisperToastLabel(status: FasterWhisperConnectionStatus["status"]) {
  if (status === "ready") return "Faster-Whisper conectado";
  if (status === "mock_mode") return "Worker conectado em modo simulado";
  if (status === "misconfigured") return "Worker conectado, mas falta configurar o comando real";
  if (status === "model_missing") return "Worker respondeu, mas o modelo nao foi encontrado";
  return "Status do Faster-Whisper atualizado";
}

export function fasterWhisperShortLabel(status: FasterWhisperConnectionStatus["status"]) {
  if (status === "ready") return "Worker pronto";
  if (status === "mock_mode") return "Worker em modo simulado";
  if (status === "misconfigured") return "Worker incompleto";
  if (status === "model_missing") return "Worker responde, modelo ausente";
  return "Sem conexao validada";
}

export function fasterWhisperSmokeCheck(status: FasterWhisperConnectionStatus) {
  return status.checks.find((item) => item.id === "smoke_transcription");
}

export function capabilityStatusLabel(status: ProviderCapabilityRuntime["status"]) {
  if (status === "ready") return "Pronto";
  if (status === "limited") return "Parcial";
  if (status === "development_only") return "Desenvolvimento";
  return "Bloqueado";
}

export function capabilityStatusTone(status: ProviderCapabilityRuntime["status"]) {
  if (status === "ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "limited") {
    return "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  if (status === "development_only") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function capabilityProviderLabel(provider: string) {
  if (provider === "faster-whisper") return "Faster-Whisper";
  if (provider === "ollama") return "Ollama";
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  if (provider === "mock") return "Simulado";
  return provider;
}

export function offlineStatusLabel(
  status: ProviderRuntimeHealthEnvelope["offlineReadiness"]["status"],
) {
  if (status === "ready") return "Offline pronto";
  if (status === "partial") return "Offline parcial";
  return "Offline bloqueado";
}

export function offlineStatusTone(
  status: ProviderRuntimeHealthEnvelope["offlineReadiness"]["status"],
) {
  if (status === "ready") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "partial") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function setupStepLabel(
  status: ProviderRuntimeHealthEnvelope["setupGuide"][number]["status"],
) {
  if (status === "done") return "Feito";
  if (status === "todo") return "Pendente";
  return "Bloqueado";
}

export function setupStepTone(
  status: ProviderRuntimeHealthEnvelope["setupGuide"][number]["status"],
) {
  if (status === "done") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "todo") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function localStackSummary(health: ProviderRuntimeHealthEnvelope) {
  const parts = [
    health.localProviders.ollama.status === "ready"
      ? "Ollama pronto"
      : health.localProviders.ollama.status === "model_missing"
        ? "Ollama sem o modelo ativo"
        : "Ollama indisponivel",
    health.localProviders.fasterWhisper.status === "ready"
      ? "Faster-Whisper pronto"
      : health.localProviders.fasterWhisper.status === "mock_mode"
        ? "Faster-Whisper em modo simulado"
        : health.localProviders.fasterWhisper.status === "misconfigured"
          ? "Faster-Whisper incompleto"
          : health.localProviders.fasterWhisper.status === "model_missing"
            ? "Faster-Whisper sem o modelo ativo"
            : "Faster-Whisper indisponivel",
  ];

  return parts.join(" - ");
}
