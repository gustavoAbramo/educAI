import type {
  AssistantWebSearchMode,
  GenerationProviderMode,
  ProviderCatalogItem,
  ProviderRuntimeSettings,
  ProviderRuntimeSettingsEnvelope,
  ProviderRuntimeSettingsPatch,
  TranscriptionProviderMode,
} from "@/lib/voice-intelligence";
import { normalizeLocalProviderBaseUrl } from "./provider-endpoint";
import { serverEnv } from "./runtime-env";
import { getConfiguredSecret } from "./settings-secrets";

type PersistedProviderSettings = {
  version: 1;
  savedAt: string;
  settings: ProviderRuntimeSettingsPatch;
};

type RuntimeGlobal = typeof globalThis & {
  process?: {
    cwd?: () => string;
    env?: Record<string, string | undefined>;
  };
};

let cachedSettings: ProviderRuntimeSettingsPatch = {};
let cachedUpdatedAt: string | undefined;
let loadPromise: Promise<void> | undefined;
let savePromise: Promise<void> = Promise.resolve();

async function loadNodeFileSystem() {
  try {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    return { fs, path };
  } catch {
    return null;
  }
}

function now() {
  return new Date().toISOString();
}

function hasOpenAIKey() {
  return Boolean(getConfiguredSecret("OPENAI_API_KEY")?.trim());
}

function hasGeminiKey() {
  return Boolean(getConfiguredSecret("GEMINI_API_KEY")?.trim());
}

export function simulatedProvidersEnabled() {
  const value = serverEnv("EDUCAI_ENABLE_SIMULATED_PROVIDERS")?.trim().toLowerCase();
  if (value === "1" || value === "true" || value === "yes" || value === "on") {
    return true;
  }

  return serverEnv("NODE_ENV") === "test";
}

export function providerDiagnosticsEnabled() {
  const value = serverEnv("EDUCAI_DEBUG_PROVIDERS")?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function getSettingsPath(path: typeof import("node:path")) {
  const runtime = globalThis as RuntimeGlobal;
  const cwd = runtime.process?.cwd?.();
  if (!cwd) return undefined;

  return (
    runtime.process?.env?.EDUCAI_PROVIDER_SETTINGS_PATH ??
    path.join(cwd, ".data", "provider-settings.json")
  );
}

function isTranscriptionProviderMode(value: unknown): value is TranscriptionProviderMode {
  return value === "mock" || value === "openai" || value === "gemini" || value === "faster-whisper";
}

function isGenerationProviderMode(value: unknown): value is GenerationProviderMode {
  return value === "mock" || value === "openai" || value === "gemini" || value === "ollama";
}

function isAssistantWebSearchMode(value: unknown): value is AssistantWebSearchMode {
  return value === "auto" || value === "on" || value === "off";
}

function normalizeProviderUrl(value: string | undefined, fallback: string, label: string) {
  return normalizeLocalProviderBaseUrl(value?.trim() || fallback, label);
}

function normalizeModel(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function normalizeConfiguredModel(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} model is required.`);
  }
  if (trimmed.length > 200) {
    throw new Error(`${label} model must be 200 characters or fewer.`);
  }
  return trimmed;
}

function tryNormalizePersistedUrl(value: string, label: string) {
  try {
    return normalizeLocalProviderBaseUrl(value, label);
  } catch (error) {
    console.warn(
      `[educAI] ignored invalid persisted ${label} URL: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return undefined;
  }
}

function envTranscriptionProvider(): TranscriptionProviderMode | undefined {
  const value = serverEnv("EDUCAI_TRANSCRIPTION_PROVIDER")?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "mock" || value === "simulated") return "mock";
  if (value === "openai" || value === "real") return "openai";
  if (value === "gemini") return "gemini";
  if (value === "faster-whisper" || value === "faster_whisper" || value === "local") {
    return "faster-whisper";
  }
  throw new Error(
    `Invalid EDUCAI_TRANSCRIPTION_PROVIDER value "${value}". Use "mock", "openai", "gemini", or "faster-whisper".`,
  );
}

