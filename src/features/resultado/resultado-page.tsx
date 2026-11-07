import { BackButton } from "@/components/back-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatSessionMeta } from "@/lib/session-format";
import {
  buildSessionSignalIntelligence,
  sessionSignalSnapshotFromMetadata,
} from "@/lib/session-signals";
import { extractTechnicalTerms } from "@/lib/technical-terms";
import { cn } from "@/lib/utils";
import { getSessionAudio } from "@/services/audioService";
import { getSessionChatMessages } from "@/services/chatService";
import { generateSessionMaterials, getSessionMaterials } from "@/services/materialService";
import { getSessionOverview, updateSession } from "@/services/sessionService";
import { getSessionTranscript, updateSessionTranscript } from "@/services/transcriptService";
import type {
  ChatMessage,
  SessionAudio,
  SessionMaterial,
  SessionOverviewResponse,
  SessionTranscript,
  TranscriptSegment,
} from "@/types/api";
import { Link, getRouteApi } from "@tanstack/react-router";
import {
  FileText,
  Sparkles,
  Network,
  MessageSquare,
  Copy,
  Check,
  Download,
  FileQuestion,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Search,
  X,
  Pencil,
  RotateCcw,
  Save,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Layers3,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DeliverableBadge } from "./components/deliverable-badge";
import { MarkdownishText } from "./components/markdownish-text";
import { ReportDocumentView } from "./components/report-document-view";
import { ResultEmptyState } from "./components/result-empty-state";
import { SignalInsightPanel } from "./components/signal-insight-panel";
import { actionPriorityVisual, actionItemsFromMaterial } from "./model/action-items";
import {
  livePreviewSegmentsFromMetadata,
  liveAssistantSnapshotFromMetadata,
  assistantExchangesFromSnapshot,
} from "./model/live-snapshot";
import {
  downloadTextFile,
  markdownToHtmlDocument,
  markdownToPlainText,
  printHtmlDocument,
} from "./model/export-formats";
import { buildMarkdownExport } from "./model/markdown-export";
import {
  countMatches,
  foldQuery,
  textMatches,
  TranscriptHighlight,
} from "./components/transcript-highlight";
import {
  materialByType,
  isTranscriptNewerThanMaterial,
  markdownListItems,
  topicCardsFromMaterial,
  countWords,
  providerLabel,
  materialProviderLabel,
  wasMaterialJsonRepaired,
  isTranscriptNewerThanMaterials,
  executiveHighlights,
} from "./model/materials";
import { metricPercent, metricBadgeClass } from "./model/metrics";
import { mindMapColors, mindMapFromMaterial } from "./model/mind-map";
import { reportEvidenceFromTranscript } from "./model/report";
import {
  studyQuestionsFromMaterial,
  groupedStudyQuestions,
  studyQuestionVisual,
} from "./model/study-questions";
import { tabs, resultDeliverables } from "./model/tabs";
import {
  formatSegmentTime,
  transcriptSegmentsForDisplay,
  transcriptTextFromSegments,
  uniqueSpeakers,
  canonicalSpeakerKey,
  speakerNameFromMappedLabel,
  speakerMapFromMetadata,
  metadataString,
  meetingAudioCaptureFromRecording,
  audioSourceLabel,
  formatAudioSize,
  applySpeakerMapToSegments,
} from "./model/transcript";
import type { Tab } from "./model/types";

const routeApi = getRouteApi("/resultado");

