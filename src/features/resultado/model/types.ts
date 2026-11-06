export type Tab =
  | "resumo"
  | "relatorio"
  | "diagnostico"
  | "handoff"
  | "respostas"
  | "comercial"
  | "topicos"
  | "mapa"
  | "perguntas"
  | "acoes"
  | "transcricao"
  | "chat";

export type TopicCard = {
  title: string;
  items: string[];
};

export type MindMapView = {
  central: string;
  branches: { title: string; children: { title: string; children: string[] }[] }[];
};

export type LivePreviewSegment = {
  id: string;
  speakerName: string;
  text: string;
  confidence?: number;
  clarity?: number;
  intonation?: number;
  conviction?: number;
  verbalQuality?: "adequada" | "revisar";
  technicalTerms?: string[];
  createdAt?: number;
  offsetMs?: number;
};

export type LiveAssistantSnapshotView = {
  mode?: string;
  updatedAt?: string;
  sessionTitle?: string;
  contextLabel?: string;
  activeSpeaker?: string;
  messages: {
    id?: string;
    role: "user" | "assistant" | string;
    content: string;
    createdAt?: string;
  }[];
  prompts?: {
    label?: string;
    prompt?: string;
    description?: string;
  }[];
  markers?: {
    id?: string;
    kind?: string;
    label?: string;
    detail?: string;
    createdAt?: string;
    speakerName?: string;
    offsetMs?: number;
  }[];
  timeline?: {
    id?: string;
    label?: string;
    detail?: string;
    createdAt?: string;
    speakerName?: string;
    offsetMs?: number;
  }[];
};

export type AssistantTranscriptExchange = {
  id: string;
  question: string;
  answer: string;
  createdAt?: string;
};

export type StudyQuestion = {
  question: string;
  answer: string;
  difficulty: string;
  focus?: string;
  reviewTip?: string;
};

export type ReportEvidence = {
  section: string;
  claim: string;
  speaker: string;
  time: string;
  excerpt: string;
  score: number;
};

export type ReportSectionViewModel = {
  title: string;
  paragraphs: string[];
  bullets: string[];
};

export type ActionItemView = {
  title: string;
  priority?: string;
  category?: string;
  owner?: string;
  reason?: string;
  criterion?: string;
  order?: number;
  raw: string;
};
