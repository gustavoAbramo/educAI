import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  ChevronRight,
  Gauge,
  ListChecks,
  MessageSquareQuote,
  Pause,
  Play,
  Radio,
  Square,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { buildLivePreviewDashboard } from "@/lib/live-preview";
import { buildSessionSignalSnapshot } from "@/lib/session-signals";
import { formatSessionMeta } from "@/lib/session-format";
import { logAssistantQuestionGap } from "@/lib/assistant-question-log";
import { routeAssistantQuestion } from "@/lib/assistant-knowledge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContextualAssistant } from "@/components/contextual-assistant";
import type { AssistantExchange } from "@/components/contextual-assistant";
import { cn } from "@/lib/utils";
import {
  extractTechnicalTerms,
  normalizeTechnicalTerms,
  scoreTechnicalTerms,
} from "@/lib/technical-terms";
import {
  buildLiveAssistantPrompts,
  buildLiveAssistantResponse,
  buildLiveAssistantSnapshot,
  type AssistantVoiceState,
  type LiveAssistantMessage,
  type LiveAssistantMode,
} from "@/lib/live-assistant";
import {
  cancelSpeak,
  getSpeechRecognition,
  isSpeechSynthesisSupported,
  matchWakeWord,
  speak,
  toSpeech,
  type SpeechRecognitionAlternativeLike,
  type SpeechRecognitionResultLike,
} from "@/lib/speech";
import { uploadSessionAudio } from "@/services/audioService";
import { askAssistant } from "@/services/assistantService";
import type { AssistantResponseMeta } from "@/types/api";
import { getSessionById } from "@/services/sessionService";
import type { Session } from "@/types/api";

export const Route = createFileRoute("/aula")({
  component: Aula,
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
  }),
});

type LiveSpeaker = {
  id: string;
  name: string;
};

type LiveTranscriptSegment = {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  confidence?: number;
  technicalTerms?: string[];
  clarity?: number;
  intonation?: number;
  conviction?: number;
  speakerRole?: string;
  themeLabel?: string;
  verbalQuality?: "adequada" | "revisar";
  createdAt: number;
};

type LiveAudioSample = {
  at: number;
  rms: number;
  zcr: number;
  pitch?: number;
};

type SpeakerMode = "auto" | "manual";

type LessonAudioSettings = {
  captureMode: "microphone" | "microphone_and_system";
  diarizationMode: "off" | "speaker_labels" | "speaker_labels_with_names";
  preserveSourceTracks: boolean;
};

type MeetingAudioCaptureStatus =
  | "not_requested"
  | "pending"
  | "active"
  | "missing"
  | "blocked"
  | "unsupported"
  | "stopped";

type MeetingAudioCaptureDiagnostics = {
  status: MeetingAudioCaptureStatus;
  message: string;
  trackCount: number;
  trackLabel?: string;
  updatedAt: string;
};

type LessonRecordingBlobs = {
  microphone: Blob | null;
  system: Blob | null;
};

function readableSpeechRecognitionError(error?: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Permissao de microfone ou transcricao ao vivo bloqueada no navegador.";
  }

  if (error === "network") {
    return "Transcricao ao vivo indisponivel por falha de rede do navegador.";
  }

  if (error === "audio-capture") {
    return "Nao foi possivel capturar audio para transcricao ao vivo.";
  }

  return "Transcricao ao vivo indisponivel neste momento.";
}

function meetingAudioStatusLabel(status: MeetingAudioCaptureStatus) {
  if (status === "active") return "Audio da reuniao ativo";
  if (status === "pending") return "Aguardando aba/tela";
  if (status === "missing") return "Audio da reuniao ausente";
  if (status === "blocked") return "Captura da reuniao bloqueada";
  if (status === "unsupported") return "Navegador sem captura de aba";
  if (status === "stopped") return "Captura da reuniao encerrada";
  return "Captura da reuniao nao solicitada";
}

function meetingAudioStatusTone(status: MeetingAudioCaptureStatus) {
  if (status === "active") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "pending" || status === "stopped") {
    return "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function readableDisplayAudioError(error: unknown) {
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

function liveSegmentId() {
  return `live_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function cleanLiveSpeechText(text: string) {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!cleaned) return "";
  const withTechnicalTerms = normalizeTechnicalTerms(cleaned);
  return withTechnicalTerms.charAt(0).toLocaleUpperCase("pt-BR") + withTechnicalTerms.slice(1);
}

function bestSpeechAlternative(result: SpeechRecognitionResultLike) {
  const alternatives = Array.from({ length: Math.max(1, result.length ?? 1) })
    .map((_, index) => result[index])
    .filter((item): item is SpeechRecognitionAlternativeLike => Boolean(item?.transcript?.trim()));

  if (!alternatives.length) return undefined;

  const scored = alternatives.map((alternative) => {
    const confidence = alternative.confidence ?? 0;
    const termHits = scoreTechnicalTerms(alternative.transcript);
    const lengthScore = Math.min(alternative.transcript.length / 80, 1);
    const score = confidence * 1.6 + termHits * 0.35 + lengthScore * 0.1;

    return {
      alternative,
      score,
      confidence,
      length: alternative.transcript.length,
    };
  });

  return scored.sort(
    (a, b) => b.score - a.score || b.confidence - a.confidence || b.length - a.length,
  )[0]?.alternative;
}

function speakerNamesForSession(session: Session | null): LiveSpeaker[] {
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

function explicitSpeakerIndex(text: string, speakers: LiveSpeaker[]) {
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

function removeExplicitSpeakerPrefix(text: string) {
  return text.replace(
    /^(pessoa\s*\d+|speaker\s*\d+|professor(?:a)?|teacher|aluno(?:a)?|student|participante\s*\d*)\s*[:,-]\s*/i,
    "",
  );
}

const liveThemeStopWords = new Set([
  "a",
  "o",
  "de",
  "da",
  "do",
  "e",
  "para",
  "com",
  "sem",
  "que",
  "isso",
  "essa",
  "esse",
  "agora",
  "depois",
  "aula",
  "sessao",
  "reuniao",
]);

function inferLiveThemeLabel(text: string, technicalTerms: string[] = []) {
  const normalizedTerms = technicalTerms.map((term) => term.trim()).filter(Boolean);
  if (normalizedTerms.length >= 2) return `${normalizedTerms[0]} - ${normalizedTerms[1]}`;
  if (normalizedTerms[0]) return normalizedTerms[0];

  const tokens = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !liveThemeStopWords.has(token));

  if (tokens.length >= 2) {
    return `${tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1)} - ${tokens[1]}`;
  }
  if (tokens[0]) return tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1);
  return "Tema em aberto";
}

function inferSpeakerRole(args: {
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

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], mean = average(values)) {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
}

function computeRms(data: Float32Array) {
  let sum = 0;
  for (const value of data) {
    sum += value * value;
  }
  return Math.sqrt(sum / data.length);
}

function computeZeroCrossingRate(data: Float32Array) {
  let crossings = 0;
  for (let index = 1; index < data.length; index += 1) {
    if ((data[index - 1] >= 0 && data[index] < 0) || (data[index - 1] < 0 && data[index] >= 0)) {
      crossings += 1;
    }
  }
  return crossings / data.length;
}

function estimatePitchHz(data: Float32Array, sampleRate: number) {
  const rms = computeRms(data);
  if (rms < 0.01) return undefined;

  const minHz = 80;
  const maxHz = 320;
  const minOffset = Math.floor(sampleRate / maxHz);
  const maxOffset = Math.floor(sampleRate / minHz);
  let bestOffset = -1;
  let bestCorr = 0;

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let corr = 0;
    for (let index = 0; index < data.length - offset; index += 1) {
      corr += data[index] * data[index + offset];
    }
    corr /= data.length - offset;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || bestCorr < 0.15) return undefined;
  return sampleRate / bestOffset;
}

function deriveSpeechMetrics(samples: LiveAudioSample[], maxRms: number, confidence?: number) {
  if (!samples.length) return {};

  const allRmsValues = samples.map((sample) => sample.rms);
  const noiseFloor = percentile(allRmsValues, 0.2);
  const activeFloor = Math.max(0.004, noiseFloor * 1.4);
  const activeSamples = samples.filter((sample) => sample.rms >= activeFloor);
  const speechSamples = activeSamples.length >= 3 ? activeSamples : samples;
  const rmsValues = speechSamples.map((sample) => sample.rms);
  const zcrValues = speechSamples.map((sample) => sample.zcr);
  const pitchValues = speechSamples
    .map((sample) => sample.pitch)
    .filter((value): value is number => typeof value === "number" && value > 0);

  const rmsMean = average(rmsValues);
  const rmsStd = standardDeviation(rmsValues, rmsMean);
  const zcrMean = average(zcrValues);
  const pitchMean = average(pitchValues);
  const pitchStd = standardDeviation(pitchValues, pitchMean);
  const rmsP90 = percentile(rmsValues, 0.9);
  const dynamicReference = Math.max(
    0.012,
    Math.min(maxRms || 0.08, Math.max(rmsP90, rmsMean * 1.25)),
  );
  const signalScore = clamp01(
    (rmsMean - noiseFloor * 0.7) / Math.max(0.008, dynamicReference - noiseFloor * 0.7),
  );
  const noiseScore = clamp01(1 - Math.max(0, zcrMean - 0.12) / 0.22);
  const stabilityScore = clamp01(1 - rmsStd / Math.max(0.01, rmsMean * 1.35));
  const speechPresenceScore = clamp01(activeSamples.length / Math.max(1, samples.length) + 0.25);
  const confidenceScore = typeof confidence === "number" ? clamp01(confidence) : 0.65;

  const clarity = clamp01(
    0.08 +
      signalScore * 0.25 +
      noiseScore * 0.24 +
      stabilityScore * 0.16 +
      confidenceScore * 0.19 +
      speechPresenceScore * 0.08,
  );
  const conviction = clamp01(
    0.07 +
      signalScore * 0.31 +
      stabilityScore * 0.23 +
      confidenceScore * 0.18 +
      noiseScore * 0.13 +
      speechPresenceScore * 0.08,
  );
  const intonation = pitchValues.length
    ? clamp01(Math.min(pitchStd / Math.max(120, pitchMean), 0.45) / 0.45)
    : undefined;
  const verbalQualityScore = average([clarity, conviction, confidenceScore, intonation ?? clarity]);

  return {
    clarity,
    intonation,
    conviction,
    verbalQuality: verbalQualityScore >= 0.55 ? ("adequada" as const) : ("revisar" as const),
  };
}

function metricPercent(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`;
}

