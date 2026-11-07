export type SessionType =
  | "CLASS"
  | "MENTORING"
  | "MEETING"
  | "TRAINING"
  | "WORKSHOP"
  | "CONSULTING"
  | "SALES_CALL"
  | "PRESENTATION"
  | "OTHER";

export type SessionStatus =
  | "CREATED"
  | "RECORDING"
  | "UPLOADING_AUDIO"
  | "AUDIO_UPLOADED"
  | "TRANSCRIBING"
  | "TRANSCRIBED"
  | "GENERATING_MATERIALS"
  | "READY"
  | "FAILED"
  | "CANCELED";

export type MaterialType =
  | "SUMMARY"
  | "TOPICS"
  | "MIND_MAP"
  | "INSIGHTS"
  | "LESSON_DIAGNOSIS"
  | "ACTION_ITEMS"
  | "QUESTIONS"
  | "EXECUTIVE_HANDOFF"
  | "SUGGESTED_RESPONSES"
  | "COMMERCIAL_BRIEF"
  | "FLASHCARDS"
  | "QUIZ"
  | "STUDY_PLAN";

export type MaterialStatus = "PENDING" | "GENERATING" | "COMPLETED" | "EDITED" | "FAILED";

export type TranscriptStatus = "PENDING" | "TRANSCRIBING" | "COMPLETED" | "EDITED" | "FAILED";

export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type AudioSource = "DESKTOP" | "WEB" | "BOT" | "UPLOAD";

export type OutputFormat = "TEXT" | "MARKDOWN" | "JSON";

export type TranscriptionProviderMode = "mock" | "openai" | "gemini" | "faster-whisper";

export type GenerationProviderMode = "mock" | "openai" | "gemini" | "ollama";

export type AssistantWebSearchMode = "auto" | "on" | "off";

export type ProviderCatalogAvailability =
  | "ready"
  | "missing_config"
  | "coming_soon"
  | "development_only";

export type ProviderCatalogItem = {
  id: string;
  label: string;
  kind: "transcription" | "generation";
  availability: ProviderCatalogAvailability;
  description: string;
  reason?: string;
  selectable: boolean;
};

export type ProviderRuntimeSettings = {
  transcriptionProvider: TranscriptionProviderMode;
  generationProvider: GenerationProviderMode;
  assistantWebSearch: AssistantWebSearchMode;
  ollamaBaseUrl: string;
  ollamaModel: string;
  geminiModel: string;
  fasterWhisperBaseUrl: string;
  fasterWhisperModel: string;
  // Modo demonstracao: transcricao e materiais simulados, sem nenhuma IA.
  demoMode: boolean;
  updatedAt: string;
};

export type ProviderRuntimeSettingsPatch = Partial<Omit<ProviderRuntimeSettings, "updatedAt">>;

export type ProviderCapabilityKey = "transcription" | "materials" | "chat" | "assistant";

export type ProviderCapabilityRuntimeStatus = "ready" | "limited" | "blocked" | "development_only";

export type ProviderCapabilityRuntime = {
  capability: ProviderCapabilityKey;
  label: string;
  selectedProvider: string;
  status: ProviderCapabilityRuntimeStatus;
  summary: string;
  detail?: string;
  issues: string[];
};

export type OllamaConnectionStatus = {
  provider: "ollama";
  baseUrl: string;
  model: string;
  checkedAt: string;
  status: "ready" | "unreachable" | "model_missing";
  reachable: boolean;
  activeModelAvailable: boolean;
  availableModels: string[];
  jsonGenerationReady: boolean;
  latencyMs?: number;
  checks: ProviderRuntimeCheck[];
  message: string;
};

export type ProviderRuntimeCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type ProviderSetupStep = {
  id: string;
  label: string;
  status: "done" | "todo" | "blocked";
  action: string;
  detail: string;
  command?: string;
};

