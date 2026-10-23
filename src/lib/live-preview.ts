type MetricValue = number | undefined;

import {
  evaluateLiveRelevance,
  type LiveRelevanceCategory,
  type LiveRelevanceContext,
  type LiveResponseSuggestion,
} from "./live-relevance";

export type LivePreviewSegmentLike = {
  speakerName: string;
  text: string;
  confidence?: number;
  clarity?: number;
  conviction?: number;
};

export type LivePreviewInsightsLike = {
  terms: string[];
  importantPoints: string[];
  transcriptionIssues: string[];
  languageIssues: string[];
};

export type LivePreviewMetric = {
  id: "confidence" | "clarity" | "conviction";
  label: string;
  value?: number;
  tone: "good" | "medium" | "attention";
};

export type LivePreviewRelevantInsight = {
  id: string;
  category: LiveRelevanceCategory;
  text: string;
  relevanceScore: number;
  reason: string;
  suggestedAction?: string;
};

export type LivePreviewDashboard = {
  headline: string;
  liveLine: string;
  liveLabel: string;
  insightSummary: string;
  suggestedQuestion?: string;
  highlights: string[];
  terms: string[];
  alerts: string[];
  metrics: LivePreviewMetric[];
  relevantInsights: LivePreviewRelevantInsight[];
  topCategory?: LiveRelevanceCategory;
  topRelevanceScore?: number;
  responseSuggestion?: LiveResponseSuggestion;
};

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function averageMetric(values: MetricValue[]) {
  const normalized = values.filter((value): value is number => typeof value === "number");
  if (!normalized.length) return undefined;
  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
}

function compactText(value: string, limit = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized
    .slice(0, limit)
    .replace(/\s+\S*$/, "")
    .trim()}...`;
}

function metricTone(value?: number): LivePreviewMetric["tone"] {
  if (value === undefined) return "medium";
  if (value >= 0.72) return "good";
  if (value >= 0.5) return "medium";
  return "attention";
}

function suggestedQuestionFromInsights(
  terms: string[],
  highlights: string[],
  responseSuggestion?: LiveResponseSuggestion,
) {
  if (responseSuggestion?.nextQuestion) {
    return responseSuggestion.nextQuestion;
  }

  if (terms[0]) {
    return `Peca um exemplo pratico sobre ${terms[0]}.`;
  }

  if (highlights[0]) {
    return `Aprofunde este ponto: ${compactText(highlights[0], 72)}.`;
  }

  return undefined;
}

export function buildLivePreviewDashboard(args: {
  recording: boolean;
  activeSpeaker: string;
  segments: LivePreviewSegmentLike[];
  interimTranscript: string;
  insights: LivePreviewInsightsLike;
  context?: LiveRelevanceContext;
}): LivePreviewDashboard {
  const { recording, activeSpeaker, segments, interimTranscript, insights, context } = args;
  const trimmedInterim = interimTranscript.trim();
  const lastSegment = segments.at(-1);
  const highlights = insights.importantPoints.filter(Boolean).slice(0, 3);
  const terms = insights.terms.filter(Boolean).slice(0, 6);
  const alerts = [...insights.transcriptionIssues, ...insights.languageIssues]
    .filter(Boolean)
    .slice(0, 3);

  const confidence = averageMetric(segments.map((segment) => segment.confidence));
  const clarity = averageMetric(segments.map((segment) => segment.clarity));
  const conviction = averageMetric(segments.map((segment) => segment.conviction));
  const relevance = evaluateLiveRelevance({
    terms,
    highlights,
    interimTranscript: trimmedInterim,
    metrics: {
      confidence,
      clarity,
      conviction,
    },
    context: {
      activeSpeaker,
      recentSegments: segments.slice(-6).map((segment) => segment.text),
      transcriptionIssues: insights.transcriptionIssues,
      languageIssues: insights.languageIssues,
      ...context,
    },
  });
  const relevantInsights = relevance.evaluations
    .filter((item) => item.relevanceScore >= 0.42)
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      category: item.category,
      text: item.text,
      relevanceScore: item.relevanceScore,
      reason: item.reason,
      suggestedAction: item.suggestedAction,
    }));
  const topInsight = relevance.topInsight;

  const liveLine = trimmedInterim || lastSegment?.text || "";
  const headline = topInsight?.text
    ? compactText(topInsight.text, 88)
    : highlights[0]
      ? compactText(highlights[0], 88)
      : terms[0]
        ? `Termo em foco: ${terms[0]}`
        : recording
          ? "Escutando a aula em tempo real"
          : "Preview ao vivo pausado";

  const insightSummary = topInsight?.reason
    ? compactText(topInsight.reason, 130)
    : highlights[1]
      ? compactText(highlights[1], 130)
      : lastSegment
        ? compactText(lastSegment.text, 130)
        : recording
          ? "Quando a fala comecar, o sistema destaca sinais mais relevantes, termos tecnicos e possiveis proximos passos."
          : "Retome a gravacao para voltar a ver a transcricao viva e os sinais locais.";

  const liveLabel = trimmedInterim
    ? `${activeSpeaker} falando agora`
    : lastSegment
      ? `Ultimo trecho de ${lastSegment.speakerName}`
      : recording
        ? "Aguardando fala"
        : "Captura pausada";

  return {
    headline,
    liveLine: liveLine ? compactText(liveLine, 220) : "",
    liveLabel,
    insightSummary,
    suggestedQuestion: suggestedQuestionFromInsights(
      terms,
      topInsight ? [topInsight.text, ...highlights] : highlights,
      relevance.responseSuggestion,
    ),
    highlights,
    terms,
    alerts,
    relevantInsights,
    topCategory: topInsight?.category,
    topRelevanceScore: topInsight?.relevanceScore,
    responseSuggestion: relevance.responseSuggestion,
    metrics: [
      {
        id: "confidence",
        label: "Confianca",
        value: confidence === undefined ? undefined : clamp01(confidence),
        tone: metricTone(confidence),
      },
      {
        id: "clarity",
        label: "Clareza",
        value: clarity === undefined ? undefined : clamp01(clarity),
        tone: metricTone(clarity),
      },
      {
        id: "conviction",
        label: "Conviccao",
        value: conviction === undefined ? undefined : clamp01(conviction),
        tone: metricTone(conviction),
      },
    ],
  };
}
