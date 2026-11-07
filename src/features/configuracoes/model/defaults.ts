import { Activity, Database, Mic, SlidersHorizontal, Sparkles } from "lucide-react";
import type {
  AppSettingsCenterEnvelope,
  AppSettingsValidationEnvelope,
  FasterWhisperConnectionStatus,
  OllamaConnectionStatus,
  ProviderRuntimeHealthEnvelope,
  ProviderRuntimeHealthHistoryEnvelope,
  ProviderRuntimeSettingsEnvelope,
} from "@/lib/voice-intelligence";

export const selectClassName =
  "rounded-lg border border-input bg-background px-3 h-9 w-full min-w-0 max-w-full truncate text-sm outline-none focus:ring-2 focus:ring-ring/40 hover:border-ring/50 transition";
export const inputClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 hover:border-ring/50 transition";

export const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted";

export const settingsSections = [
  {
    id: "geral",
    label: "Geral",
    icon: SlidersHorizontal,
    description: "Aparência, idioma, acessibilidade e padrões de gravação.",
  },
  {
    id: "ia",
    label: "Inteligência Artificial",
    icon: Sparkles,
    description: "Provedor de IA, chaves de API e IA local com Ollama.",
  },
  {
    id: "audio",
    label: "Transcrição e áudio",
    icon: Mic,
    description: "Motor de transcrição, captura de áudio e separação de falantes.",
  },
  {
    id: "dados",
    label: "Banco de dados",
    icon: Database,
    description: "Onde o educAI guarda suas sessões.",
  },
  {
    id: "diagnostico",
    label: "Diagnóstico",
    icon: Activity,
    description: "Saúde dos serviços, modo offline e histórico de verificações.",
  },
] as const;

export type SettingsSectionId = (typeof settingsSections)[number]["id"];

export const settingsSectionKey = "educai-settings-section";

export const appLanguageKey = "educai-app-language";
export const transcriptionLanguageKey = "educai-transcription-language";
export const microphoneDeviceKey = "educai-microphone-device-id";

export type DeviceOption = {
  deviceId: string;
  label: string;
};

export type BrowserCaptureSupport = {
  getUserMedia: boolean;
  getDisplayMedia: boolean;
  mediaRecorder: boolean;
  secureContext: boolean;
};

export const emptyBrowserCaptureSupport: BrowserCaptureSupport = {
  getUserMedia: false,
  getDisplayMedia: false,
  mediaRecorder: false,
  secureContext: false,
};

export type ApiEnvelope<T> = {
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export const emptyProviderConfig: ProviderRuntimeSettingsEnvelope = {
  settings: {
    transcriptionProvider: "faster-whisper",
    generationProvider: "ollama",
    assistantWebSearch: "auto",
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "qwen3:8b",
    geminiModel: "gemini-3.8-flash",
    fasterWhisperBaseUrl: "http://localhost:8765",
    fasterWhisperModel: "small",
    demoMode: false,
    updatedAt: "",
  },
  catalog: {
    transcription: [],
    generation: [],
  },
};

export const emptyOllamaStatus: OllamaConnectionStatus = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "qwen3:8b",
  checkedAt: "",
  status: "unreachable",
  reachable: false,
  activeModelAvailable: false,
  availableModels: [],
  jsonGenerationReady: false,
  checks: [],
  message: "Status do Ollama ainda nao consultado.",
};

export const emptyFasterWhisperStatus: FasterWhisperConnectionStatus = {
  provider: "faster-whisper",
  baseUrl: "http://localhost:8765",
  model: "small",
  checkedAt: "",
  status: "unreachable",
  reachable: false,
  activeModelAvailable: false,
  availableModels: [],
  runtimeBackend: "unknown",
  runtimeCommandConfigured: false,
  diarizationBackend: "unknown",
  diarizationCommandConfigured: false,
  smokeTranscriptionReady: false,
  smokeDiarizationReady: false,
  checks: [],
  serviceName: "Faster-Whisper worker",
  message: "Status do Faster-Whisper ainda nao consultado.",
};

export const emptyRuntimeHealth: ProviderRuntimeHealthEnvelope = {
  checkedAt: "",
  capabilities: [],
  offlineReadiness: {
    status: "blocked",
    summary: "Saude offline ainda nao verificada.",
    issues: [],
  },
  setupGuide: [],
  localProviders: {
    ollama: emptyOllamaStatus,
    fasterWhisper: emptyFasterWhisperStatus,
  },
};

export const emptyRuntimeHistory: ProviderRuntimeHealthHistoryEnvelope = {
  entries: [],
};

export const emptyAppSettings: AppSettingsCenterEnvelope = {
  version: 1,
  updatedAt: "",
  values: {
    ai: {
      transcriptionProvider: "faster-whisper",
      generationProvider: "ollama",
      assistantWebSearch: "auto",
    },
    database: {
      persistenceProvider: "local",
      supabaseUrl: "",
    },
    voice: {
      captureMode: "microphone",
      diarizationMode: "off",
      preserveSourceTracks: true,
    },
    integrations: {
      googleMeetEnabled: true,
      microsoftTeamsEnabled: true,
    },
    security: {
      secretStorage: "backend_vault",
      encryptedAtRest: true,
    },
    interface: {
      appLanguage: "pt-BR",
      theme: "system",
    },
    automations: {
      enabled: false,
    },
  },
  categories: [],
  secrets: [],
};

export const emptyAppSettingsValidation: AppSettingsValidationEnvelope = {
  checkedAt: "",
  status: "unknown",
  checks: [],
};