export type FasterWhisperConnectionStatus = {
  provider: "faster-whisper";
  baseUrl: string;
  model: string;
  checkedAt: string;
  status: "ready" | "unreachable" | "model_missing" | "mock_mode" | "misconfigured";
  reachable: boolean;
  activeModelAvailable: boolean;
  availableModels: string[];
  runtimeBackend: "mock" | "command" | "unknown";
  runtimeCommandConfigured: boolean;
  diarizationBackend: "mock" | "command" | "unknown";
  diarizationCommandConfigured: boolean;
  smokeTranscriptionReady: boolean;
  smokeDiarizationReady: boolean;
  latencyMs?: number;
  checks: ProviderRuntimeCheck[];
  serviceName: string;
  message: string;
};

export type CloudProviderId = "gemini" | "openai";

export type CloudProviderConnectionStatusValue =
  | "ready"
  | "missing_key"
  | "invalid_key"
  | "model_unavailable"
  | "quota_exceeded"
  | "unreachable";

export type CloudProviderConnectionStatus = {
  provider: CloudProviderId;
  checkedAt: string;
  status: CloudProviderConnectionStatusValue;
  configured: boolean;
  model: string;
  latencyMs: number;
  checks: ProviderRuntimeCheck[];
  message: string;
};

export type ProviderRuntimeSettingsEnvelope = {
  settings: ProviderRuntimeSettings;
  catalog: {
    transcription: ProviderCatalogItem[];
    generation: ProviderCatalogItem[];
  };
};

export type ProviderRuntimeHealthEnvelope = {
  checkedAt: string;
  capabilities: ProviderCapabilityRuntime[];
  offlineReadiness: {
    status: "ready" | "partial" | "blocked";
    summary: string;
    issues: string[];
  };
  setupGuide: ProviderSetupStep[];
  localProviders: {
    ollama: OllamaConnectionStatus;
    fasterWhisper: FasterWhisperConnectionStatus;
  };
};

export type ProviderRuntimeHealthHistoryEntry = {
  id: string;
  checkedAt: string;
  offlineStatus: ProviderRuntimeHealthEnvelope["offlineReadiness"]["status"];
  offlineSummary: string;
  capabilityStatus: Record<ProviderCapabilityKey, ProviderCapabilityRuntimeStatus>;
  ollamaStatus: OllamaConnectionStatus["status"];
  fasterWhisperStatus: FasterWhisperConnectionStatus["status"];
  fasterWhisperSmokeReady: boolean;
  fasterWhisperDiarizationReady: boolean;
  issueCount: number;
  firstIssue?: string;
};

export type ProviderRuntimeHealthHistoryEnvelope = {
  entries: ProviderRuntimeHealthHistoryEntry[];
};

export type AppSettingsCategoryId =
  | "ai"
  | "database"
  | "voice"
  | "integrations"
  | "security"
  | "interface"
  | "automations";

export type AppSettingsStatus = "ready" | "attention" | "blocked" | "unknown";

export type AppSettingsSecretName =
  | "OPENAI_API_KEY"
  | "GEMINI_API_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_SECRET_KEY";

export type AppSettingsField = {
  key: string;
  label: string;
  category: AppSettingsCategoryId;
  type: "text" | "password" | "url" | "select" | "toggle" | "status";
  value?: string | boolean;
  maskedValue?: string;
  required?: boolean;
  description: string;
  example?: string;
  status: AppSettingsStatus;
  options?: Array<{ value: string; label: string }>;
};

export type AppSettingsCategory = {
  id: AppSettingsCategoryId;
  label: string;
  description: string;
  status: AppSettingsStatus;
  fields: AppSettingsField[];
};

export type AppSettingsVoiceCaptureMode = "microphone" | "microphone_and_system";

export type AppSettingsDiarizationMode = "off" | "speaker_labels" | "speaker_labels_with_names";

export type AppSettingsValues = {
  ai: Pick<
    ProviderRuntimeSettings,
    "transcriptionProvider" | "generationProvider" | "assistantWebSearch"
  >;
  database: {
    persistenceProvider: "local" | "supabase";
    supabaseUrl: string;
  };
  voice: {
    captureMode: AppSettingsVoiceCaptureMode;
    diarizationMode: AppSettingsDiarizationMode;
    preserveSourceTracks: boolean;
  };
  integrations: {
    googleMeetEnabled: boolean;
    microsoftTeamsEnabled: boolean;
  };
  security: {
    secretStorage: "backend_vault";
    encryptedAtRest: boolean;
  };
  interface: {
    appLanguage: string;
    theme: "system" | "light" | "dark";
  };
  automations: {
    enabled: boolean;
  };
};