function metricBadgeClass(value: number) {
  const score = clamp01(value);
  if (score >= 0.75) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (score >= 0.55) {
    return "border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  if (score >= 0.4) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

function uniqueCompactValues(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function speakerMapFromMetadata(metadata?: Record<string, unknown>) {
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

function detectInformalLanguage(text: string) {
  const patterns: Array<[RegExp, string]> = [
    [/\bmano\b/gi, "Uso de 'mano', que pode soar informal demais."],
    [/\btipo assim\b/gi, "Uso de 'tipo assim', possivel vicio de linguagem."],
    [/\bne\b|\bné\b/gi, "Uso repetido de 'ne', que pode reduzir objetividade."],
    [/\btá\s+ligado\b|\bta\s+ligado\b/gi, "Uso de 'ta ligado', expressao informal."],
    [/\bentendeu\b/gi, "Uso de 'entendeu', que pode indicar checagem repetitiva."],
    [/\bmeio que\b/gi, "Uso de 'meio que', que pode enfraquecer seguranca na fala."],
    [/\bBasicamente\b/gi, "Uso de 'basicamente', acompanhar repeticao."],
  ];

  return patterns.filter(([pattern]) => pattern.test(text)).map(([, message]) => message);
}

function repeatedWordIssues(text: string) {
  const matches = text.match(/\b(\p{L}{3,})(?:\s+\1\b){1,}/giu) ?? [];
  return matches.map((match) => `Possivel repeticao: "${match}".`);
}

function importantPreviewPoints(segments: LiveTranscriptSegment[], interim: string) {
  const text = [...segments.map((segment) => segment.text), interim].join(" ");
  const sentences = text
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return uniqueCompactValues(
    sentences.filter((sentence) =>
      /\b(api|endpoint|webhook|frontend|front-end|backend|back-end|full\s*stack|objetivo|importante|precisa|exemplo|conceito|problema|solucao|melhorar|integracao|autenticacao|dados|plataforma|usuario|servidor|banco)\b/i.test(
        sentence,
      ),
    ),
    4,
  );
}

function livePreviewInsights(segments: LiveTranscriptSegment[], interim: string) {
  const allText = [...segments.map((segment) => segment.text), interim].join(" ");
  const terms = uniqueCompactValues(
    [
      ...segments.flatMap((segment) => segment.technicalTerms ?? []),
      ...extractTechnicalTerms(interim),
    ],
    8,
  );
  const lowConfidenceCount = segments.filter(
    (segment) => typeof segment.confidence === "number" && segment.confidence < 0.65,
  ).length;
  const transcriptionIssues = uniqueCompactValues(
    [
      lowConfidenceCount
        ? `${lowConfidenceCount} trecho(s) com confianca baixa; vale revisar a transcricao final.`
        : "",
      interim.length > 140
        ? "Trecho atual ainda esta em captura; algumas palavras podem mudar ao finalizar."
        : "",
      ...repeatedWordIssues(allText),
    ],
    4,
  );
  const languageIssues = uniqueCompactValues(detectInformalLanguage(allText), 4);

  return {
    terms,
    transcriptionIssues,
    importantPoints: importantPreviewPoints(segments, interim),
    languageIssues,
  };
}

function Aula() {
  const navigate = useNavigate();
  const { sessionId } = Route.useSearch();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [liveTranscriptSegments, setLiveTranscriptSegments] = useState<LiveTranscriptSegment[]>([]);
  const [liveInterimTranscript, setLiveInterimTranscript] = useState("");
  const [activeSpeakerIndex, setActiveSpeakerIndex] = useState(0);
  const [speakerMode, setSpeakerMode] = useState<SpeakerMode>("auto");
  const [liveTranscriptError, setLiveTranscriptError] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [latestExchange, setLatestExchange] = useState<AssistantExchange | null>(null);
  const [assistantMode, setAssistantMode] = useState<LiveAssistantMode>("student");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<LiveAssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        "Estou acompanhando a aula em tempo real. Posso responder pelo contexto da sessao, explicar conceitos gerais e ampliar a resposta com IA mais completa quando ela estiver disponivel.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [assistantVoiceMode, setAssistantVoiceMode] = useState(false);
  const [assistantVoiceState, setAssistantVoiceState] = useState<AssistantVoiceState>("idle");
  const [lessonAudioSettings, setLessonAudioSettings] = useState<LessonAudioSettings>({
    captureMode: "microphone",
    diarizationMode: "off",
    preserveSourceTracks: true,
  });
  const [meetingAudioCapture, setMeetingAudioCapture] = useState<MeetingAudioCaptureDiagnostics>({
    status: "not_requested",
    message:
      "Ao iniciar, o navegador pedira para escolher a aba/tela da reuniao e compartilhar o audio.",
    trackCount: 0,
    updatedAt: new Date().toISOString(),
  });
  const transcriptRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const systemRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const systemChunksRef = useRef<Blob[]>([]);
  const liveTranscriptRef = useRef<LiveTranscriptSegment[]>([]);
  const speechRestartRef = useRef(false);
  const activeSpeakerIndexRef = useRef(0);
  const speakerModeRef = useRef<SpeakerMode>("auto");
  const liveSpeakersRef = useRef<LiveSpeaker[]>([]);
  const lastFinalSpeechAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const meetingAudioCaptureRef = useRef<MeetingAudioCaptureDiagnostics>(meetingAudioCapture);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSampleTimerRef = useRef<number | null>(null);
  const audioSamplesRef = useRef<LiveAudioSample[]>([]);
  const maxRmsRef = useRef(0.06);
  // Refs com o estado mais recente do assistente, lidos de dentro do efeito de
  // reconhecimento de voz (que so e montado quando a gravacao comeca).
  const assistantVoiceModeRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const handleVoiceQuestionRef = useRef<(question: string) => void>(() => {});

  // Computado so no cliente (apos montar) para SSR e hidratacao concordarem.
  const [voiceFeaturesSupported, setVoiceFeaturesSupported] = useState(false);

  const updateMeetingAudioCapture = (
    status: MeetingAudioCaptureStatus,
    message: string,
    extras: Partial<Omit<MeetingAudioCaptureDiagnostics, "status" | "message" | "updatedAt">> = {},
  ) => {
    const next = {
      status,
      message,
      trackCount: extras.trackCount ?? meetingAudioCaptureRef.current.trackCount ?? 0,
      trackLabel: extras.trackLabel,
      updatedAt: new Date().toISOString(),
    } satisfies MeetingAudioCaptureDiagnostics;
    meetingAudioCaptureRef.current = next;
    setMeetingAudioCapture(next);
  };

  useEffect(() => {
    setVoiceFeaturesSupported(Boolean(getSpeechRecognition()) && isSpeechSynthesisSupported());
  }, []);

  const liveSpeakers = useMemo(() => speakerNamesForSession(session), [session]);

  const startAudioAnalysis = (stream: MediaStream) => {
    if (typeof window === "undefined") return;
    if (audioContextRef.current) return;

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = context;
    analyserRef.current = analyser;
    audioSourceRef.current = source;
    audioSamplesRef.current = [];
    maxRmsRef.current = 0.06;

    const buffer = new Float32Array(analyser.fftSize);
    const maxSamples = 240;

    audioSampleTimerRef.current = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const rms = computeRms(buffer);
      const zcr = computeZeroCrossingRate(buffer);
      const pitch = estimatePitchHz(buffer, context.sampleRate);
      maxRmsRef.current = Math.max(maxRmsRef.current, rms);

      audioSamplesRef.current = [
        ...audioSamplesRef.current,
        {
          at: Date.now(),
          rms,
          zcr,
          pitch,
        },
      ].slice(-maxSamples);
    }, 250);

    void context.resume();
  };

  const stopAudioAnalysis = () => {
    if (typeof window !== "undefined" && audioSampleTimerRef.current) {
      window.clearInterval(audioSampleTimerRef.current);
    }
    audioSampleTimerRef.current = null;
    audioSamplesRef.current = [];
    analyserRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    analyserRef.current = null;
    audioSourceRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  useEffect(() => {
    liveSpeakersRef.current = liveSpeakers;
    if (activeSpeakerIndex >= liveSpeakers.length) {
      setActiveSpeakerIndex(0);
    }
  }, [activeSpeakerIndex, liveSpeakers]);

  useEffect(() => {
    activeSpeakerIndexRef.current = activeSpeakerIndex;
  }, [activeSpeakerIndex]);

  useEffect(() => {
    speakerModeRef.current = speakerMode;
  }, [speakerMode]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (!recording) {
      speechRestartRef.current = false;
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setLiveTranscriptError(
        "Transcricao ao vivo nao disponivel neste navegador. O audio ainda sera enviado ao Gemini ao encerrar.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = session?.language || "pt-BR";
    recognition.maxAlternatives = 3;
    speechRestartRef.current = true;
    setLiveTranscriptError("");

    const startRecognition = () => {
      try {
        recognition.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/already started|invalidstate/i.test(message)) {
          setLiveTranscriptError("Nao foi possivel iniciar a transcricao ao vivo.");
        }
      }
    };

    recognition.onresult = (event) => {
      const interimParts: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;

        const alternative = bestSpeechAlternative(result);
        const text = cleanLiveSpeechText(alternative?.transcript ?? "");
        if (!text) continue;

        if (result.isFinal) {
          // Anti-feedback: ignora finais enquanto o assistente fala em voz alta,
          // para o microfone nao recapturar a propria resposta da IA.
          if (assistantSpeakingRef.current) continue;

          // Palavra de ativacao ("assistente, ..."): trata o trecho como pergunta
          // ao assistente e nao o adiciona ao transcript oficial da aula.
          if (assistantVoiceModeRef.current) {
            const voiceQuestion = matchWakeWord(text);
            if (voiceQuestion) {
              handleVoiceQuestionRef.current(voiceQuestion);
              continue;
            }
          }

          const speakers = liveSpeakersRef.current.length ? liveSpeakersRef.current : liveSpeakers;
          const explicitIndex = explicitSpeakerIndex(text, speakers);
          const nowMs = Date.now();
          const longPause =
            lastFinalSpeechAtRef.current > 0 && nowMs - lastFinalSpeechAtRef.current > 4500;
          const currentIndex =
            explicitIndex ??
            (speakerModeRef.current === "auto" && longPause && liveTranscriptRef.current.length > 0
              ? (activeSpeakerIndexRef.current + 1) % Math.max(1, speakers.length)
              : activeSpeakerIndexRef.current);
          const speaker = speakers[currentIndex] ?? speakers[0];
          const cleanedText = cleanLiveSpeechText(removeExplicitSpeakerPrefix(text));
          const previous = liveTranscriptRef.current.at(-1);
          const technicalTerms = extractTechnicalTerms(cleanedText);
          const metricsWindowMs = 5000;
          const recentSamples = audioSamplesRef.current.filter(
            (sample) => sample.at >= nowMs - metricsWindowMs,
          );
          const metrics = deriveSpeechMetrics(recentSamples, maxRmsRef.current);

          if (
            cleanedText &&
            !(
              previous?.speakerId === speaker.id &&
              previous.text.localeCompare(cleanedText, undefined, { sensitivity: "base" }) === 0
            )
          ) {
            const segment: LiveTranscriptSegment = {
              id: liveSegmentId(),
              speakerId: speaker.id,
              speakerName: speaker.name,
              text: cleanedText,
              confidence: alternative?.confidence,
              technicalTerms,
              clarity: metrics.clarity,
              intonation: metrics.intonation,
              conviction: metrics.conviction,
              verbalQuality: metrics.verbalQuality,
              createdAt: nowMs,
            };

            liveTranscriptRef.current = [...liveTranscriptRef.current, segment];
            setLiveTranscriptSegments(liveTranscriptRef.current);
          }

          lastFinalSpeechAtRef.current = nowMs;
          if (currentIndex !== activeSpeakerIndexRef.current) {
            activeSpeakerIndexRef.current = currentIndex;
            setActiveSpeakerIndex(currentIndex);
          }
        } else {
          interimParts.push(text);
        }
      }

      setLiveInterimTranscript(interimParts.join(" "));
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setLiveTranscriptError(readableSpeechRecognitionError(event.error));
    };

    recognition.onend = () => {
      if (!speechRestartRef.current) return;
      window.setTimeout(startRecognition, 300);
    };

    startRecognition();

    return () => {
      speechRestartRef.current = false;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.onerror = null;
      try {
        recognition.stop();
      } catch {
        recognition.abort();
      }
    };
  }, [liveSpeakers, recording, session?.language]);

  useEffect(() => {
    if (!liveTranscriptSegments.length && !liveInterimTranscript) return;

    transcriptRef.current?.lastElementChild?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [liveTranscriptSegments, liveInterimTranscript]);

  useEffect(() => {
    let active = true;

    const loadAudioSettings = async () => {
      try {
        const response = await fetch("/api/v1/settings/audio-defaults");
        const payload = (await response.json()) as { data?: LessonAudioSettings };
        if (active && payload.data) setLessonAudioSettings(payload.data);
      } catch (error) {
        console.warn("[educAI] configuracoes de audio indisponiveis", error);
      }
    };

    void loadAudioSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !session?.id) return;
    let active = true;

    const startRecording = async () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") return;

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Seu navegador nao suporta gravacao de audio.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: { ideal: true },
            channelCount: { ideal: 2 },
            deviceId:
              typeof window !== "undefined" &&
              window.localStorage.getItem("educai-microphone-device-id") &&
              window.localStorage.getItem("educai-microphone-device-id") !== "default"
                ? {
                    ideal: window.localStorage.getItem("educai-microphone-device-id") || undefined,
                  }
                : undefined,
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            sampleRate: { ideal: 48000 },
          },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        chunksRef.current = [];
        systemChunksRef.current = [];
        recordingStartedAtRef.current = Date.now();
        startAudioAnalysis(stream);
        updateMeetingAudioCapture(
          lessonAudioSettings.captureMode === "microphone_and_system" ? "pending" : "not_requested",
          lessonAudioSettings.captureMode === "microphone_and_system"
            ? "Escolha a aba do Google Meet/Teams no compartilhamento e marque compartilhar audio da aba."
            : "Modo atual grava apenas o microfone.",
          { trackCount: 0, trackLabel: undefined },
        );

        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        });

        if (lessonAudioSettings.captureMode === "microphone_and_system") {
          if (!navigator.mediaDevices.getDisplayMedia) {
            const message =
              "Este navegador nao permite capturar audio de aba/tela. Use Chrome ou Edge e escolha a aba do Meet com audio.";
            updateMeetingAudioCapture("unsupported", message, { trackCount: 0 });
            setAudioError(message);
          } else {
            try {
              const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: {
                  channelCount: { ideal: 2 },
                  echoCancellation: false,
                  noiseSuppression: false,
                  sampleRate: { ideal: 48000 },
                },
              });
              if (!active) {
                displayStream.getTracks().forEach((track) => track.stop());
                return;
              }
              displayStream.getVideoTracks().forEach((track) => track.stop());
              const systemAudioTracks = displayStream.getAudioTracks();

              if (systemAudioTracks.length > 0) {
                const firstTrack = systemAudioTracks[0];
                const trackLabel = firstTrack?.label || "audio compartilhado pelo navegador";
                const systemStream = new MediaStream(systemAudioTracks);
                systemStreamRef.current = systemStream;
                const systemRecorder = new MediaRecorder(systemStream);
                systemRecorderRef.current = systemRecorder;
                systemRecorder.addEventListener("dataavailable", (event) => {
                  if (event.data.size > 0) {
                    systemChunksRef.current.push(event.data);
                  }
                });
                systemAudioTracks.forEach((track) => {
                  track.addEventListener("ended", () => {
                    if (!active) return;
                    updateMeetingAudioCapture(
                      "stopped",
                      "A captura da reuniao foi encerrada pelo navegador. Se a aula ainda estiver acontecendo, reinicie a captura.",
                      {
                        trackCount: systemAudioTracks.length,
                        trackLabel,
                      },
                    );
                  });
                });
                systemRecorder.start();
                updateMeetingAudioCapture(
                  "active",
                  "Audio da reuniao ativo. O app esta gravando microfone e aba/sistema em faixas separadas.",
                  {
                    trackCount: systemAudioTracks.length,
                    trackLabel,
                  },
                );
              } else {
                displayStream.getTracks().forEach((track) => track.stop());
                const message =
                  "A fonte compartilhada nao trouxe audio. No Meet, escolha a aba do Chrome/Edge e marque compartilhar audio da aba.";
                updateMeetingAudioCapture("missing", message, { trackCount: 0 });
                setAudioError(message);
              }
            } catch (error) {
              const message = readableDisplayAudioError(error);
              updateMeetingAudioCapture("blocked", message, { trackCount: 0 });
              setAudioError(message);
            }
          }
        }

        recorder.start();
        setRecording(true);
      } catch (error) {
        if (!active) return;
        setAudioError(
          error instanceof Error ? error.message : "Nao foi possivel acessar o microfone.",
        );
        setRecording(false);
      }
    };

    void startRecording();

    return () => {
      active = false;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      systemStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      systemRecorderRef.current = null;
      streamRef.current = null;
      systemStreamRef.current = null;
      stopAudioAnalysis();
    };
  }, [lessonAudioSettings.captureMode, session?.id, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    const load = async () => {
      setSessionLoading(true);
      setSessionError("");

      try {
        const response = await getSessionById(sessionId);
        if (!active) return;
        setSession(response.data);
      } catch (error) {
        if (!active) return;
        setSessionError(
          error instanceof Error
            ? error.message
            : "API local indisponivel. Inicie com npm run dev:api.",
        );
        setSession(null);
      } finally {
        if (active) setSessionLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const sessionMeta = session
    ? formatSessionMeta(session.type, session.createdAt)
    : "Sessao em andamento";
  const sessionTitle = sessionLoading && !session ? "Carregando sessao..." : session?.title;
  const activeLiveSpeaker = liveSpeakers[activeSpeakerIndex]?.name ?? "Pessoa 1";
  const assistantInsights = useMemo(
    () => livePreviewInsights(liveTranscriptSegments, liveInterimTranscript),
    [liveInterimTranscript, liveTranscriptSegments],
  );
  const livePreviewBoard = useMemo(
    () =>
      buildLivePreviewDashboard({
        recording,
        activeSpeaker: activeLiveSpeaker,
        segments: liveTranscriptSegments,
        interimTranscript: liveInterimTranscript,
        insights: assistantInsights,
        context: {
          sessionTitle: session?.title,
          sessionType: session?.type,
          audience:
            typeof session?.metadata?.audience === "string" ? session.metadata.audience : undefined,
          objectives:
            typeof session?.metadata?.objectives === "string"
              ? session.metadata.objectives
              : undefined,
        },
      }),
    [
      activeLiveSpeaker,
      assistantInsights,
      liveInterimTranscript,
      liveTranscriptSegments,
      recording,
      session?.metadata,
      session?.title,
      session?.type,
    ],
  );
  const previewImportantPoints = livePreviewBoard.relevantInsights
    .map((item) => item.text)
    .slice(0, 3);
  const previewTechnicalTerms = assistantInsights.terms.slice(0, 5);
  const previewAlerts = [
    ...livePreviewBoard.relevantInsights
      .filter((item) => item.category === "risk" || item.category === "noise")
      .map((item) => item.reason),
    ...assistantInsights.transcriptionIssues,
    ...assistantInsights.languageIssues,
  ].slice(0, 3);
  const assistantContext = useMemo(
    () => ({
      sessionTitle: session?.title ?? sessionTitle,
      sessionType: session?.type,
      recording,
      activeSpeaker: activeLiveSpeaker,
      transcriptSegments: liveTranscriptSegments.map((segment) => ({
        speakerName: segment.speakerName,
        text: segment.text,
        confidence: segment.confidence,
        clarity: segment.clarity,
        conviction: segment.conviction,
        verbalQuality: segment.verbalQuality,
        technicalTerms: segment.technicalTerms,
        createdAt: segment.createdAt,
        offsetMs:
          recordingStartedAtRef.current > 0
            ? Math.max(0, segment.createdAt - recordingStartedAtRef.current)
            : undefined,
      })),
      interimTranscript: liveInterimTranscript,
      insights: assistantInsights,
    }),
    [
      activeLiveSpeaker,
      assistantInsights,
      liveInterimTranscript,
      liveTranscriptSegments,
      recording,
      session?.title,
      session?.type,
      sessionTitle,
    ],
  );
  const assistantPrompts = useMemo(
    () => buildLiveAssistantPrompts(assistantMode, assistantContext),
    [assistantContext, assistantMode],
  );
  const assistantSnapshot = useMemo(
    () =>
      buildLiveAssistantSnapshot(
        assistantMode,
        assistantMessages,
        assistantPrompts,
        assistantContext,
      ),
    [assistantContext, assistantMessages, assistantMode, assistantPrompts],
  );

  const speakResponse = (text: string) => {
    if (!isSpeechSynthesisSupported()) return;
    assistantSpeakingRef.current = true;
    setAssistantVoiceState("speaking");
    const started = speak(toSpeech(text), {
      lang: session?.language || "pt-BR",
      onEnd: () => {
        assistantSpeakingRef.current = false;
        setAssistantVoiceState(assistantVoiceModeRef.current ? "listening" : "idle");
      },
    });
    if (!started) {
      assistantSpeakingRef.current = false;
      setAssistantVoiceState(assistantVoiceModeRef.current ? "listening" : "idle");
    }
  };

  const ask = async (text?: string, options?: { spoken?: boolean }) => {
    const content = (text ?? assistantQuestion).trim();
    if (!content) return;

    if (options?.spoken || assistantVoiceMode) {
      setAssistantVoiceState("thinking");
    }

    let response = buildLiveAssistantResponse(content, assistantMode, assistantContext);
    let responseSource: "provider" | "local" = "local";
    let responseRoute = routeAssistantQuestion(content, assistantContext);
    let responseMeta: AssistantResponseMeta = {
      source: "local",
      domain: responseRoute.domain,
      confidence: responseRoute.confidence,
      requiresFreshSources: responseRoute.requiresFreshSources,
      usedWebSearch: false,
      suggestedAgents: responseRoute.suggestedAgents,
      sources: [],
    };

    try {
      const assistant = await askAssistant({
        message: content,
        mode: assistantMode,
        context: assistantContext,
      });
      response = assistant.data.content;
      if (assistant.data.meta.sources.length) {
        const sourceLines = assistant.data.meta.sources
          .slice(0, 3)
          .map((source) => `- ${source.title || source.url}: ${source.url}`);
        response = `${response}\n\n**Fontes**\n${sourceLines.join("\n")}`;
      }
      responseSource = assistant.data.meta.source;
      responseMeta = assistant.data.meta;
      responseRoute = {
        domain: assistant.data.meta.domain,
        confidence: assistant.data.meta.confidence,
        requiresFreshSources: assistant.data.meta.requiresFreshSources,
        shouldUseProvider: assistant.data.meta.source === "provider",
        suggestedAgents: assistant.data.meta.suggestedAgents,
        matchedTerms: [],
      };
    } catch (error) {
      console.warn("[educAI] fallback local do assistente", error);
    }

    const createdAt = new Date().toISOString();
    setAssistantMessages((current) => [
      ...current,
      {
        id: `assistant-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content,
        createdAt,
      },
      {
        id: `assistant-bot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        content: response,
        createdAt,
      },
    ]);
    setAssistantQuestion("");
    setLatestExchange({
      question: content,
      content: response,
      meta: {
        source: responseMeta.source,
        domain: responseMeta.domain,
        confidence: responseMeta.confidence,
        usedWebSearch: responseMeta.usedWebSearch,
        sourcesCount: responseMeta.sources.length,
      },
    });
    logAssistantQuestionGap(content, responseRoute, responseSource);
    if (options?.spoken || assistantVoiceMode) {
      speakResponse(response);
    }
  };

  // Disparado pela palavra de ativacao captada na transcricao viva.
  const handleVoiceQuestion = (question: string) => {
    setAssistantVoiceState("thinking");
    void ask(question, { spoken: true });
  };
  handleVoiceQuestionRef.current = handleVoiceQuestion;

  const handleVoiceModeChange = (on: boolean) => {
    setAssistantVoiceMode(on);
    if (on) {
      setAssistantVoiceState(recording ? "listening" : "idle");
    } else {
      cancelSpeak();
      assistantSpeakingRef.current = false;
      setAssistantVoiceState("idle");
    }
  };

  const stopSpeaking = () => {
    cancelSpeak();
    assistantSpeakingRef.current = false;
    setAssistantVoiceState(assistantVoiceMode && recording ? "listening" : "idle");
  };

  const speakLastAnswer = () => {
    const lastAnswer = [...assistantMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (lastAnswer) speakResponse(lastAnswer.content);
  };

  useEffect(() => {
    assistantVoiceModeRef.current = assistantVoiceMode;
  }, [assistantVoiceMode]);

  useEffect(() => {
    if (!assistantVoiceMode || assistantSpeakingRef.current) return;
    setAssistantVoiceState(recording ? "listening" : "idle");
  }, [recording, assistantVoiceMode]);

  useEffect(() => () => cancelSpeak(), []);

  const togglePause = () => {
    const recorder = recorderRef.current;
    if (!recorder) {
      toast.error("Gravador indisponivel");
      return;
    }

    if (recorder.state === "recording") {
      recorder.pause();
      if (systemRecorderRef.current?.state === "recording") {
        systemRecorderRef.current.pause();
      }
      setRecording(false);
      toast("Gravacao pausada");
      return;
    }

    if (recorder.state === "paused") {
      recorder.resume();
      if (systemRecorderRef.current?.state === "paused") {
        systemRecorderRef.current.resume();
      }
      setRecording(true);
      toast("Gravacao retomada");
    }
  };

  const stopRecording = () => {
    const stopSingleRecorder = (recorder: MediaRecorder | null, chunks: Blob[]) => {
      if (!recorder || recorder.state === "inactive") {
        return Promise.resolve<Blob | null>(
          chunks.length ? new Blob(chunks, { type: "audio/webm" }) : null,
        );
      }

      return new Promise<Blob | null>((resolve) => {
        const handleStop = () => {
          recorder.removeEventListener("stop", handleStop);
          const blob = chunks.length
            ? new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
            : null;
          resolve(blob);
        };

        recorder.addEventListener("stop", handleStop);
        recorder.stop();
      });
    };

    return Promise.all([
      stopSingleRecorder(recorderRef.current, chunksRef.current),
      stopSingleRecorder(systemRecorderRef.current, systemChunksRef.current),
    ]).then(([microphone, system]) => {
      stopAudioAnalysis();
      recordingStartedAtRef.current = 0;
      setRecording(false);
      return { microphone, system } satisfies LessonRecordingBlobs;
    });
  };

  const endLesson = async () => {
    if (isUploading) return;
    setIsUploading(true);
    setAudioError("");

    const recordingStartedAt = recordingStartedAtRef.current;
    const blobs = await stopRecording();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    systemStreamRef.current?.getTracks().forEach((track) => track.stop());

    const meetingAudioDiagnostics =
      lessonAudioSettings.captureMode === "microphone_and_system"
        ? meetingAudioCaptureRef.current
        : undefined;

    if (!blobs.microphone && !blobs.system) {
      const message = "Nao foi possivel capturar o audio.";
      setAudioError(message);
      toast.error(message);
      setIsUploading(false);
      return;
    }

    if (!sessionId) {
      const message = "Sessao nao encontrada para envio do audio.";
      setAudioError(message);
      toast.error(message);
      setIsUploading(false);
      return;
    }

    if (lessonAudioSettings.captureMode === "microphone_and_system" && !blobs.system) {
      const message =
        meetingAudioDiagnostics?.message ||
        "Audio da reuniao nao veio do navegador; somente o microfone sera enviado.";
      setAudioError(message);
      toast.warning("Audio da reuniao nao capturado", {
        description: "Vou processar o microfone, mas a fala dos outros participantes pode faltar.",
      });
    }

    const sessionMetadata =
      session?.metadata && typeof session.metadata === "object"
        ? (session.metadata as Record<string, unknown>)
        : undefined;
    const speakerMap = speakerMapFromMetadata(sessionMetadata);
    const sessionSignals = buildSessionSignalSnapshot({
      sessionTitle: session?.title,
      sessionType: session?.type,
      audience:
        typeof sessionMetadata?.audience === "string" ? sessionMetadata.audience : undefined,
      objectives:
        typeof sessionMetadata?.objectives === "string" ? sessionMetadata.objectives : undefined,
      segments: liveTranscriptSegments.map((segment) => ({
        id: segment.id,
        speakerName: segment.speakerName,
        text: segment.text,
        confidence: segment.confidence,
        clarity: segment.clarity,
        conviction: segment.conviction,
        technicalTerms: segment.technicalTerms,
        createdAt: segment.createdAt,
        offsetMs:
          recordingStartedAt > 0 ? Math.max(0, segment.createdAt - recordingStartedAt) : undefined,
      })),
    });
    const livePreview = liveTranscriptSegments.length
      ? {
          version: 1,
          capturedAt: new Date().toISOString(),
          segments: liveTranscriptSegments.map((segment) => ({
            id: segment.id,
            speakerId: segment.speakerId,
            speakerName: segment.speakerName,
            text: segment.text,
            confidence: segment.confidence,
            clarity: segment.clarity,
            intonation: segment.intonation,
            conviction: segment.conviction,
            verbalQuality: segment.verbalQuality,
            technicalTerms: segment.technicalTerms ?? [],
            createdAt: segment.createdAt,
            offsetMs:
              recordingStartedAt > 0 ? Math.max(0, segment.createdAt - recordingStartedAt) : 0,
          })),
        }
      : undefined;

    try {
      if (blobs.microphone) {
        await uploadSessionAudio(sessionId, blobs.microphone, {
          source: "WEB",
          fileName: `microphone-${Date.now()}.webm`,
          durationSeconds: Math.max(1, Math.round(seconds)),
          metadata: {
            sourceTrack: "microphone",
            captureMode: lessonAudioSettings.captureMode,
            diarizationMode: lessonAudioSettings.diarizationMode,
            preserveSourceTracks: lessonAudioSettings.preserveSourceTracks,
            ...(meetingAudioDiagnostics ? { meetingAudioCapture: meetingAudioDiagnostics } : {}),
            ...(livePreview ? { livePreview } : {}),
            ...(sessionSignals.signals.length ? { sessionSignals } : {}),
            liveAssistant: assistantSnapshot,
          },
        });
      }

      if (blobs.system) {
        await uploadSessionAudio(sessionId, blobs.system, {
          source: "DESKTOP",
          fileName: `meeting-system-${Date.now()}.webm`,
          durationSeconds: Math.max(1, Math.round(seconds)),
          metadata: {
            sourceTrack: "system",
            captureMode: lessonAudioSettings.captureMode,
            diarizationMode: lessonAudioSettings.diarizationMode,
            preserveSourceTracks: lessonAudioSettings.preserveSourceTracks,
            ...(meetingAudioDiagnostics ? { meetingAudioCapture: meetingAudioDiagnostics } : {}),
            speakerAttribution:
              lessonAudioSettings.diarizationMode === "speaker_labels_with_names"
                ? "manual_or_semiautomatic"
                : "speaker_labels",
            ...(speakerMap ? { speakerMap } : {}),
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar o audio.";
      setAudioError(message);
      toast.error("Falha no envio do audio", { description: message });
      setIsUploading(false);
      return;
    }

    toast.success("Aula encerrada", { description: "Processando materiais..." });
    navigate({ to: "/processando", search: { sessionId } as never });
    setIsUploading(false);
  };

  if (!sessionId || (!sessionLoading && sessionError && !session)) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Sessao nao encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Abra uma sessao valida pelo historico ou crie uma nova aula antes de iniciar a gravacao.
          </p>
          {sessionError ? <p className="mt-3 text-xs text-destructive">{sessionError}</p> : null}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => navigate({ to: "/historico" })}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Ver historico
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/nova-aula" })}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95"
            >
              Criar sessao
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-x-10 top-8 h-56 rounded-full bg-gradient-brand-soft opacity-70 blur-3xl" />
      {/* Header da aula */}
      <div className="px-6 py-4 border-b border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-rec" />
            {sessionMeta}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {sessionTitle ?? "Aula em andamento"}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Transcricao viva, sinais de clareza e assistencia contextual reunidos em um painel mais
            forte e escaneavel.
          </p>
          {sessionError ? <div className="text-xs text-destructive">{sessionError}</div> : null}
          {audioError ? <div className="text-xs text-destructive">{audioError}</div> : null}
          {lessonAudioSettings.captureMode === "microphone_and_system" ? (
            <div className="rounded-2xl border border-border/80 bg-background/82 p-3 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                    meetingAudioStatusTone(meetingAudioCapture.status),
                  )}
                >
                  {meetingAudioCapture.status === "active" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {meetingAudioStatusLabel(meetingAudioCapture.status)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {meetingAudioCapture.trackCount > 0
                    ? `${meetingAudioCapture.trackCount} faixa${
                        meetingAudioCapture.trackCount > 1 ? "s" : ""
                      } de audio`
                    : "sem faixa de audio remota"}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {meetingAudioCapture.message}
              </p>
              {meetingAudioCapture.status !== "active" ? (
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  Para Google Meet, prefira Chrome/Edge, escolha <strong>Aba</strong> e confirme
                  <strong> compartilhar audio da aba</strong>. Tela inteira ou janela podem nao
                  entregar audio em todos os sistemas.
                </p>
              ) : null}
            </div>
          ) : null}
          {isUploading ? (
            <div className="text-[11px] text-muted-foreground">Enviando audio...</div>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <span
              className={cn(
                "inline-flex items-center gap-2 px-3 h-8 rounded-full border text-xs font-medium",
                recording
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  recording ? "bg-recording animate-pulse-rec" : "bg-yellow-500",
                )}
              />
              {recording ? "Gravando" : "Pausada"}
            </span>
            <div className="font-display tabular-nums text-3xl font-semibold tracking-tight sm:text-4xl">
              {mm}:{ss}
            </div>
          </div>

          {/* Mini visualizer */}
          <div className="flex h-6 items-end gap-1">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="w-[4px] rounded-full bg-gradient-brand"
                style={{
                  height: `${recording ? 18 + Math.abs(Math.sin((i + seconds) * 0.65)) * 82 : 10}%`,
                  opacity: recording ? 0.9 : 0.22,
                  transition: "height 220ms ease",
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={togglePause}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-background/85 px-4 h-11 text-sm font-medium shadow-soft hover:bg-muted active:scale-[0.99] transition"
            >
              {recording ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {recording ? "Pausar captura" : "Retomar captura"}
            </button>
            <button
              onClick={() => setConfirmEnd(true)}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-2xl bg-destructive text-destructive-foreground px-4 h-11 text-sm font-medium hover:opacity-90 active:scale-[0.99] transition shadow-soft"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" />
              Encerrar aula
            </button>
          </div>
        </div>
      </div>

      {/* Transcricao e previa ao vivo */}
      <div>
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Previa inteligente
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {liveTranscriptSegments.length
                  ? `${liveTranscriptSegments.length} trecho${
                      liveTranscriptSegments.length > 1 ? "s" : ""
                    } capturado${liveTranscriptSegments.length > 1 ? "s" : ""}`
                  : "Aguardando fala"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Termos e metricas estimadas localmente a partir do audio.
              </div>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-rec" />
              {activeLiveSpeaker}
            </div>
          </div>
          <section className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
            <div className="min-w-0 rounded-xl border border-primary/20 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.9))] p-4 text-white shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/72">
                    <Radio className="h-3.5 w-3.5 text-zinc-300" />
                    Fala em tempo real
                  </div>
                  <h2 className="mt-3 max-w-2xl text-xl font-semibold tracking-tight text-white">
                    {livePreviewBoard.headline}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100">
                  {livePreviewBoard.liveLabel}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
                  <AudioLines className="h-3.5 w-3.5 text-zinc-300" />
                  Captura atual
                </div>
                <div className="mt-3 max-h-40 overflow-auto pr-1 text-base leading-7 text-white/94">
                  {livePreviewBoard.liveLine ||
                    "Aguardando a primeira fala reconhecida pelo navegador."}
                </div>
                <div className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-white/70">
                  {livePreviewBoard.insightSummary}
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-3">
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {livePreviewBoard.metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="rounded-xl border border-border/75 bg-card/82 p-3 shadow-soft"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <Gauge className="h-3 w-3" />
                      {metric.label}
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="text-xl font-semibold tracking-tight text-foreground">
                        {typeof metric.value === "number"
                          ? `${Math.round(metric.value * 100)}%`
                          : "--"}
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          metric.tone === "good"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : metric.tone === "medium"
                              ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {metric.tone === "good"
                          ? "forte"
                          : metric.tone === "medium"
                            ? "estavel"
                            : "atencao"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border/75 bg-card/82 p-3 shadow-soft">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <MessageSquareQuote className="h-3 w-3 text-primary" />
                  Resposta sugerida
                </div>
                <div className="mt-3 text-sm leading-6 text-foreground">
                  {livePreviewBoard.responseSuggestion?.response ||
                    "Quando surgir dor, duvida, objecao ou decisao relevante, a IA sugere uma resposta melhor para conduzir a conversa."}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  {livePreviewBoard.responseSuggestion ? (
                    <>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        tom {livePreviewBoard.responseSuggestion.tone}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {Math.round(livePreviewBoard.responseSuggestion.confidence * 100)}%
                        confianca
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="mt-3 text-xs leading-5 text-muted-foreground">
                  {livePreviewBoard.responseSuggestion?.reason ||
                    "A sugestao so aparece quando a fala traz contexto suficiente para uma resposta realmente util."}
                </div>
              </div>
            </div>
          </section>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/75 bg-card/72 px-3 py-2 shadow-soft">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                trechos
              </div>
              <div className="mt-1 text-xl font-semibold tracking-tight">
                {liveTranscriptSegments.length}
              </div>
            </div>
            <div className="rounded-xl border border-border/75 bg-card/72 px-3 py-2 shadow-soft">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                termos
              </div>
              <div className="mt-1 text-xl font-semibold tracking-tight">
                {assistantInsights.terms.length}
              </div>
            </div>
            <div className="rounded-xl border border-border/75 bg-card/72 px-3 py-2 shadow-soft">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                foco
              </div>
              <div className="mt-1 line-clamp-1 text-sm font-medium">
                {livePreviewBoard.relevantInsights[0]?.text ?? activeLiveSpeaker}
              </div>
            </div>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-primary/15 bg-card p-4 shadow-soft">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-primary" />
                Insights importantes
              </div>
              {previewImportantPoints.length ? (
                <div className="space-y-2">
                  {livePreviewBoard.relevantInsights.slice(0, 3).map((insight) => (
                    <div
                      key={insight.id}
                      className="rounded-xl border border-border/80 bg-background px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {insight.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round(insight.relevanceScore * 100)}% relevancia
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-5 text-foreground/90">
                        {insight.text}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-muted-foreground">
                        {insight.reason}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Aguardando sinais fortes o bastante para ganhar destaque.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-emerald-500/15 bg-card p-4 shadow-soft">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <ListChecks className="h-3 w-3 text-emerald-600 dark:text-emerald-300" />
                Termos tecnicos
              </div>
              {previewTechnicalTerms.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {previewTechnicalTerms.map((term) => (
                    <span
                      key={term}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                    >
                      {term}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Nenhum termo destacado ainda.</div>
              )}
            </div>

            <div className="rounded-2xl border border-amber-500/15 bg-card p-4 shadow-soft">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-300" />
                Alertas ao vivo
              </div>
              {previewAlerts.length ? (
                <div className="space-y-2">
                  {previewAlerts.map((alert) => (
                    <div key={alert} className="text-sm leading-5 text-foreground/90">
                      {alert}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Sem alertas importantes.</div>
              )}
            </div>
          </div>

          {livePreviewBoard.suggestedQuestion ? (
            <div className="mb-5 rounded-[1.3rem] border border-primary/15 bg-primary/5 px-4 py-3 shadow-soft">
              <button
                type="button"
                onClick={() => setAssistantQuestion(livePreviewBoard.suggestedQuestion ?? "")}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-primary/80">
                    Pergunta pronta para usar
                  </div>
                  <div className="mt-1 text-sm font-medium leading-6 text-foreground">
                    {livePreviewBoard.suggestedQuestion}
                  </div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-background text-primary">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            </div>
          ) : null}

          {livePreviewBoard.responseSuggestion ? (
            <div className="mb-5 rounded-[1.3rem] border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 shadow-soft">
              <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                Proxima melhor pergunta
              </div>
              <div className="mt-1 text-sm font-medium leading-6 text-foreground">
                {livePreviewBoard.responseSuggestion.nextQuestion}
              </div>
            </div>
          ) : null}

          <div className="mb-5 rounded-[1.4rem] border border-border/75 bg-card/82 px-4 py-3 shadow-soft backdrop-blur-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <Users className="h-3 w-3" />
                Canais
              </span>
              <button
                type="button"
                onClick={() => setSpeakerMode((mode) => (mode === "auto" ? "manual" : "auto"))}
                className={cn(
                  "h-7 rounded-md border px-2.5 text-xs transition",
                  speakerMode === "auto"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {speakerMode === "auto" ? "Auto" : "Manual"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {liveSpeakers.map((speaker, index) => {
                const active = activeSpeakerIndex === index;
                return (
                  <button
                    key={speaker.id}
                    type="button"
                    onClick={() => {
                      setSpeakerMode("manual");
                      setActiveSpeakerIndex(index);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 h-8 text-xs transition",
                      active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        active ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                    Canal {index + 1}
                    <span className="text-foreground/80">{speaker.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div
            ref={transcriptRef}
            className="prose prose-sm max-w-none text-foreground leading-relaxed space-y-3"
          >
            {liveTranscriptSegments.map((segment) => (
              <div
                key={segment.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-soft transition-all hover:border-primary/30 hover:shadow-card"
              >
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-brand" />
                <div className="mb-2 flex flex-wrap items-center gap-2 pl-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {segment.speakerName}
                  </span>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    Trecho finalizado
                  </span>
                  {typeof segment.confidence === "number" ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        metricBadgeClass(segment.confidence),
                      )}
                    >
                      {metricPercent(segment.confidence)} confianca local
                    </span>
                  ) : null}
                  {typeof segment.clarity === "number" ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        metricBadgeClass(segment.clarity),
                      )}
                    >
                      {metricPercent(segment.clarity)} clareza local
                    </span>
                  ) : null}
                  {typeof segment.intonation === "number" ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        metricBadgeClass(segment.intonation),
                      )}
                    >
                      {metricPercent(segment.intonation)} entonacao local
                    </span>
                  ) : null}
                  {typeof segment.conviction === "number" ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        metricBadgeClass(segment.conviction),
                      )}
                    >
                      {metricPercent(segment.conviction)} conviccao local
                    </span>
                  ) : null}
                  {segment.speakerRole ? (
                    <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary/80">
                      {segment.speakerRole}
                    </span>
                  ) : null}
                  {segment.themeLabel ? (
                    <span className="rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-[10px] text-zinc-700 dark:text-zinc-300">
                      Tema: {segment.themeLabel}
                    </span>
                  ) : null}
                  {segment.verbalQuality ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px]",
                        segment.verbalQuality === "adequada"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {segment.verbalQuality === "adequada" ? "Fala adequada" : "Revisar fala"}
                    </span>
                  ) : null}
                </div>
                <p className="m-0 pl-1 text-[15px] leading-relaxed">{segment.text}</p>
                {segment.technicalTerms?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-1 text-[10px] text-muted-foreground">
                    {segment.technicalTerms.map((term) => (
                      <span
                        key={term}
                        className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {liveInterimTranscript ? (
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
                <div className="absolute inset-y-0 left-0 w-1 bg-primary/50" />
                <div className="mb-2 flex items-center gap-2 pl-1 text-[10px] font-medium text-primary">
                  <span className="inline-flex h-4 w-4 items-end justify-center gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-0.5 rounded-sm bg-primary animate-pulse-rec"
                        style={{ height: `${45 + i * 25}%`, animationDelay: `${i * 140}ms` }}
                      />
                    ))}
                  </span>
                  {activeLiveSpeaker}
                </div>
                <p className="m-0 pl-1 text-[15px] leading-relaxed text-muted-foreground italic">
                  {liveInterimTranscript}
                </p>
              </div>
            ) : null}
            {!liveTranscriptSegments.length && !liveInterimTranscript ? (
              <p className="text-[15px] text-muted-foreground">
                {liveTranscriptError ||
                  (recording
                    ? "Fale normalmente. A previa da fala aparece aqui quando o navegador reconhecer o audio."
                    : "Transcricao ao vivo pausada.")}
              </p>
            ) : null}
            {liveTranscriptError && (liveTranscriptSegments.length || liveInterimTranscript) ? (
              <p className="text-xs text-destructive">{liveTranscriptError}</p>
            ) : null}
            {recording && (
              <p className="text-muted-foreground italic flex items-center gap-2">
                <span className="inline-flex items-end gap-0.5 h-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-sm bg-primary animate-pulse-rec"
                      style={{ height: `${40 + i * 30}%`, animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </span>
                ouvindo...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Assistente contextual integrado ao fluxo, sem sidebar */}
      <div className="border-t border-border bg-card/40 px-6 py-3">
        <div className="mx-auto max-w-3xl">
          <ContextualAssistant
            mode={assistantMode}
            onModeChange={setAssistantMode}
            prompts={assistantPrompts}
            question={assistantQuestion}
            onQuestionChange={setAssistantQuestion}
            onAsk={(prompt) => ask(prompt)}
            answer={latestExchange}
            onDismissAnswer={() => setLatestExchange(null)}
            topInsight={
              assistantInsights.importantPoints[0] ??
              (assistantInsights.terms[0]
                ? `Termo em foco: ${assistantInsights.terms[0]}`
                : undefined)
            }
            recording={recording}
            voiceMode={assistantVoiceMode}
            onVoiceModeChange={handleVoiceModeChange}
            voiceState={assistantVoiceState}
            voiceSupported={voiceFeaturesSupported}
            wakeWord="assistente"
            onStopSpeaking={stopSpeaking}
            onSpeakLast={speakLastAnswer}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => void endLesson()}
        title="Encerrar a aula?"
        description="A gravacao sera finalizada e a IA gerara os materiais. Voce podera revisar tudo em seguida."
        confirmLabel="Sim, encerrar"
        cancelLabel="Continuar gravando"
        tone="destructive"
        icon={<Square className="h-5 w-5" fill="currentColor" />}
      />
    </div>
  );
}