function envGenerationProvider(): GenerationProviderMode | undefined {
  const value = serverEnv("EDUCAI_AI_PROVIDER")?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "mock" || value === "simulated") return "mock";
  if (value === "openai" || value === "real") return "openai";
  if (value === "gemini") return "gemini";
  if (value === "ollama" || value === "local") return "ollama";
  throw new Error(
    `Invalid EDUCAI_AI_PROVIDER value "${value}". Use "mock", "openai", "gemini", or "ollama".`,
  );
}

function envAssistantWebSearchMode(): AssistantWebSearchMode | undefined {
  const value = serverEnv("EDUCAI_ASSISTANT_WEB_SEARCH")?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "auto" || value === "on" || value === "off") return value;
  if (value === "true" || value === "enabled") return "on";
  if (value === "false" || value === "disabled") return "off";
  throw new Error(
    `Invalid EDUCAI_ASSISTANT_WEB_SEARCH value "${value}". Use "auto", "on", or "off".`,
  );
}

function autoTranscriptionProvider(): TranscriptionProviderMode {
  if (hasOpenAIKey()) return "openai";
  if (hasGeminiKey()) return "gemini";
  return "faster-whisper";
}

function autoGenerationProvider(): GenerationProviderMode {
  if (hasOpenAIKey()) return "openai";
  if (hasGeminiKey()) return "gemini";
  return "ollama";
}

function snapshotSettings(): ProviderRuntimeSettings {
  return {
    transcriptionProvider:
      envTranscriptionProvider() ??
      cachedSettings.transcriptionProvider ??
      autoTranscriptionProvider(),
    generationProvider:
      envGenerationProvider() ?? cachedSettings.generationProvider ?? autoGenerationProvider(),
    assistantWebSearch: envAssistantWebSearchMode() ?? cachedSettings.assistantWebSearch ?? "auto",
    ollamaBaseUrl: normalizeProviderUrl(
      serverEnv("OLLAMA_BASE_URL") ?? cachedSettings.ollamaBaseUrl,
      "http://localhost:11434",
      "Ollama",
    ),
    ollamaModel: normalizeModel(
      serverEnv("OLLAMA_MODEL") ?? cachedSettings.ollamaModel,
      "qwen3:8b",
    ),
    fasterWhisperBaseUrl: normalizeProviderUrl(
      serverEnv("FASTER_WHISPER_BASE_URL") ?? cachedSettings.fasterWhisperBaseUrl,
      "http://localhost:8765",
      "Faster-Whisper",
    ),
    fasterWhisperModel: normalizeModel(
      serverEnv("FASTER_WHISPER_MODEL") ?? cachedSettings.fasterWhisperModel,
      "small",
    ),
    updatedAt: cachedUpdatedAt ?? now(),
  };
}

function parsePersistedProviderSettings(raw: string) {
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
}

function isPersistedProviderSettings(value: unknown): value is PersistedProviderSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<PersistedProviderSettings>;
  return data.version === 1 && Boolean(data.savedAt) && Boolean(data.settings);
}

async function persistProviderSettings() {
  const node = await loadNodeFileSystem();
  if (!node) return;

  const filePath = getSettingsPath(node.path);
  if (!filePath) return;

  const data: PersistedProviderSettings = {
    version: 1,
    savedAt: cachedUpdatedAt ?? now(),
    settings: cachedSettings,
  };
  const tempPath = `${filePath}.tmp`;

  await node.fs.mkdir(node.path.dirname(filePath), { recursive: true });
  await node.fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await node.fs.rename(tempPath, filePath);
}

