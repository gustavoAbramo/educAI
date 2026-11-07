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

export type TranscriptStatus = "PENDING" | "TRANSCRIBING" | "COMPLETED" | "EDITED" | "FAILED";

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

export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type OutputFormat = "TEXT" | "MARKDOWN" | "JSON";

export type AudioSource = "DESKTOP" | "WEB" | "BOT" | "UPLOAD";

export type AudioStatus = "PENDING" | "UPLOADED" | "FAILED";

export type SessionParticipant = {
  id?: string;
  name: string;
  email?: string;
  role?: string;
};

export type Session = {
  id: string;
  type: SessionType;
  externalId?: string;
  title: string;
  language: string;
  status: SessionStatus;
  participants?: SessionParticipant[];
  summaryTemplate?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  audioCount?: number;
  durationSeconds?: number;
  hasTranscript?: boolean;
  hasMaterials?: boolean;
};

export type SessionProcessingStatus = {
  sessionId: string;
  status: SessionStatus;
  currentStep: string;
  progress: number;
  error?: string;
  updatedAt: string;
};

export type AudioStorage = {
  provider: "local";
  key: string;
  path?: string;
  savedAt: string;
};

export type SessionAudio = {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: AudioSource;
  status: AudioStatus;
  durationSeconds?: number;
  storage?: AudioStorage;
  metadata?: Record<string, unknown>;
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

export type SessionTranscript = {
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

export type SessionMaterial = {
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

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

export type LiveAssistantMode = "student" | "mentor";

export type LiveAssistantContextPayload = {
  sessionTitle?: string;
  sessionType?: string;
  recording: boolean;
  activeSpeaker?: string;
  transcriptSegments: Array<{
    speakerName: string;
    text: string;
    confidence?: number;
    clarity?: number;
    conviction?: number;
    verbalQuality?: "adequada" | "revisar";
    technicalTerms?: string[];
    speakerRole?: string;
    themeLabel?: string;
    createdAt?: number;
    offsetMs?: number;
  }>;
  interimTranscript: string;
  insights: {
    terms: string[];
    transcriptionIssues: string[];
    importantPoints: string[];
    languageIssues: string[];
  };
};

export type AssistantResponseMeta = {
  source: "provider" | "local";
  domain:
    | "educai"
    | "general"
    | "technology"
    | "programming"
    | "ai"
    | "business"
    | "marketing"
    | "sales"
    | "entrepreneurship"
    | "education"
    | "study"
    | "language"
    | "science"
    | "history"
    | "geography"
    | "mathematics"
    | "career"
    | "psychology"
    | "health_basic"
    | "legal_basic"
    | "productivity"
    | "finance"
    | "news"
    | "entertainment"
    | "gaming";
  confidence: "high" | "medium" | "low";
  requiresFreshSources: boolean;
  usedWebSearch: boolean;
  suggestedAgents: string[];
  sources: Array<{
    title?: string;
    url: string;
  }>;
};

export type AssistantRespondRequest = {
  message: string;
  mode?: LiveAssistantMode;
  context?: LiveAssistantContextPayload;
};

export type AssistantRespondResponse = {
  data: {
    content: string;
    meta: AssistantResponseMeta;
  };
};

export type CreateSessionRequest = {
  title: string;
  type: SessionType;
  language: string;
  externalId?: string;
  participants?: SessionParticipant[];
  summaryTemplate?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateSessionRequest = {
  title?: string;
  participants?: SessionParticipant[];
  metadata?: Record<string, unknown>;
};

export type SessionListResponse = {
  data: Session[];
};

export type SessionOverviewResponse = {
  data: {
    session: Session;
    status: SessionProcessingStatus;
    audioCount: number;
    transcriptId?: string;
    materialsCount: number;
    materialsModel?: string;
    materialsGeneratedAt?: string;
    materialsJsonRepaired: boolean;
    persistence?: {
      provider: "local" | "supabase";
      configured: boolean;
    };
    chatMessages: number;
    updatedAt: string;
  };
};

export type SessionStatusResponse = {
  data: SessionProcessingStatus;
};

export type SessionTranscriptResponse = {
  data: SessionTranscript;
};

export type SessionMaterialsResponse = {
  data: SessionMaterial[];
};

export type SessionChatMessagesResponse = {
  data: ChatMessage[];
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