export type AppSettingsSecretStatus = {
  name: AppSettingsSecretName;
  configured: boolean;
  source: "environment" | "backend_vault" | "missing";
  maskedValue?: string;
  updatedAt?: string;
};

export type AppSettingsCenterEnvelope = {
  version: 1;
  updatedAt: string;
  values: AppSettingsValues;
  categories: AppSettingsCategory[];
  secrets: AppSettingsSecretStatus[];
};

export type AppSettingsValidationCheck = {
  id: string;
  category: AppSettingsCategoryId;
  label: string;
  status: AppSettingsStatus;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
};

export type AppSettingsValidationEnvelope = {
  checkedAt: string;
  status: AppSettingsStatus;
  checks: AppSettingsValidationCheck[];
};

export type AppSettingsPatch = {
  providerSettings?: ProviderRuntimeSettingsPatch;
  database?: Partial<AppSettingsValues["database"]>;
  voice?: Partial<AppSettingsValues["voice"]>;
  integrations?: Partial<AppSettingsValues["integrations"]>;
  security?: Partial<AppSettingsValues["security"]>;
  interface?: Partial<AppSettingsValues["interface"]>;
  automations?: Partial<AppSettingsValues["automations"]>;
  secrets?: Partial<Record<AppSettingsSecretName, string | null>>;
};

export type Participant = {
  id?: string;
  name: string;
  email?: string;
  role?: string;
};

export type CreateSessionRequest = {
  title: string;
  type: SessionType;
  externalId?: string;
  language: string;
  participants?: Participant[];
  summaryTemplate?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateSessionRequest = {
  title?: string;
  participants?: Participant[];
  metadata?: Record<string, unknown>;
};

export type VoiceSession = {
  id: string;
  type: SessionType;
  externalId?: string;
  title: string;
  language: string;
  status: SessionStatus;
  participants: Participant[];
  summaryTemplate?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
};

export type RecordingUploadRequest = {
  source: AudioSource;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status?: "PENDING" | "UPLOADED" | "FAILED";
  storage?: {
    provider: "local";
    key: string;
    path?: string;
    savedAt: string;
  };
  metadata?: Record<string, unknown>;
};

export type VoiceRecording = {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: AudioSource;
  status: "PENDING" | "UPLOADED" | "FAILED";
  durationSeconds?: number;
  storage?: {
    provider: "local";
    key: string;
    path?: string;
    savedAt: string;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type TranscriptSegment = {
  id: string;
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type VoiceTranscript = {
  id: string;
  sessionId: string;
  language: string;
  status: TranscriptStatus;
  text: string;
  segments: TranscriptSegment[];
  format: OutputFormat;
  createdAt: string;
  updatedAt: string;
  provider: string;
};

export type TopicInsight = {
  title: string;
  bullets: string[];
};

export type ActionItem = {
  text: string;
  owner?: string;
  dueDate?: string;
  confidence: number;
};

export type MaterialItem = {
  id: string;
  sessionId: string;
  type: MaterialType;
  title: string;
  content: string;
  format: OutputFormat;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
};

export type CallMaterials = {
  sessionId: string;
  items: MaterialItem[];
  generatedAt: string;
  model: string;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type ChatRequest = {
  message: string;
};

export type ChatResponse = {
  message: ChatMessage;
  citations: TranscriptSegment[];
};

export type SessionProcessingStatus = {
  sessionId: string;
  status: SessionStatus;
  currentStep: string;
  progress: number;
  error?: string;
  updatedAt: string;
};

export type SessionRecord = {
  ownerId?: string;
  session: VoiceSession;
  recordings: VoiceRecording[];
  transcript?: VoiceTranscript;
  materials?: CallMaterials;
  messages: ChatMessage[];
  status: SessionProcessingStatus;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    path: string;
  };
};