function transcriptionCatalog(): ProviderCatalogItem[] {
  const simulatedEnabled = simulatedProvidersEnabled();

  return [
    {
      id: "mock",
      label: "Simulado (desenvolvimento)",
      kind: "transcription",
      availability: "development_only",
      description: "Usa transcricao simulada apenas para desenvolvimento e testes controlados.",
      reason: simulatedEnabled
        ? "Modo simulado habilitado por EDUCAI_ENABLE_SIMULATED_PROVIDERS."
        : "Ative EDUCAI_ENABLE_SIMULATED_PROVIDERS=true apenas em desenvolvimento.",
      selectable: simulatedEnabled,
    },
    {
      id: "openai",
      label: "OpenAI",
      kind: "transcription",
      availability: hasOpenAIKey() ? "ready" : "missing_config",
      description: "Transcricao em nuvem com modelos OpenAI.",
      reason: hasOpenAIKey() ? "Chave detectada no backend." : "Configure OPENAI_API_KEY.",
      selectable: true,
    },
    {
      id: "gemini",
      label: "Gemini",
      kind: "transcription",
      availability: hasGeminiKey() ? "ready" : "missing_config",
      description: "Transcricao em nuvem com modelos Gemini.",
      reason: hasGeminiKey() ? "Chave detectada no backend." : "Configure GEMINI_API_KEY.",
      selectable: true,
    },
    {
      id: "faster-whisper",
      label: "Faster-Whisper",
      kind: "transcription",
      availability: "ready",
      description: "Transcricao local via worker HTTP preparado para o futuro executavel.",
      reason: "Use o teste de conexao para validar endpoint e modelo local.",
      selectable: true,
    },
    {
      id: "whisper-local",
      label: "Whisper Local",
      kind: "transcription",
      availability: "coming_soon",
      description: "Entrada reservada para outros backends locais compativeis com Whisper.",
      reason: "Sera encaixado sobre a mesma arquitetura de worker local.",
      selectable: false,
    },
  ];
}

function generationCatalog(): ProviderCatalogItem[] {
  const simulatedEnabled = simulatedProvidersEnabled();

  return [
    {
      id: "mock",
      label: "Simulado (desenvolvimento)",
      kind: "generation",
      availability: "development_only",
      description: "Gera materiais e respostas simuladas apenas para desenvolvimento e testes.",
      reason: simulatedEnabled
        ? "Modo simulado habilitado por EDUCAI_ENABLE_SIMULATED_PROVIDERS."
        : "Ative EDUCAI_ENABLE_SIMULATED_PROVIDERS=true apenas em desenvolvimento.",
      selectable: simulatedEnabled,
    },
    {
      id: "openai",
      label: "OpenAI",
      kind: "generation",
      availability: hasOpenAIKey() ? "ready" : "missing_config",
      description: "Geracao de materiais, chat e assistente em nuvem.",
      reason: hasOpenAIKey() ? "Chave detectada no backend." : "Configure OPENAI_API_KEY.",
      selectable: true,
    },
    {
      id: "gemini",
      label: "Gemini",
      kind: "generation",
      availability: hasGeminiKey() ? "ready" : "missing_config",
      description: "Geracao de materiais, chat e assistente com Gemini.",
      reason: hasGeminiKey() ? "Chave detectada no backend." : "Configure GEMINI_API_KEY.",
      selectable: true,
    },
    {
      id: "ollama",
      label: "Ollama",
      kind: "generation",
      availability: "ready",
      description: "Provider local via endpoint HTTP do Ollama para Qwen, Gemma e compativeis.",
      reason: "Use o teste de conexao para validar endpoint e modelo local.",
      selectable: true,
    },
  ];
}

export async function ensureProviderRuntimeConfigLoaded() {
  loadPromise ??= (async () => {
    const node = await loadNodeFileSystem();
    if (!node) return;

    const filePath = getSettingsPath(node.path);
    if (!filePath) return;

    try {
      const raw = await node.fs.readFile(filePath, "utf8");
      const parsed = parsePersistedProviderSettings(raw);
      if (!isPersistedProviderSettings(parsed)) return;

      const nextSettings: ProviderRuntimeSettingsPatch = {};
      if (isTranscriptionProviderMode(parsed.settings.transcriptionProvider)) {
        nextSettings.transcriptionProvider = parsed.settings.transcriptionProvider;
      }
      if (isGenerationProviderMode(parsed.settings.generationProvider)) {
        nextSettings.generationProvider = parsed.settings.generationProvider;
      }
      if (isAssistantWebSearchMode(parsed.settings.assistantWebSearch)) {
        nextSettings.assistantWebSearch = parsed.settings.assistantWebSearch;
      }
      if (typeof parsed.settings.ollamaBaseUrl === "string") {
        nextSettings.ollamaBaseUrl = tryNormalizePersistedUrl(
          parsed.settings.ollamaBaseUrl,
          "Ollama",
        );
      }
      if (typeof parsed.settings.ollamaModel === "string") {
        nextSettings.ollamaModel = parsed.settings.ollamaModel.trim();
      }
      if (typeof parsed.settings.fasterWhisperBaseUrl === "string") {
        nextSettings.fasterWhisperBaseUrl = tryNormalizePersistedUrl(
          parsed.settings.fasterWhisperBaseUrl,
          "Faster-Whisper",
        );
      }
      if (typeof parsed.settings.fasterWhisperModel === "string") {
        nextSettings.fasterWhisperModel = parsed.settings.fasterWhisperModel.trim();
      }

      cachedSettings = nextSettings;
      cachedUpdatedAt = parsed.savedAt;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code !== "ENOENT") {
        console.error(error);
      }
    }
  })();

  await loadPromise;
}