export function Resultado() {
  const { sessionId } = routeApi.useSearch();
  const [tab, setTab] = useState<Tab>("resumo");
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<number | null>(0);
  const [expandedBranch, setExpandedBranch] = useState<number | null>(null);
  const [overview, setOverview] = useState<SessionOverviewResponse["data"] | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [transcript, setTranscript] = useState<SessionTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState("");
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [draftTranscriptSegments, setDraftTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [transcriptSaving, setTranscriptSaving] = useState(false);
  const [transcriptSaveError, setTranscriptSaveError] = useState("");
  const [speakerMapDraft, setSpeakerMapDraft] = useState<Record<string, string>>({});
  const [speakerMapSaving, setSpeakerMapSaving] = useState(false);
  const [speakerMapError, setSpeakerMapError] = useState("");
  const [materials, setMaterials] = useState<SessionMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState("");
  const [materialsRegenerating, setMaterialsRegenerating] = useState(false);
  const [recordings, setRecordings] = useState<SessionAudio[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingsError, setRecordingsError] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const copy = (text: string, key: string) => {
    if (!text.trim()) return;
    if (!navigator.clipboard?.writeText) {
      toast.error("Copia indisponivel neste navegador");
      return;
    }

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(key);
        toast.success("Copiado");
        setTimeout(() => setCopied(null), 1500);
      })
      .catch((error) => {
        toast.error("Nao foi possivel copiar", {
          description: error instanceof Error ? error.message : "Permissao de clipboard recusada.",
        });
      });
  };

  const exportResult = (format: "md" | "txt" | "pdf" | "copy") => {
    if (!hasExportableContent) {
      toast.error("Nada para exportar ainda", {
        description: "Aguarde o carregamento da sessao ou gere materiais primeiro.",
      });
      return;
    }

    const createdAt = overviewSession?.createdAt ?? new Date().toISOString();
    const safeTitle =
      (headerTitle || "resultado-da-sessao")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "resultado-da-sessao";
    const markdown = buildMarkdownExport({
      title: headerTitle,
      meta: [
        headerMeta,
        overviewSession ? `Tipo: ${overviewSession.type}` : "",
        overviewSession ? `Idioma: ${overviewSession.language}` : "",
        overview?.status.status ? `Status: ${overview.status.status}` : "",
        overviewSession ? `Criada em: ${createdAt}` : "",
      ].filter(Boolean),
      summaryText,
      reportText: technicalReportText,
      diagnosisText,
      reportEvidence,
      topicCards,
      mindMap,
      studyQuestionGroups,
      actionItems,
      transcriptSegments,
    });

    if (format === "copy") {
      copy(markdownToPlainText(markdown), "all");
      return;
    }
    if (format === "pdf") {
      printHtmlDocument(markdownToHtmlDocument(headerTitle, markdown));
      toast.success("Abrindo impressão", {
        description: 'Escolha "Salvar como PDF" como destino.',
      });
      return;
    }
    if (format === "txt") {
      downloadTextFile(
        `${safeTitle}-resultados.txt`,
        markdownToPlainText(markdown),
        "text/plain;charset=utf-8",
      );
      toast.success("Texto exportado");
      return;
    }

    downloadTextFile(`${safeTitle}-resultados.md`, markdown, "text/markdown;charset=utf-8");
    toast.success("Markdown exportado", {
      description: "O arquivo foi gerado apenas com os dados realmente disponiveis nesta sessao.",
    });
  };

  const loadOverview = useCallback(
    async (showLoading = true) => {
      if (!sessionId) return;
      if (showLoading) setOverviewLoading(true);
      setOverviewError("");

      try {
        const response = await getSessionOverview(sessionId);
        setOverview(response.data);
      } catch (error) {
        setOverviewError(
          error instanceof Error
            ? error.message
            : "API local indisponivel. Inicie com npm run dev:api.",
        );
        setOverview(null);
      } finally {
        if (showLoading) setOverviewLoading(false);
      }
    },
    [sessionId],
  );

  const loadMaterials = useCallback(
    async (showLoading = true) => {
      if (!sessionId) return;
      if (showLoading) setMaterialsLoading(true);
      setMaterialsError("");

      try {
        const response = await getSessionMaterials(sessionId);
        setMaterials(response.data);
      } catch (error) {
        setMaterialsError(
          error instanceof Error ? error.message : "Nao foi possivel carregar os materiais.",
        );
        setMaterials([]);
      } finally {
        if (showLoading) setMaterialsLoading(false);
      }
    },
    [sessionId],
  );

  const regenerateMaterials = async () => {
    if (!sessionId || materialsRegenerating) return;
    if (!transcript) {
      toast.error("Transcricao pendente", {
        description: "Gere ou carregue a transcricao antes de regenerar os materiais.",
      });
      return;
    }

    setMaterialsRegenerating(true);
    setMaterialsError("");

    try {
      const response = await generateSessionMaterials(sessionId);
      setMaterials(response.data);
      await loadOverview(false);
      toast.success("Materiais regenerados", {
        description: "O resultado agora usa a transcricao mais recente.",
      });
      setTab("resumo");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel regenerar os materiais.";
      setMaterialsError(message);
      toast.error("Falha ao regenerar materiais", { description: message });
    } finally {
      setMaterialsRegenerating(false);
    }
  };

  const updateDraftTranscriptSegment = (
    segmentId: string,
    patch: Partial<Pick<TranscriptSegment, "speaker" | "text">>,
  ) => {
    setDraftTranscriptSegments((segments) =>
      segments.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment)),
    );
  };

  const resetTranscriptDraft = () => {
    setDraftTranscriptSegments(transcriptSegmentsForDisplay(transcript));
    setEditingTranscript(false);
    setTranscriptSaveError("");
  };

  const saveTranscriptDraft = async () => {
    if (!sessionId || !transcript) return;

    const segments = draftTranscriptSegments
      .map((segment, index) => ({
        ...segment,
        speaker: segment.speaker.trim() || `Pessoa ${index + 1}`,
        text: segment.text.trim(),
      }))
      .filter((segment) => segment.text.length > 0);

    if (!segments.length) {
      setTranscriptSaveError("A transcricao precisa ter pelo menos um trecho com texto.");
      return;
    }

    setTranscriptSaving(true);
    setTranscriptSaveError("");

    try {
      const response = await updateSessionTranscript(sessionId, {
        text: transcriptTextFromSegments(segments),
        segments,
        status: "EDITED",
        format: transcript.format,
      });
      setTranscript(response.data);
      await loadOverview(false);
      toast.success("Transcricao atualizada", {
        description: "Revise e regenere os materiais para refletir a edicao.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel salvar a transcricao.";
      setTranscriptSaveError(message);
      toast.error("Falha ao salvar transcricao", { description: message });
    } finally {
      setTranscriptSaving(false);
    }
  };

  const saveSpeakerMap = async (options: { applyToTranscript?: boolean } = {}) => {
    if (!sessionId) return;

    const cleanedMap = Object.fromEntries(
      Object.entries(speakerMapDraft)
        .map(([key, value]) => [key.trim().toLowerCase(), value.trim()])
        .filter(([key, value]) => /^speaker_\d+$/i.test(key) && value),
    );

    setSpeakerMapSaving(true);
    setSpeakerMapError("");

    try {
      await updateSession(sessionId, {
        metadata: {
          speakerMap: cleanedMap,
        },
      });

      if (options.applyToTranscript && transcript) {
        const segments = applySpeakerMapToSegments(
          transcriptSegmentsForDisplay(transcript),
          cleanedMap,
        );
        const response = await updateSessionTranscript(sessionId, {
          text: transcriptTextFromSegments(segments),
          segments,
          status: "EDITED",
          format: transcript.format,
        });
        setTranscript(response.data);
      }

      await loadOverview(false);
      toast.success("Mapa de falantes salvo", {
        description: options.applyToTranscript
          ? "Os nomes tambem foram aplicados na transcricao."
          : "Novas transcricoes usarao este mapa.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel salvar o mapa de falantes.";
      setSpeakerMapError(message);
      toast.error("Falha ao salvar mapa", { description: message });
    } finally {
      setSpeakerMapSaving(false);
    }
  };

  const autofillSpeakerMap = (speakerKeys: string[], participants: string[]) => {
    setSpeakerMapDraft((current) => ({
      ...current,
      ...Object.fromEntries(
        speakerKeys.map((key, index) => [key, current[key] || participants[index] || ""]),
      ),
    }));
  };

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const segments = transcriptSegmentsForDisplay(transcript);
    setDraftTranscriptSegments(segments);
    setEditingTranscript(false);
    setTranscriptSaveError("");
  }, [transcript]);

  useEffect(() => {
    const metadata =
      overview?.session.metadata && typeof overview.session.metadata === "object"
        ? (overview.session.metadata as Record<string, unknown>)
        : undefined;
    setSpeakerMapDraft(speakerMapFromMetadata(metadata));
    setSpeakerMapError("");
  }, [overview?.session.metadata]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    const load = async () => {
      setTranscriptLoading(true);
      setTranscriptError("");

      try {
        const response = await getSessionTranscript(sessionId);
        if (!active) return;
        setTranscript(response.data);
      } catch (error) {
        if (!active) return;
        setTranscriptError(
          error instanceof Error ? error.message : "Nao foi possivel carregar a transcricao.",
        );
        setTranscript(null);
      } finally {
        if (active) setTranscriptLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    const load = async () => {
      setRecordingsLoading(true);
      setRecordingsError("");

      try {
        const response = await getSessionAudio(sessionId);
        if (!active) return;
        setRecordings(response.data);
      } catch (error) {
        if (!active) return;
        setRecordingsError(
          error instanceof Error ? error.message : "Nao foi possivel carregar os audios.",
        );
        setRecordings([]);
      } finally {
        if (active) setRecordingsLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    const load = async () => {
      setChatLoading(true);
      setChatError("");

      try {
        const response = await getSessionChatMessages(sessionId);
        if (!active) return;
        setChatMessages(response.data);
      } catch (error) {
        if (!active) return;
        setChatError(error instanceof Error ? error.message : "Nao foi possivel carregar o chat.");
        setChatMessages([]);
      } finally {
        if (active) setChatLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  const overviewSession = overview?.session;
  const headerMeta = overviewSession
    ? formatSessionMeta(overviewSession.type, overviewSession.createdAt)
    : "Sessao";
  const headerTitle = overviewSession?.title ?? "Resultado da sessao";
  const summaryMaterial = materialByType(materials, "SUMMARY");
  const reportMaterial = materialByType(materials, "INSIGHTS");
  const diagnosisMaterial = materialByType(materials, "LESSON_DIAGNOSIS");
  const topicsMaterial = materialByType(materials, "TOPICS");
  const mindMapMaterial = materialByType(materials, "MIND_MAP");
  const questionsMaterial = materialByType(materials, "QUESTIONS");
  const actionItemsMaterial = materialByType(materials, "ACTION_ITEMS");
  const executiveHandoffMaterial = materialByType(materials, "EXECUTIVE_HANDOFF");
  const suggestedResponsesMaterial = materialByType(materials, "SUGGESTED_RESPONSES");
  const commercialBriefMaterial = materialByType(materials, "COMMERCIAL_BRIEF");
  const summaryText = summaryMaterial?.content.trim() ?? "";
  const technicalReportText = reportMaterial?.content.trim() ?? "";
  const diagnosisText = diagnosisMaterial?.content.trim() ?? "";
  const executiveHandoffText = executiveHandoffMaterial?.content.trim() ?? "";
  const suggestedResponsesText = suggestedResponsesMaterial?.content.trim() ?? "";
  const commercialBriefText = commercialBriefMaterial?.content.trim() ?? "";
  const sessionSignalsSnapshot = sessionSignalSnapshotFromMetadata(overviewSession?.metadata);
  const sessionIntelligence = buildSessionSignalIntelligence(sessionSignalsSnapshot);
  const topicCards = topicCardsFromMaterial(topicsMaterial);
  const actionItems = markdownListItems(actionItemsMaterial?.content ?? "");
  const actionItemCards = actionItemsFromMaterial(actionItemsMaterial);
  const actionItemSummary = actionItemCards.reduce(
    (summary, item) => {
      const priority = item.priority?.toLowerCase();
      if (priority === "alta") summary.high += 1;
      if (priority === "media") summary.medium += 1;
      if (priority === "baixa") summary.low += 1;
      return summary;
    },
    { high: 0, medium: 0, low: 0 },
  );
  const mindMap = mindMapFromMaterial(headerTitle, mindMapMaterial);
  const mindMapEntries = mindMap.branches.map((branch, index) => ({ branch, index }));
  const leftMindMapEntries = mindMapEntries.filter((entry) => entry.index % 2 === 0);
  const rightMindMapEntries = mindMapEntries.filter((entry) => entry.index % 2 === 1);
  const studyQuestions = studyQuestionsFromMaterial(questionsMaterial);
  const studyQuestionGroups = groupedStudyQuestions(studyQuestions);
  const transcriptText = transcript?.text ?? "";
  const transcriptSegments = transcriptSegmentsForDisplay(transcript);
  const reportEvidence = technicalReportText
    ? reportEvidenceFromTranscript(technicalReportText, transcriptSegments)
    : [];
  // A busca so vale fora do modo de edicao, para nao esconder trechos sendo editados.
  const foldedTranscriptQuery = editingTranscript ? "" : foldQuery(transcriptQuery);
  const transcriptMatchSegments = foldedTranscriptQuery
    ? transcriptSegments.filter((segment) => textMatches(segment.text, foldedTranscriptQuery))
    : transcriptSegments;
  const transcriptMatchCount = foldedTranscriptQuery
    ? transcriptMatchSegments.reduce(
        (total, segment) => total + countMatches(segment.text, foldedTranscriptQuery),
        0,
      )
    : 0;
  const visibleTranscriptSegments = editingTranscript
    ? draftTranscriptSegments
    : transcriptMatchSegments;
  const latestRecording = recordings.at(-1);
  const microphoneRecording = recordings.find(
    (recording) => metadataString(recording.metadata, "sourceTrack") === "microphone",
  );
  const systemRecording = recordings.find(
    (recording) =>
      metadataString(recording.metadata, "sourceTrack") === "system" ||
      recording.source === "DESKTOP",
  );
  const meetingAudioDiagnostics = [...recordings]
    .reverse()
    .map((recording) => meetingAudioCaptureFromRecording(recording))
    .find((diagnostics) => Boolean(diagnostics));
  const multiSourceCaptureRequested = recordings.some(
    (recording) => metadataString(recording.metadata, "captureMode") === "microphone_and_system",
  );
  const livePreviewSegments = livePreviewSegmentsFromMetadata(
    latestRecording?.metadata as Record<string, unknown> | undefined,
  );
  const liveAssistantSnapshot = liveAssistantSnapshotFromMetadata(
    latestRecording?.metadata as Record<string, unknown> | undefined,
  );
  const liveAssistantMarkers = liveAssistantSnapshot?.markers ?? [];
  const liveAssistantTimeline = liveAssistantSnapshot?.timeline ?? [];
  const liveAssistantExchanges = assistantExchangesFromSnapshot(liveAssistantSnapshot);
  const participantSpeakers =
    overviewSession?.participants?.map((participant) => participant.name) ?? [];
  const remoteSpeakerKeys = uniqueSpeakers(
    transcriptSegments
      .map((segment) => canonicalSpeakerKey(segment.speaker))
      .filter((speaker): speaker is string => Boolean(speaker)),
    draftTranscriptSegments
      .map((segment) => canonicalSpeakerKey(segment.speaker))
      .filter((speaker): speaker is string => Boolean(speaker)),
  ).sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  const hasSpeakerMapCandidates = remoteSpeakerKeys.length > 0;
  const transcriptSpeakerOptions = uniqueSpeakers(
    participantSpeakers,
    transcriptSegments.map((segment) => segment.speaker),
    draftTranscriptSegments.map((segment) => segment.speaker),
    ["Pessoa 1", "Pessoa 2"],
  );
  const transcriptSpeakers = uniqueSpeakers(transcriptSegments.map((segment) => segment.speaker));
  const transcriptWordCount = countWords(transcriptText);
  const detectedTechnicalTerms = extractTechnicalTerms(transcriptText);
  const needsMaterialRefresh = isTranscriptNewerThanMaterials(transcript, materials);
  const staleMaterialTabs = new Set<Tab>([
    "resumo",
    "relatorio",
    "diagnostico",
    "topicos",
    "mapa",
    "perguntas",
    "acoes",
    "handoff",
    "respostas",
    "comercial",
  ]);
  const highlights = executiveHighlights(summaryText, topicCards, actionItems);
  const provider = providerLabel(transcript?.provider);
  const materialModelLabel = materialProviderLabel(overview?.materialsModel);
  const materialJsonRepaired = wasMaterialJsonRepaired(overview);
  const deliverableCards = resultDeliverables.map((item) => {
    const material = materialByType(materials, item.type);
    return {
      ...item,
      present: Boolean(material?.content.trim()),
      stale: isTranscriptNewerThanMaterial(transcript, material),
      updatedAt: material?.updatedAt || material?.createdAt,
    };
  });
  const resultIssues = [
    overviewError ? `Sessao: ${overviewError}` : "",
    overview?.status.status === "FAILED"
      ? `Processamento: ${overview.status.error || overviewSession?.failureReason || "falha sem detalhe informado"}`
      : "",
    transcriptError ? `Transcricao: ${transcriptError}` : "",
    materialsError ? `Materiais: ${materialsError}` : "",
    chatError ? `Chat: ${chatError}` : "",
    recordingsError ? `Audios: ${recordingsError}` : "",
  ].filter(Boolean);
  const statusText =
    overview?.status.status === "READY"
      ? "Sessao pronta"
      : overview?.status.status === "TRANSCRIBED"
        ? "Transcricao pronta"
        : overview?.status.status === "FAILED"
          ? "Falhou"
          : overview?.status.status
            ? "Em processamento"
            : "Carregando";
  const resultHealth = [
    transcript ? "Transcricao final carregada" : "Transcricao pendente",
    transcriptSpeakers.length > 1 ? `${transcriptSpeakers.length} falantes` : "1 falante detectado",
    `${deliverableCards.filter((item) => item.present).length}/${deliverableCards.length} entregas`,
    detectedTechnicalTerms.length
      ? `${detectedTechnicalTerms.length} termos tecnicos`
      : "Sem termos tecnicos detectados",
  ];
  const isResultLoading =
    overviewLoading || transcriptLoading || materialsLoading || recordingsLoading || chatLoading;
  const hasExportableContent = Boolean(
    overviewSession || transcript || materials.length || recordings.length || chatMessages.length,
  );

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10 animate-fade-in">
        <BackButton to="/historico" label="Historico" />
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Resultado nao encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta tela precisa de uma sessao valida para carregar transcricao, materiais e historico.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              to="/historico"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Ver historico
            </Link>
            <Link
              to="/nova-aula"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95"
            >
              Criar sessao
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/historico" label="Historico" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {overviewLoading ? "Carregando sessao..." : headerMeta}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">{headerTitle}</h1>
          {overviewError ? (
            <div className="text-xs text-destructive mt-1.5">{overviewError}</div>
          ) : null}
          {overview ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                Audios: {overview.audioCount}
              </span>
              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                Materiais: {overview.materialsCount}
              </span>
              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                Mensagens: {overview.chatMessages}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {transcript ? (
            <button
              onClick={() => void regenerateMaterials()}
              disabled={materialsRegenerating}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 h-10 text-sm font-medium text-foreground shadow-soft hover:border-primary/40 hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={"h-4 w-4 " + (materialsRegenerating ? "animate-spin" : "")} />
              {materialsRegenerating ? "Regenerando" : "Regenerar materiais"}
            </button>
          ) : null}
          <button
            onClick={() => exportResult("copy")}
            disabled={isResultLoading || !hasExportableContent}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 h-10 text-sm font-medium text-foreground shadow-soft hover:border-primary/40 hover:bg-muted active:scale-95 transition-all w-fit disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied === "all" ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied === "all" ? "Copiado" : "Copiar tudo"}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isResultLoading || !hasExportableContent}
                title={
                  hasExportableContent
                    ? "Baixar resumo, materiais e transcrição"
                    : "Aguarde os dados da sessao carregarem"
                }
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 h-10 text-sm font-medium text-foreground shadow-soft hover:border-primary/40 hover:bg-muted active:scale-95 transition-all w-fit disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Exportar
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => exportResult("pdf")}>
                PDF (imprimir)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportResult("md")}>
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportResult("txt")}>
                Texto simples (.txt)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {needsMaterialRefresh ? (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div>
              <div className="font-medium">Materiais desatualizados</div>
              <div className="text-muted-foreground">
                A transcricao foi editada depois da ultima geracao. Regenere para atualizar resumo,
                relatorio, mapa, perguntas e acoes.
              </div>
            </div>
          </div>
          <button
            onClick={() => void regenerateMaterials()}
            disabled={materialsRegenerating}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (materialsRegenerating ? "animate-spin" : "")} />
            Atualizar agora
          </button>
        </div>
      ) : null}

      {!recordingsLoading && recordings.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-border/80 bg-card/78 p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              {systemRecording || !multiSourceCaptureRequested ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              )}
              <div>
                <div className="text-sm font-medium">Diagnostico de captura</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {systemRecording
                    ? "Audio da reuniao/sistema foi salvo como fonte separada."
                    : multiSourceCaptureRequested
                      ? "A sessao pediu captura de reuniao, mas nenhum audio remoto foi salvo."
                      : "Sessao gravada apenas com microfone."}
                  {meetingAudioDiagnostics?.message ? ` ${meetingAudioDiagnostics.message}` : ""}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border bg-background px-2 py-1">
                Microfone: {microphoneRecording ? "salvo" : "ausente"}
              </span>
              <span className="rounded-full border border-border bg-background px-2 py-1">
                Reuniao: {systemRecording ? "salva" : "ausente"}
              </span>
              {meetingAudioDiagnostics?.trackCount ? (
                <span className="rounded-full border border-border bg-background px-2 py-1">
                  Faixas remotas: {meetingAudioDiagnostics.trackCount}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="rounded-xl border border-border/70 bg-background/70 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium">{audioSourceLabel(recording)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatAudioSize(recording.sizeBytes)}
                  </span>
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">
                  {recording.fileName}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {materialJsonRepaired ? (
        <div className="mb-5 rounded-2xl border border-zinc-500/25 bg-zinc-500/10 p-4 text-sm">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-zinc-700 dark:text-zinc-300" />
            <div>
              <div className="font-medium text-zinc-800 dark:text-zinc-200">
                Materiais gerados com JSON reparado
              </div>
              <div className="mt-1 text-zinc-800/80 dark:text-zinc-100/80">
                O modelo local retornou uma estrutura incompleta ou invalida e o backend corrigiu o
                JSON antes de montar os materiais. Revise os entregaveis com atencao.
              </div>
              <div className="mt-2 text-xs text-zinc-800/70 dark:text-zinc-100/70">
                Modelo: {materialModelLabel}
                {overview?.materialsGeneratedAt
                  ? ` · Gerado em ${new Date(overview.materialsGeneratedAt).toLocaleString("pt-BR")}`
                  : ""}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {resultIssues.length ? (
        <section className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
            <div className="min-w-0">
              <div className="font-medium text-rose-700 dark:text-rose-300">
                Existem problemas operacionais nesta sessao
              </div>
              <div className="mt-2 space-y-1 text-sm text-rose-700/90 dark:text-rose-200">
                {resultIssues.map((issue) => (
                  <div key={issue}>{issue}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Status
            </span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-lg font-semibold">{statusText}</div>
          <div className="mt-1 text-xs text-muted-foreground">{overview?.status.currentStep}</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Transcricao
            </span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-lg font-semibold">{transcriptSpeakers.length || 0} falantes</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {transcriptSegments.length} trechos - {transcriptWordCount} palavras
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Materiais
            </span>
            <Layers3 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-lg font-semibold">{materials.length} prontos</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {topicCards.length} topicos - {studyQuestions.length} perguntas
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Provider
            </span>
            <Clock3 className="h-4 w-4 text-primary" />
          </div>
          <div className="truncate text-lg font-semibold">{provider}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {detectedTechnicalTerms.slice(0, 3).join(", ") || "Sem termos tecnicos"}
          </div>
        </article>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Entregas reais
            </div>
            <h2 className="text-lg font-semibold tracking-tight">O que ja existe nesta sessao</h2>
          </div>
          <div className="text-xs text-muted-foreground">
            Apenas materiais realmente salvos aparecem como gerados.
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {deliverableCards.map((item) => (
            <DeliverableBadge
              key={item.type}
              label={item.label}
              present={item.present}
              stale={item.stale}
              updatedAt={item.updatedAt}
              onClick={() => setTab(item.tab)}
            />
          ))}
        </div>
      </section>

      {highlights.length ? (
        <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Visao executiva
              </div>
              <h2 className="text-lg font-semibold tracking-tight">Principais pontos da sessao</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {resultHealth.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {highlights.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="rounded-xl border border-border bg-background p-3 text-sm leading-relaxed"
              >
                <span className="mr-2 text-xs font-semibold text-primary">{index + 1}</span>
                {item}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Tabs com scroll horizontal */}
      <div className="relative mb-6 border-b border-border">
        <div className="flex gap-1 overflow-x-auto no-scrollbar -mb-px">
          {tabs.map((t) => {
            const active = tab === t.id;
            const stale = needsMaterialRefresh && staleMaterialTabs.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap transition-colors shrink-0 " +
                  (active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {stale ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-amber-500"
                    title="Material possivelmente desatualizado"
                  />
                ) : null}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-brand" />
                )}
              </button>
            );
          })}
        </div>
        {/* fade edges */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
      </div>

      <div className="animate-fade-in" key={tab}>
        {tab === "transcricao" && (
          <div className="group rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft hover:shadow-card transition-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Transcricao completa
                </div>
                {transcript?.status === "EDITED" ? (
                  <div className="mt-1 text-[11px] text-primary">Editada manualmente</div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {editingTranscript ? (
                  <>
                    <button
                      onClick={resetTranscriptDraft}
                      disabled={transcriptSaving}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                    <button
                      onClick={() => void saveTranscriptDraft()}
                      disabled={transcriptSaving}
                      className="inline-flex items-center gap-1.5 text-xs rounded-md bg-primary text-primary-foreground px-2.5 py-1.5 shadow-soft hover:opacity-95 disabled:opacity-60"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {transcriptSaving ? "Salvando" : "Salvar"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => copy(transcriptText, "t")}
                      disabled={!transcriptText}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      {copied === "t" ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied === "t" ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      onClick={() => {
                        setDraftTranscriptSegments(transcriptSegments);
                        setTranscriptSaveError("");
                        setEditingTranscript(true);
                      }}
                      disabled={!transcript}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-md hover:bg-muted disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  </>
                )}
              </div>
            </div>
            {transcriptLoading ? (
              <div className="mb-3 text-xs text-muted-foreground">Carregando transcricao...</div>
            ) : null}
            {transcriptError ? (
              <div className="mb-3 text-xs text-destructive">{transcriptError}</div>
            ) : null}
            {transcriptSaveError ? (
              <div className="mb-3 text-xs text-destructive">{transcriptSaveError}</div>
            ) : null}
            {transcript ? (
              <div className="mb-4 grid gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground sm:grid-cols-3">
                <div>
                  <div className="font-medium text-foreground">Falantes</div>
                  {transcriptSpeakers.length || 1} canal(is) na transcricao final
                </div>
                <div>
                  <div className="font-medium text-foreground">Termos tecnicos</div>
                  {detectedTechnicalTerms.slice(0, 5).join(", ") || "Nenhum termo detectado"}
                </div>
                <div>
                  <div className="font-medium text-foreground">Modelo</div>
                  {provider}
                </div>
              </div>
            ) : null}
            {hasSpeakerMapCandidates ? (
              <section className="mb-4 rounded-xl border border-border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Mapa de falantes</div>
                    <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Associe os labels remotos da diarizacao aos nomes da reuniao. O mapa fica
                      salvo na sessao e pode ser aplicado na transcricao atual.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => autofillSpeakerMap(remoteSpeakerKeys, participantSpeakers)}
                    disabled={!participantSpeakers.length || speakerMapSaving}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Sugerir por ordem
                  </button>
                </div>

                <datalist id="session-participants">
                  {participantSpeakers.map((speaker) => (
                    <option key={speaker} value={speaker} />
                  ))}
                </datalist>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {remoteSpeakerKeys.map((speakerKey) => (
                    <label key={speakerKey} className="block">
                      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                        {speakerKey}
                        {speakerNameFromMappedLabel(
                          transcriptSegments.find(
                            (segment) => canonicalSpeakerKey(segment.speaker) === speakerKey,
                          )?.speaker ?? "",
                        )
                          ? ` detectado como ${speakerNameFromMappedLabel(
                              transcriptSegments.find(
                                (segment) => canonicalSpeakerKey(segment.speaker) === speakerKey,
                              )?.speaker ?? "",
                            )}`
                          : ""}
                      </span>
                      <input
                        list="session-participants"
                        value={speakerMapDraft[speakerKey] ?? ""}
                        onChange={(event) =>
                          setSpeakerMapDraft((current) => ({
                            ...current,
                            [speakerKey]: event.target.value,
                          }))
                        }
                        placeholder="Nome do participante"
                        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                      />
                    </label>
                  ))}
                </div>

                {speakerMapError ? (
                  <div className="mt-3 text-xs text-destructive">{speakerMapError}</div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveSpeakerMap()}
                    disabled={speakerMapSaving}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {speakerMapSaving ? "Salvando" : "Salvar mapa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSpeakerMap({ applyToTranscript: true })}
                    disabled={speakerMapSaving || !transcript}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Salvar e aplicar
                  </button>
                </div>
              </section>
            ) : null}
            <datalist id="transcript-speakers">
              {transcriptSpeakerOptions.map((speaker) => (
                <option key={speaker} value={speaker} />
              ))}
            </datalist>
            {!editingTranscript && transcriptSegments.length ? (
              <div className="mb-4">
                <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground transition focus-within:ring-2 focus-within:ring-ring/40">
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  <input
                    type="search"
                    value={transcriptQuery}
                    onChange={(event) => setTranscriptQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setTranscriptQuery("");
                    }}
                    placeholder="Buscar na transcrição..."
                    aria-label="Buscar na transcrição"
                    className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {transcriptQuery ? (
                    <button
                      type="button"
                      onClick={() => setTranscriptQuery("")}
                      aria-label="Limpar busca"
                      className="grid h-6 w-6 place-items-center rounded-md hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                {foldedTranscriptQuery ? (
                  <div className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                    {transcriptMatchCount
                      ? `${transcriptMatchCount} ${transcriptMatchCount === 1 ? "ocorrência" : "ocorrências"} em ${transcriptMatchSegments.length} de ${transcriptSegments.length} trechos`
                      : "Nada encontrado na transcrição."}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-3 text-[15px] leading-relaxed">
              {visibleTranscriptSegments.length ? (
                visibleTranscriptSegments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className="rounded-xl border border-border bg-background p-4 transition hover:border-primary/30"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {editingTranscript ? (
                        <input
                          list="transcript-speakers"
                          value={segment.speaker}
                          onChange={(event) =>
                            updateDraftTranscriptSegment(segment.id, {
                              speaker: event.target.value,
                            })
                          }
                          className="h-8 min-w-36 rounded-md border border-input bg-card px-2 text-xs font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                        />
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {segment.speaker || `Pessoa ${index + 1}`}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatSegmentTime(segment.startMs)} - {formatSegmentTime(segment.endMs)}
                      </span>
                    </div>
                    {editingTranscript ? (
                      <textarea
                        value={segment.text}
                        onChange={(event) =>
                          updateDraftTranscriptSegment(segment.id, {
                            text: event.target.value,
                          })
                        }
                        rows={Math.min(6, Math.max(2, Math.ceil(segment.text.length / 90)))}
                        className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                      />
                    ) : (
                      <p className="m-0 text-[15px]">
                        <TranscriptHighlight
                          text={segment.text}
                          foldedQuery={foldedTranscriptQuery}
                        />
                      </p>
                    )}
                  </div>
                ))
              ) : foldedTranscriptQuery ? null : (
                <p className="text-sm text-muted-foreground">Transcricao ainda nao disponivel.</p>
              )}
            </div>

            {!editingTranscript && liveAssistantExchanges.length ? (
              <section className="mt-6 rounded-2xl border border-primary/15 bg-primary/5 p-5 shadow-soft">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-primary">
                      <MessageSquare className="h-3 w-3" />
                      Interacoes com a assistente
                    </div>
                    <h3 className="mt-1 text-base font-semibold tracking-tight">
                      Perguntas feitas durante a aula
                    </h3>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
                    {liveAssistantExchanges.length} pergunta
                    {liveAssistantExchanges.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-3">
                  {liveAssistantExchanges.map((exchange, index) => (
                    <article
                      key={exchange.id}
                      className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
                    >
                      <div className="border-b border-border/70 bg-background px-4 py-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                            {index + 1}
                          </span>
                          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Pergunta do usuario
                          </span>
                          {exchange.createdAt ? (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(exchange.createdAt).toLocaleString("pt-BR")}
                            </span>
                          ) : null}
                        </div>
                        <p className="m-0 text-sm leading-relaxed text-foreground">
                          {exchange.question}
                        </p>
                      </div>
                      <div className="px-4 py-3">
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                          <Sparkles className="h-3 w-3" />
                          Resposta da IA
                        </div>
                        {exchange.answer ? (
                          <MarkdownishText
                            content={exchange.answer}
                            emptyText="Resposta da IA nao registrada."
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Resposta da IA nao registrada.
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {recordingsLoading ? (
              <div className="mt-4 text-xs text-muted-foreground">Carregando previa local...</div>
            ) : null}
            {recordingsError ? (
              <div className="mt-4 text-xs text-destructive">{recordingsError}</div>
            ) : null}
            {livePreviewSegments.length ? (
              <div className="mt-6 rounded-2xl border border-border bg-card/70 p-5 shadow-soft">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Previa local (capturada no navegador)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {livePreviewSegments.length} trechos com metricas estimadas
                  </div>
                </div>
                <div className="space-y-3">
                  {livePreviewSegments.map((segment) => (
                    <div
                      key={segment.id}
                      className="rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {segment.speakerName}
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
                        {segment.verbalQuality ? (
                          <span
                            className={
                              "rounded-full border px-2 py-0.5 text-[10px] " +
                              (segment.verbalQuality === "adequada"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300")
                            }
                          >
                            {segment.verbalQuality === "adequada"
                              ? "Fala adequada"
                              : "Revisar fala"}
                          </span>
                        ) : null}
                      </div>
                      <p className="m-0 text-sm leading-relaxed">{segment.text}</p>
                      {segment.technicalTerms?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
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
                </div>
              </div>
            ) : null}
            {liveAssistantMarkers.length || liveAssistantTimeline.length ? (
              <div className="mt-6 rounded-2xl border border-border bg-card/70 p-5 shadow-soft">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Marcadores inteligentes
                    </div>
                    <h3 className="text-base font-semibold tracking-tight">
                      Linha do tempo e pontos destacados
                    </h3>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    {liveAssistantMarkers.length} marcadores
                  </span>
                </div>

                {liveAssistantMarkers.length ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {liveAssistantMarkers.map((marker) => (
                      <div
                        key={marker.id ?? `${marker.kind}-${marker.label}`}
                        className="rounded-xl border border-border bg-background px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {marker.label}
                          </span>
                          {marker.speakerName ? (
                            <span className="text-[10px] text-muted-foreground">
                              {marker.speakerName}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{marker.detail}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {liveAssistantTimeline.length ? (
                  <div className="space-y-2">
                    {liveAssistantTimeline.slice(0, 8).map((item) => (
                      <div
                        key={item.id ?? `${item.label}-${item.detail}`}
                        className="flex gap-3 rounded-xl border border-border bg-background px-3 py-2"
                      >
                        <div className="flex shrink-0 flex-col items-center pt-1">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <span className="mt-1 h-full w-px bg-border" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{item.label}</span>
                            {typeof item.offsetMs === "number" ? (
                              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                                {formatSegmentTime(Math.max(0, item.offsetMs))}
                              </span>
                            ) : null}
                            {item.speakerName ? (
                              <span className="text-[10px] text-muted-foreground">
                                {item.speakerName}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {tab === "resumo" && (
          <div className="relative rounded-2xl border border-border bg-gradient-brand-soft p-6 sm:p-8 shadow-soft hover:shadow-card transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Resumo gerado pela IA
              </div>
              <button
                onClick={() => copy(summaryText, "s")}
                disabled={!summaryText}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-md hover:bg-background/60"
              >
                {copied === "s" ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === "s" ? "Copiado" : "Copiar"}
              </button>
            </div>
            {materialsLoading ? (
              <div className="text-xs text-muted-foreground">Carregando materiais...</div>
            ) : null}
            {materialsError ? (
              <div className="mb-3 text-xs text-destructive">{materialsError}</div>
            ) : null}
            <MarkdownishText
              content={summaryText}
              emptyText="Resumo ainda nao gerado para esta sessao."
            />
          </div>
        )}

        {tab === "relatorio" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <ClipboardList className="h-3 w-3 text-primary" />
                Relatorio tecnico
              </div>
              <button
                onClick={() => copy(technicalReportText, "r")}
                disabled={!technicalReportText}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-md hover:bg-muted"
              >
                {copied === "r" ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === "r" ? "Copiado" : "Copiar"}
              </button>
            </div>
            {materialsLoading ? (
              <div className="text-xs text-muted-foreground">Carregando relatorio...</div>
            ) : null}
            {materialsError ? (
              <div className="mb-3 text-xs text-destructive">{materialsError}</div>
            ) : null}
            {!materialsLoading && !technicalReportText ? (
              <ResultEmptyState
                title="Relatorio tecnico pendente"
                description="Esta sessao ainda nao tem um relatorio analitico salvo. O resumo e outros materiais podem existir, mas o relatorio tecnico precisa ser gerado explicitamente."
                actionLabel={transcript ? "Gerar materiais novamente" : undefined}
                onAction={transcript ? () => void regenerateMaterials() : undefined}
                disabled={materialsRegenerating}
              />
            ) : null}
            {technicalReportText ? (
              <ReportDocumentView
                content={technicalReportText}
                emptyText="Relatorio analitico ainda nao gerado para esta sessao."
              />
            ) : null}
            {liveAssistantSnapshot ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Assistente ao vivo
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      Interacoes capturadas durante a aula
                    </h2>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    {liveAssistantSnapshot.mode === "mentor" ? "modo mentor" : "modo aluno"}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Conversa
                    </div>
                    <div className="mt-1 text-2xl font-semibold">
                      {liveAssistantSnapshot.messages.length}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {liveAssistantSnapshot.messages.length > 1
                        ? "Perguntas e respostas salvas no audio final."
                        : "Nenhuma pergunta feita no painel ao vivo."}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Contexto
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {liveAssistantSnapshot.sessionTitle ?? headerTitle}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {liveAssistantSnapshot.contextLabel ?? "Contexto nao informado"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Atualizacao
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {liveAssistantSnapshot.updatedAt
                        ? new Date(liveAssistantSnapshot.updatedAt).toLocaleString("pt-BR")
                        : "Sem horario"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {liveAssistantSnapshot.activeSpeaker
                        ? `Ultimo foco: ${liveAssistantSnapshot.activeSpeaker}`
                        : "Sem falante destacado"}
                    </div>
                  </div>
                </div>

                {liveAssistantSnapshot.prompts?.length ? (
                  <div className="mt-4">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Prompts usados
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {liveAssistantSnapshot.prompts.slice(0, 6).map((prompt) => (
                        <span
                          key={`${prompt.label ?? prompt.prompt}`}
                          className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                        >
                          {prompt.label || prompt.prompt}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {liveAssistantSnapshot.messages.length ? (
                  <div className="mt-4 space-y-3">
                    {liveAssistantSnapshot.messages.slice(-4).map((message) => (
                      <div
                        key={message.id ?? `${message.role}-${message.content.slice(0, 20)}`}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm leading-relaxed",
                          message.role === "user"
                            ? "border-primary/20 bg-primary/10"
                            : "border-border bg-card",
                        )}
                      >
                        <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {message.role === "user" ? "Voce" : "Assistente"}
                        </div>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
            {reportEvidence.length ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Evidencias na transcricao
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      Trechos que sustentam a analise
                    </h2>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    estimativa por palavras-chave
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {reportEvidence.map((item, index) => (
                    <article
                      key={`${item.section}-${item.time}-${index}`}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {item.section}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                          {item.score >= 0.45
                            ? "correspondencia forte"
                            : item.score >= 0.25
                              ? "correspondencia moderada"
                              : "correspondencia parcial"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.speaker} - {item.time}
                        </span>
                      </div>
                      <div className="text-sm font-medium leading-relaxed">{item.claim}</div>
                      <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground">
                        {item.excerpt}
                      </blockquote>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        {tab === "diagnostico" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <Layers3 className="h-3 w-3 text-primary" />
                Diagnostico acionavel
              </div>
              <button
                onClick={() => copy(diagnosisText, "d")}
                disabled={!diagnosisText}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {copied === "d" ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied === "d" ? "Copiado" : "Copiar"}
              </button>
            </div>
            {sessionSignalsSnapshot?.signals.length ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Inteligencia da aula
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      Sinais fortes persistidos da sessao
                    </h2>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    {sessionSignalsSnapshot.signals.length} sinais estruturados
                  </span>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  <SignalInsightPanel
                    title="Dores detectadas"
                    items={sessionIntelligence.pains}
                    emptyText="Nenhuma dor forte foi persistida nesta sessao."
                  />
                  <SignalInsightPanel
                    title="Duvidas recorrentes"
                    items={sessionIntelligence.recurringQuestions}
                    emptyText="Nenhuma duvida recorrente forte foi persistida."
                  />
                  <SignalInsightPanel
                    title="Objecoes"
                    items={sessionIntelligence.objections}
                    emptyText="Nenhuma objecao forte foi persistida."
                  />
                  <SignalInsightPanel
                    title="Oportunidades"
                    items={sessionIntelligence.opportunities}
                    emptyText="Nenhuma oportunidade forte foi persistida."
                  />
                  <SignalInsightPanel
                    title="Decisoes"
                    items={sessionIntelligence.decisions}
                    emptyText="Nenhuma decisao forte foi persistida."
                  />
                  <SignalInsightPanel
                    title="Tarefas"
                    items={sessionIntelligence.tasks}
                    emptyText="Nenhuma tarefa forte foi persistida."
                  />
                  <SignalInsightPanel
                    title="Follow-ups"
                    items={sessionIntelligence.followUps}
                    emptyText="Nenhum follow-up forte foi persistido."
                  />
                  <SignalInsightPanel
                    title="Riscos"
                    items={sessionIntelligence.risks}
                    emptyText="Nenhum risco forte foi persistido."
                  />
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight">
                        Proximos passos acionaveis
                      </h3>
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                        {sessionIntelligence.nextSteps.length}
                      </span>
                    </div>
                    {sessionIntelligence.nextSteps.length ? (
                      <div className="space-y-3">
                        {sessionIntelligence.nextSteps.map((item) => (
                          <article
                            key={item.id}
                            className="rounded-xl border border-border/70 bg-card p-3"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{item.title}</span>
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                                {item.priority}
                              </span>
                            </div>
                            <div className="text-xs leading-6 text-muted-foreground">
                              {item.description}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs leading-6 text-muted-foreground">
                        Nenhuma acao pratica foi sugerida a partir dos sinais persistidos.
                      </div>
                    )}
                  </section>
                  <section className="rounded-2xl border border-border bg-background p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight">Respostas sugeridas</h3>
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                        {sessionIntelligence.suggestedResponses.length}
                      </span>
                    </div>
                    {sessionIntelligence.suggestedResponses.length ? (
                      <div className="space-y-3">
                        {sessionIntelligence.suggestedResponses.map((item) => (
                          <article
                            key={item.id}
                            className="rounded-xl border border-border/70 bg-card p-3"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{item.title}</span>
                              {item.confidence !== undefined ? (
                                <span
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                    metricBadgeClass(item.confidence),
                                  )}
                                >
                                  {metricPercent(item.confidence)}
                                </span>
                              ) : null}
                              {item.tone ? (
                                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                                  {item.tone}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs leading-6 text-foreground/90">
                              {item.response}
                            </div>
                            <div className="mt-2 text-xs leading-6 text-muted-foreground">
                              {item.reason}
                            </div>
                            {item.nextQuestion ? (
                              <div className="mt-2 text-[11px] text-primary">
                                Proxima pergunta: {item.nextQuestion}
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs leading-6 text-muted-foreground">
                        Nenhuma resposta sugerida forte foi persistida nesta sessao.
                      </div>
                    )}
                  </section>
                </div>
              </section>
            ) : null}
            {materialsLoading ? (
              <div className="text-xs text-muted-foreground">Carregando diagnostico...</div>
            ) : null}
            {materialsError ? (
              <div className="mb-3 text-xs text-destructive">{materialsError}</div>
            ) : null}
            {!materialsLoading && !diagnosisText ? (
              <ResultEmptyState
                title="Diagnostico da aula pendente"
                description="Este material ainda nao foi salvo para a sessao. Quando houver sinais reais suficientes, ele resume dores, duvidas, objecoes, oportunidades e respostas sugeridas."
                actionLabel={transcript ? "Gerar materiais novamente" : undefined}
                onAction={transcript ? () => void regenerateMaterials() : undefined}
                disabled={materialsRegenerating}
              />
            ) : null}
            {diagnosisText ? (
              <ReportDocumentView
                content={diagnosisText}
                emptyText="Diagnostico da aula ainda nao gerado para esta sessao."
              />
            ) : null}
          </div>
        )}

        {tab === "topicos" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {topicCards.length === 0 ? (
              <div className="sm:col-span-2">
                <ResultEmptyState
                  title={materialsLoading ? "Carregando topicos" : "Topicos pendentes"}
                  description={
                    materialsLoading
                      ? "Os topicos desta sessao ainda estao sendo carregados."
                      : "Os topicos ainda nao foram gerados ou nao ficaram salvos nesta sessao."
                  }
                  actionLabel={
                    transcript && !materialsLoading ? "Gerar materiais novamente" : undefined
                  }
                  onAction={
                    transcript && !materialsLoading ? () => void regenerateMaterials() : undefined
                  }
                  disabled={materialsRegenerating}
                />
              </div>
            ) : null}
            {topicCards.map((t, idx) => {
              const open = expandedTopic === idx;
              return (
                <button
                  key={t.title}
                  onClick={() => setExpandedTopic(open ? null : idx)}
                  className={
                    "group text-left rounded-2xl border bg-card p-5 shadow-soft transition-all hover:shadow-card hover:-translate-y-0.5 hover:border-primary/40 " +
                    (open ? "border-primary/40 shadow-card" : "border-border")
                  }
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium">{t.title}</div>
                    <ChevronRight
                      className={
                        "h-4 w-4 text-muted-foreground transition-transform " +
                        (open ? "rotate-90 text-primary" : "group-hover:translate-x-0.5")
                      }
                    />
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {t.items.length ? (
                      t.items.map((i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          {i}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground/80">Ponto principal da sessao.</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>
        )}

        {tab === "mapa" && (
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-soft">
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-background">
              <div className="min-w-[760px] p-6">
                {mindMap.branches.length === 0 ? (
                  <div className="py-6">
                    <ResultEmptyState
                      title={materialsLoading ? "Carregando mapa mental" : "Mapa mental pendente"}
                      description={
                        materialsLoading
                          ? "O mapa mental desta sessao ainda esta sendo carregado."
                          : "Nenhum mapa mental foi salvo para esta sessao. O sistema nao reconstroi um mapa artificial quando esse material nao existe."
                      }
                      actionLabel={
                        transcript && !materialsLoading ? "Gerar materiais novamente" : undefined
                      }
                      onAction={
                        transcript && !materialsLoading
                          ? () => void regenerateMaterials()
                          : undefined
                      }
                      disabled={materialsRegenerating}
                    />
                  </div>
                ) : (
                  <div className="grid min-h-[420px] grid-cols-[1fr_220px_1fr] items-center gap-4">
                    <div className="space-y-5">
                      {leftMindMapEntries.map(({ branch, index }) => {
                        const color = mindMapColors[index % mindMapColors.length];
                        const open = expandedBranch === index;
                        return (
                          <div key={branch.title} className="flex items-center justify-end gap-3">
                            <div
                              onMouseEnter={() => setExpandedBranch(index)}
                              onMouseLeave={() => setExpandedBranch(null)}
                              className={
                                "w-full max-w-[270px] rounded-xl border bg-card p-3 text-right shadow-soft transition-all " +
                                (open ? "-translate-y-0.5 shadow-card" : "hover:-translate-y-0.5")
                              }
                              style={{ borderColor: open ? color : `${color}66` }}
                            >
                              <div className="mb-2 flex items-center justify-end gap-2 border-b border-border/70 pb-2 text-sm font-semibold">
                                {branch.title}
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                              </div>
                              <div className="space-y-2">
                                {branch.children.length
                                  ? branch.children.map((child) => (
                                      <div key={child.title}>
                                        <div className="text-xs font-medium text-foreground">
                                          {child.title}
                                        </div>
                                        {child.children.length ? (
                                          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                            {child.children.map((leaf) => (
                                              <div key={leaf}>{leaf}</div>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))
                                  : null}
                              </div>
                            </div>
                            <div
                              className="h-[3px] w-12 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="relative flex min-h-[380px] items-center justify-center">
                      <div className="absolute inset-y-8 left-1/2 w-px bg-border/70" />
                      <div className="relative z-10 w-full rounded-2xl border border-primary/30 bg-gradient-brand px-4 py-5 text-center text-white shadow-glow">
                        <Network className="mx-auto mb-2 h-5 w-5" />
                        <div className="text-sm font-semibold leading-snug">{mindMap.central}</div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {rightMindMapEntries.map(({ branch, index }) => {
                        const color = mindMapColors[index % mindMapColors.length];
                        const open = expandedBranch === index;
                        return (
                          <div key={branch.title} className="flex items-center gap-3">
                            <div
                              className="h-[3px] w-12 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <div
                              onMouseEnter={() => setExpandedBranch(index)}
                              onMouseLeave={() => setExpandedBranch(null)}
                              className={
                                "w-full max-w-[270px] rounded-xl border bg-card p-3 shadow-soft transition-all " +
                                (open ? "-translate-y-0.5 shadow-card" : "hover:-translate-y-0.5")
                              }
                              style={{ borderColor: open ? color : `${color}66` }}
                            >
                              <div className="mb-2 flex items-center gap-2 border-b border-border/70 pb-2 text-sm font-semibold">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                                {branch.title}
                              </div>
                              <div className="space-y-2">
                                {branch.children.length
                                  ? branch.children.map((child) => (
                                      <div key={child.title}>
                                        <div className="text-xs font-medium text-foreground">
                                          {child.title}
                                        </div>
                                        {child.children.length ? (
                                          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                                            {child.children.map((leaf) => (
                                              <div key={leaf}>{leaf}</div>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))
                                  : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "perguntas" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <FileQuestion className="h-3 w-3 text-primary" />
                  Perguntas e respostas
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Revisao da aula</h2>
              </div>
              {studyQuestions.length ? (
                <div className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {studyQuestions.length} perguntas
                </div>
              ) : null}
            </div>

            {studyQuestionGroups.length ? (
              studyQuestionGroups.map((group, groupIndex) => {
                const visual = studyQuestionVisual(group.difficulty, groupIndex);
                return (
                  <section
                    key={group.difficulty}
                    className={cn("space-y-3 rounded-2xl border p-4", visual.section)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", visual.dot)} />
                        <div className="text-sm font-semibold">{group.difficulty}</div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          visual.badge,
                        )}
                      >
                        {group.questions.length} pergunta
                        {group.questions.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {group.questions.map((item, index) => (
                        <article
                          key={`${group.difficulty}-${index}-${item.question}`}
                          className={cn(
                            "rounded-2xl border p-4 shadow-soft transition hover:shadow-card",
                            visual.card,
                          )}
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "grid h-7 w-7 place-items-center rounded-lg text-xs font-semibold",
                                visual.counter,
                              )}
                            >
                              {index + 1}
                            </span>
                            {item.focus ? (
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                                {item.focus}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-sm font-semibold leading-relaxed">
                            {item.question}
                          </div>
                          {item.answer ? (
                            <div
                              className={cn(
                                "mt-3 rounded-xl border px-3 py-2 text-sm leading-relaxed text-foreground/80",
                                visual.answer,
                              )}
                            >
                              {item.answer}
                            </div>
                          ) : null}
                          {item.reviewTip ? (
                            <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                              <span className="font-medium text-foreground/80">Como revisar: </span>
                              {item.reviewTip}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
                {materialsLoading ? "Carregando perguntas..." : "Perguntas ainda nao geradas."}
              </div>
            )}
          </div>
        )}

        {tab === "acoes" && (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Acoes e proximos passos
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Tarefas concretas para a proxima etapa
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {actionItemCards.length} acoes
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {actionItemSummary.high} alta prioridade
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {actionItemSummary.medium} media prioridade
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {actionItemSummary.low} baixa prioridade
                </span>
              </div>
            </div>

            {actionItemCards.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {actionItemCards.map((item, i) => {
                  const visual = actionPriorityVisual(item.priority);
                  return (
                    <article
                      key={`${item.title}-${i}`}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border border-border bg-background p-4 pl-5 transition-all hover:-translate-y-0.5 hover:shadow-card",
                        visual.shell,
                      )}
                    >
                      <span className={cn("absolute inset-y-0 left-0 w-1", visual.strip)} />
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          {item.order ?? i + 1}
                        </span>
                        {item.priority ? (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              visual.badge,
                            )}
                          >
                            Prioridade {item.priority}
                          </span>
                        ) : null}
                        {item.category ? (
                          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                            {item.category}
                          </span>
                        ) : null}
                      </div>

                      <div className="text-sm font-semibold leading-relaxed text-foreground">
                        {item.title}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {item.owner ? (
                          <div className="rounded-xl border border-border bg-card px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              Responsavel
                            </div>
                            <div className="mt-1 text-sm text-foreground">{item.owner}</div>
                          </div>
                        ) : null}
                        {item.criterion ? (
                          <div className="rounded-xl border border-border bg-card px-3 py-2">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              Criterio
                            </div>
                            <div className="mt-1 text-sm text-foreground">{item.criterion}</div>
                          </div>
                        ) : null}
                      </div>

                      {item.reason ? (
                        <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-card px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                          <span className="font-medium text-foreground/80">Por que importa: </span>
                          {item.reason}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : actionItems.length ? (
              <ol className="space-y-2.5">
                {actionItems.map((item, i) => (
                  <li
                    key={i}
                    className="group flex gap-3 rounded-xl border border-border bg-background p-3.5 transition-all hover:border-primary/40 hover:shadow-soft hover:-translate-y-0.5 cursor-default"
                  >
                    <span className="h-6 w-6 grid place-items-center rounded-md bg-primary/10 text-primary text-xs font-semibold shrink-0 group-hover:bg-gradient-brand group-hover:text-white transition-all">
                      {i + 1}
                    </span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-muted-foreground">
                {materialsLoading ? "Carregando acoes..." : "Acoes ainda nao geradas."}
              </div>
            )}
          </div>
        )}

        {tab === "handoff" && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Handoff executivo
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Resumo pronto para repassar
                </h2>
              </div>
            </div>
            <MarkdownishText
              content={executiveHandoffText}
              emptyText={materialsLoading ? "Carregando handoff..." : "Handoff ainda nao gerado."}
            />
          </div>
        )}

        {tab === "respostas" && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Respostas sugeridas
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Guia curto para responder melhor
                </h2>
              </div>
            </div>
            <MarkdownishText
              content={suggestedResponsesText}
              emptyText={
                materialsLoading
                  ? "Carregando respostas..."
                  : "Respostas sugeridas ainda nao geradas."
              }
            />
          </div>
        )}

        {tab === "comercial" && (
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-soft">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Brief comercial
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Oportunidades, objecoes e follow-ups
                </h2>
              </div>
            </div>
            <MarkdownishText
              content={commercialBriefText}
              emptyText={
                materialsLoading
                  ? "Carregando brief comercial..."
                  : "Brief comercial ainda nao gerado."
              }
            />
          </div>
        )}
        {tab === "chat" && (
          <div className="space-y-3">
            {liveAssistantSnapshot ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Assistente ao vivo
                    </div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      Conversa capturada durante a aula
                    </h2>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                    {liveAssistantSnapshot.messages.length} mensagens
                  </span>
                </div>
                <div className="space-y-2">
                  {liveAssistantSnapshot.messages.map((message) => (
                    <div
                      key={message.id ?? `${message.role}-${message.content.slice(0, 20)}`}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-sm",
                        message.role === "user"
                          ? "ml-8 border-primary/20 bg-primary/10"
                          : "mr-8 border-border bg-background",
                      )}
                    >
                      <div className="mb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        {message.role === "user" ? "Voce" : "Assistente"}
                      </div>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {chatLoading ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Carregando chat...
              </div>
            ) : null}
            {chatError ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-destructive">
                {chatError}
              </div>
            ) : null}
            {!chatLoading && !chatError && chatMessages.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Nenhuma mensagem enviada nesta sessao.
              </div>
            ) : null}
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={
                  "transition-all hover:-translate-y-0.5 " +
                  (m.role === "USER"
                    ? "ml-8 rounded-2xl bg-primary/10 px-4 py-3 text-sm hover:bg-primary/15"
                    : "mr-8 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-soft hover:shadow-card")
                }
              >
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
                  {m.role === "USER"
                    ? "Usuario"
                    : m.role === "ASSISTANT"
                      ? "Assistente"
                      : "Sistema"}
                </div>
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