export function getProviderRuntimeConfig(): ProviderRuntimeSettingsEnvelope {
  return {
    settings: snapshotSettings(),
    catalog: {
      transcription: transcriptionCatalog(),
      generation: generationCatalog(),
    },
  };
}

export async function updateProviderRuntimeConfig(
  patch: ProviderRuntimeSettingsPatch,
): Promise<ProviderRuntimeSettingsEnvelope> {
  await ensureProviderRuntimeConfigLoaded();
  const nextSettings = { ...cachedSettings };
  const simulatedEnabled = simulatedProvidersEnabled();

  if (patch.transcriptionProvider !== undefined) {
    if (!isTranscriptionProviderMode(patch.transcriptionProvider)) {
      throw new Error("Invalid transcription provider.");
    }
    if (patch.transcriptionProvider === "mock" && !simulatedEnabled) {
      throw new Error(
        "Mock transcription is restricted to development. Enable EDUCAI_ENABLE_SIMULATED_PROVIDERS=true or select OpenAI, Gemini, or Faster-Whisper.",
      );
    }
    nextSettings.transcriptionProvider = patch.transcriptionProvider;
  }

  if (patch.generationProvider !== undefined) {
    if (!isGenerationProviderMode(patch.generationProvider)) {
      throw new Error("Invalid generation provider.");
    }
    if (patch.generationProvider === "mock" && !simulatedEnabled) {
      throw new Error(
        "Mock generation is restricted to development. Enable EDUCAI_ENABLE_SIMULATED_PROVIDERS=true or select OpenAI, Gemini, or Ollama.",
      );
    }
    nextSettings.generationProvider = patch.generationProvider;
  }

  if (patch.assistantWebSearch !== undefined) {
    if (!isAssistantWebSearchMode(patch.assistantWebSearch)) {
      throw new Error("Invalid assistant web search mode.");
    }
    nextSettings.assistantWebSearch = patch.assistantWebSearch;
  }

  if (patch.ollamaBaseUrl !== undefined) {
    nextSettings.ollamaBaseUrl = normalizeLocalProviderBaseUrl(patch.ollamaBaseUrl, "Ollama");
  }

  if (patch.ollamaModel !== undefined) {
    nextSettings.ollamaModel = normalizeConfiguredModel(patch.ollamaModel, "Ollama");
  }

  if (patch.fasterWhisperBaseUrl !== undefined) {
    nextSettings.fasterWhisperBaseUrl = normalizeLocalProviderBaseUrl(
      patch.fasterWhisperBaseUrl,
      "Faster-Whisper",
    );
  }

  if (patch.fasterWhisperModel !== undefined) {
    nextSettings.fasterWhisperModel = normalizeConfiguredModel(
      patch.fasterWhisperModel,
      "Faster-Whisper",
    );
  }

  cachedSettings = nextSettings;
  cachedUpdatedAt = now();
  savePromise = savePromise.catch(() => undefined).then(() => persistProviderSettings());
  await savePromise;

  return getProviderRuntimeConfig();
}

export function resolveTranscriptionProvider(): TranscriptionProviderMode {
  return snapshotSettings().transcriptionProvider;
}

export function resolveGenerationProvider(): GenerationProviderMode {
  return snapshotSettings().generationProvider;
}

export function resolveAssistantWebSearchMode(): AssistantWebSearchMode {
  return snapshotSettings().assistantWebSearch;
}

export function providerHasOpenAIKey() {
  return hasOpenAIKey();
}

export function providerHasGeminiKey() {
  return hasGeminiKey();
}
