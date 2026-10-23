import {
  evaluateLiveRelevance,
  type LiveRelevanceCategory,
  type LiveResponseTone,
} from "./live-relevance";

export type SessionSignalType =
  | "pain_point"
  | "important_question"
  | "objection"
  | "opportunity"
  | "decision"
  | "task"
  | "follow_up"
  | "risk";

export type SessionSignalActionKind =
  | "respond_objection"
  | "schedule_follow_up"
  | "create_task"
  | "generate_executive_summary"
  | "prepare_commercial_response"
  | "register_crm_opportunity";

export type SessionSignalPriority = "high" | "medium" | "low";

export type SessionSignalSegment = {
  id: string;
  speakerName: string;
  text: string;
  confidence?: number;
  clarity?: number;
  conviction?: number;
  technicalTerms?: string[];
  createdAt?: number;
  offsetMs?: number;
};

export type SessionSignal = {
  id: string;
  type: SessionSignalType;
  sourceCategory: LiveRelevanceCategory;
  themeId: string;
  themeLabel: string;
  speakerName: string;
  excerpt: string;
  score: number;
  reason: string;
  suggestedAction?: string;
  timestampMs?: number;
  recurrence: number;
  keywords: string[];
  recommendedResponse?: string;
  responseReason?: string;
  responseConfidence?: number;
  responseTone?: LiveResponseTone;
  nextQuestion?: string;
};

export type SessionSignalGroup = {
  id: string;
  label: string;
  primaryType: SessionSignalType;
  signalIds: string[];
  score: number;
  recurrence: number;
  excerpt: string;
  summary: string;
  firstTimestampMs?: number;
  lastTimestampMs?: number;
};

export type SessionSignalActionSuggestion = {
  id: string;
  kind: SessionSignalActionKind;
  title: string;
  description: string;
  priority: SessionSignalPriority;
  basedOnSignalIds: string[];
};

export type SessionSignalSnapshot = {
  version: 1;
  generatedAt: string;
  signals: SessionSignal[];
  groups: SessionSignalGroup[];
  actionSuggestions: SessionSignalActionSuggestion[];
};

export type SessionSignalInsightItem = {
  id: string;
  title: string;
  detail: string;
  excerpt: string;
  score: number;
  themeLabel: string;
  timestampMs?: number;
  suggestedAction?: string;
};

export type SessionSignalIntelligence = {
  pains: SessionSignalInsightItem[];
  recurringQuestions: SessionSignalInsightItem[];
  objections: SessionSignalInsightItem[];
  opportunities: SessionSignalInsightItem[];
  decisions: SessionSignalInsightItem[];
  tasks: SessionSignalInsightItem[];
  followUps: SessionSignalInsightItem[];
  risks: SessionSignalInsightItem[];
  suggestedResponses: Array<{
    id: string;
    title: string;
    response: string;
    reason: string;
    tone?: LiveResponseTone;
    confidence?: number;
    nextQuestion?: string;
  }>;
  nextSteps: SessionSignalActionSuggestion[];
};

export const sessionSignalTypeLabels: Record<SessionSignalType, string> = {
  pain_point: "Dores detectadas",
  important_question: "Duvidas recorrentes",
  objection: "Objecoes",
  opportunity: "Oportunidades",
  decision: "Decisoes",
  task: "Tarefas",
  follow_up: "Follow-ups",
  risk: "Riscos",
};

const stopWords = new Set([
  "a",
  "o",
  "os",
  "as",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "por",
  "com",
  "sem",
  "na",
  "no",
  "nas",
  "nos",
  "que",
  "como",
  "mais",
  "menos",
  "muito",
  "muita",
  "muitas",
  "muitos",
  "isso",
  "essa",
  "esse",
  "esta",
  "este",
  "essa",
  "agora",
  "depois",
  "antes",
  "sobre",
  "porque",
  "quando",
  "onde",
  "qual",
  "quais",
  "uma",
  "um",
  "uns",
  "umas",
  "sera",
  "seria",
  "vamos",
  "precisa",
  "precisamos",
  "fazer",
  "feito",
  "ficou",
  "ponto",
  "trecho",
  "aula",
  "sessao",
  "reuniao",
  "chamada",
]);

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function compactText(value: string, limit = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized
    .slice(0, limit)
    .replace(/\s+\S*$/, "")
    .trim()}...`;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceFragments(text: string) {
  return text
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length >= 20);
}

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function keywordTokens(text: string, technicalTerms: string[] = []) {
  const tokens = normalize(text)
    .split(" ")
    .filter((token) => token.length >= 4 && !stopWords.has(token));
  const fromTerms = technicalTerms
    .map((term) => normalize(term))
    .flatMap((term) => term.split(" "))
    .filter((token) => token.length >= 4 && !stopWords.has(token));
  return uniqueBy([...fromTerms, ...tokens], (token) => token).slice(0, 8);
}

function titleFromKeywords(keywords: string[], fallback: string) {
  if (keywords.length >= 2) {
    return keywords
      .slice(0, 2)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" - ");
  }
  if (keywords[0]) {
    return keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1);
  }
  return compactText(fallback, 42);
}

function overlaps(a: string[], b: string[]) {
  const set = new Set(a);
  return b.filter((token) => set.has(token)).length;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.trim().length ? value.trim() : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function inferSignalType(
  category: LiveRelevanceCategory,
  text: string,
): SessionSignalType | undefined {
  const normalized = normalize(text);
  const followUp =
    /\b(follow up|follow-up|retornar|voltar a falar|marcar outra|proxima conversa|proximo contato|agendar)\b/.test(
      normalized,
    );
  const objection =
    /\b(caro|receio|nao sei se|nao tenho certeza|nao faz sentido|resistencia|objecao|obje\w+|agora nao|preciso pensar)\b/.test(
      normalized,
    );
  const opportunity =
    /\b(oportunidade|ganho|upsell|cross sell|cross-sell|avancar|expandir|automatizar|escala|crm|proposta|comercial)\b/.test(
      normalized,
    );
  const pain =
    /\b(dor|problema|dificuldade|retrabalho|demora|lento|perder informacao|perda de informacao|travado|ruim|manual)\b/.test(
      normalized,
    );

  if (followUp && ["decision", "task", "risk", "highlight"].includes(category)) {
    return "follow_up";
  }
  if (category === "decision") return "decision";
  if (category === "task") return "task";
  if (category === "question") return "important_question";
  if (category === "risk") {
    if (objection) return "objection";
    if (pain) return "pain_point";
    if (followUp) return "follow_up";
    return "risk";
  }
  if (category === "highlight") {
    if (opportunity) return "opportunity";
    if (pain) return "pain_point";
    if (followUp) return "follow_up";
  }
  return undefined;
}

function signalPriority(score: number): SessionSignalPriority {
  if (score >= 0.78) return "high";
  if (score >= 0.58) return "medium";
  return "low";
}

function actionForType(type: SessionSignalType) {
  switch (type) {
    case "objection":
      return {
        kind: "respond_objection" as const,
        title: "Responder objecao prioritária",
        description:
          "Monte uma resposta comercial ou consultiva para reduzir a friccao antes do proximo contato.",
      };
    case "follow_up":
      return {
        kind: "schedule_follow_up" as const,
        title: "Marcar follow-up",
        description:
          "Agende o proximo contato enquanto o contexto ainda esta fresco e com dono definido.",
      };
    case "opportunity":
      return {
        kind: "register_crm_opportunity" as const,
        title: "Registrar oportunidade futura no CRM",
        description:
          "Transforme o sinal de oportunidade em registro comercial estruturado para nao se perder depois.",
      };
    case "decision":
      return {
        kind: "generate_executive_summary" as const,
        title: "Gerar resumo executivo",
        description:
          "Consolide a decisao, o motivo e o impacto para compartilhar com quem nao participou da sessao.",
      };
    case "task":
      return {
        kind: "create_task" as const,
        title: "Criar tarefa no sistema",
        description: "Converta o combinado em tarefa com dono, prazo e criterio de conclusao.",
      };
    case "pain_point":
    case "important_question":
    case "risk":
    default:
      return {
        kind: "prepare_commercial_response" as const,
        title: "Preparar resposta pratica",
        description:
          "Organize uma resposta objetiva baseada nos sinais mais fortes antes do proximo passo.",
      };
  }
}

export function buildSessionSignalSnapshot(args: {
  sessionTitle?: string;
  sessionType?: string;
  audience?: string;
  objectives?: string;
  segments: SessionSignalSegment[];
}): SessionSignalSnapshot {
  const signals: SessionSignal[] = [];

  for (const segment of args.segments) {
    const fragments = sentenceFragments(segment.text).length
      ? sentenceFragments(segment.text)
      : [segment.text.trim()].filter((text) => text.length >= 20);
    const contextWindow = args.segments
      .filter((candidate) => {
        const currentOffset = segment.offsetMs ?? segment.createdAt ?? 0;
        const candidateOffset = candidate.offsetMs ?? candidate.createdAt ?? 0;
        return Math.abs(candidateOffset - currentOffset) <= 90_000;
      })
      .map((candidate) => candidate.text)
      .slice(-6);

    fragments.forEach((fragment, index) => {
      const relevance = evaluateLiveRelevance({
        terms: segment.technicalTerms ?? keywordTokens(fragment),
        highlights: [fragment],
        interimTranscript: fragment,
        metrics: {
          confidence: segment.confidence,
          clarity: segment.clarity,
          conviction: segment.conviction,
        },
        context: {
          sessionTitle: args.sessionTitle,
          sessionType: args.sessionType,
          audience: args.audience,
          objectives: args.objectives,
          activeSpeaker: segment.speakerName,
          recentSegments: contextWindow,
        },
      });
      const top = relevance.topInsight ?? relevance.evaluations[0];
      if (!top || top.category === "noise" || top.relevanceScore < 0.46) return;

      const type = inferSignalType(top.category, fragment);
      if (!type) return;

      const keywords = keywordTokens(fragment, segment.technicalTerms ?? []);
      const themeLabel = titleFromKeywords(keywords, fragment);
      signals.push({
        id: `${segment.id}_${index}`,
        type,
        sourceCategory: top.category,
        themeId: normalize(themeLabel).replace(/\s+/g, "-"),
        themeLabel,
        speakerName: segment.speakerName,
        excerpt: compactText(fragment, 180),
        score: clamp01(top.relevanceScore),
        reason: top.reason,
        suggestedAction: top.suggestedAction,
        timestampMs: segment.offsetMs ?? segment.createdAt,
        recurrence: top.recurrence,
        keywords,
        recommendedResponse: relevance.responseSuggestion?.response,
        responseReason: relevance.responseSuggestion?.reason,
        responseConfidence: relevance.responseSuggestion?.confidence,
        responseTone: relevance.responseSuggestion?.tone,
        nextQuestion: relevance.responseSuggestion?.nextQuestion,
      });
    });
  }

  const dedupedSignals = uniqueBy(
    signals
      .sort((a, b) => {
        if ((b.score ?? 0) !== (a.score ?? 0)) return b.score - a.score;
        return (a.timestampMs ?? 0) - (b.timestampMs ?? 0);
      })
      .filter((signal) => signal.excerpt.length >= 20),
    (signal) => `${signal.type}:${normalize(signal.excerpt)}`,
  );

  const groups: Array<SessionSignalGroup & { keywords: string[]; types: SessionSignalType[] }> = [];
  for (const signal of dedupedSignals) {
    const existing = groups.find((group) => {
      const overlap = overlaps(group.keywords, signal.keywords);
      return overlap >= 2 || (group.primaryType === signal.type && overlap >= 1);
    });

    if (existing) {
      existing.signalIds.push(signal.id);
      existing.keywords = uniqueBy([...existing.keywords, ...signal.keywords], (token) => token);
      existing.types.push(signal.type);
      existing.recurrence += 1;
      existing.score = clamp01((existing.score + signal.score) / 2);
      existing.summary = compactText(`${existing.summary} ${signal.excerpt}`, 180);
      existing.lastTimestampMs = signal.timestampMs ?? existing.lastTimestampMs;
      continue;
    }

    groups.push({
      id: `group_${groups.length + 1}`,
      label: signal.themeLabel,
      primaryType: signal.type,
      signalIds: [signal.id],
      score: signal.score,
      recurrence: 1,
      excerpt: signal.excerpt,
      summary: compactText(signal.excerpt, 180),
      firstTimestampMs: signal.timestampMs,
      lastTimestampMs: signal.timestampMs,
      keywords: [...signal.keywords],
      types: [signal.type],
    });
  }

  const actionSuggestions = uniqueBy(
    groups
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((group, index) => {
        const action = actionForType(group.primaryType);
        return {
          id: `action_${index + 1}`,
          kind: action.kind,
          title: action.title,
          description: `${action.description} Tema em foco: ${group.label}.`,
          priority: signalPriority(group.score),
          basedOnSignalIds: group.signalIds,
        } satisfies SessionSignalActionSuggestion;
      }),
    (item) => item.kind,
  );

  if (
    dedupedSignals.length &&
    !actionSuggestions.some((item) => item.kind === "generate_executive_summary")
  ) {
    actionSuggestions.push({
      id: `action_${actionSuggestions.length + 1}`,
      kind: "generate_executive_summary",
      title: "Gerar resumo executivo",
      description:
        "Consolide os sinais fortes da sessao em um fechamento curto para alinhamento interno.",
      priority: "medium",
      basedOnSignalIds: dedupedSignals.slice(0, 3).map((signal) => signal.id),
    });
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    signals: dedupedSignals,
    groups: groups.map(({ keywords: _keywords, types: _types, ...group }) => group),
    actionSuggestions,
  };
}

function isSessionSignal(value: SessionSignal | undefined): value is SessionSignal {
  return Boolean(value);
}

function isSessionSignalGroup(value: SessionSignalGroup | undefined): value is SessionSignalGroup {
  return Boolean(value);
}

function isSessionSignalActionSuggestion(
  value: SessionSignalActionSuggestion | undefined,
): value is SessionSignalActionSuggestion {
  return Boolean(value);
}

export function sessionSignalSnapshotFromMetadata(
  metadata?: Record<string, unknown>,
): SessionSignalSnapshot | undefined {
  const root = asObject(metadata);
  const raw = asObject(root?.sessionSignals);
  if (!raw) return undefined;
  const signals: SessionSignal[] = Array.isArray(raw.signals)
    ? raw.signals
        .map<SessionSignal | undefined>((item) => {
          const value = asObject(item);
          if (!value) return undefined;
          const id = stringOrUndefined(value.id);
          const type = stringOrUndefined(value.type) as SessionSignalType | undefined;
          const sourceCategory = stringOrUndefined(value.sourceCategory) as
            | LiveRelevanceCategory
            | undefined;
          const excerpt = stringOrUndefined(value.excerpt);
          const themeId = stringOrUndefined(value.themeId);
          const themeLabel = stringOrUndefined(value.themeLabel);
          const speakerName = stringOrUndefined(value.speakerName);
          const reason = stringOrUndefined(value.reason);
          if (
            !id ||
            !type ||
            !sourceCategory ||
            !excerpt ||
            !themeId ||
            !themeLabel ||
            !speakerName ||
            !reason
          ) {
            return undefined;
          }
          return {
            id,
            type,
            sourceCategory,
            themeId,
            themeLabel,
            speakerName,
            excerpt,
            score: clamp01(numberOrUndefined(value.score) ?? 0),
            reason,
            suggestedAction: stringOrUndefined(value.suggestedAction),
            timestampMs: numberOrUndefined(value.timestampMs),
            recurrence: Math.max(1, numberOrUndefined(value.recurrence) ?? 1),
            keywords: stringArray(value.keywords),
            recommendedResponse: stringOrUndefined(value.recommendedResponse),
            responseReason: stringOrUndefined(value.responseReason),
            responseConfidence: numberOrUndefined(value.responseConfidence),
            responseTone: stringOrUndefined(value.responseTone) as LiveResponseTone | undefined,
            nextQuestion: stringOrUndefined(value.nextQuestion),
          } satisfies SessionSignal;
        })
        .filter(isSessionSignal)
    : [];
  const groups: SessionSignalGroup[] = Array.isArray(raw.groups)
    ? raw.groups
        .map<SessionSignalGroup | undefined>((item) => {
          const value = asObject(item);
          if (!value) return undefined;
          const id = stringOrUndefined(value.id);
          const label = stringOrUndefined(value.label);
          const primaryType = stringOrUndefined(value.primaryType) as SessionSignalType | undefined;
          if (!id || !label || !primaryType) return undefined;
          return {
            id,
            label,
            primaryType,
            signalIds: stringArray(value.signalIds),
            score: clamp01(numberOrUndefined(value.score) ?? 0),
            recurrence: Math.max(1, numberOrUndefined(value.recurrence) ?? 1),
            excerpt: stringOrUndefined(value.excerpt) ?? "",
            summary: stringOrUndefined(value.summary) ?? "",
            firstTimestampMs: numberOrUndefined(value.firstTimestampMs),
            lastTimestampMs: numberOrUndefined(value.lastTimestampMs),
          } satisfies SessionSignalGroup;
        })
        .filter(isSessionSignalGroup)
    : [];
  const actionSuggestions: SessionSignalActionSuggestion[] = Array.isArray(raw.actionSuggestions)
    ? raw.actionSuggestions
        .map<SessionSignalActionSuggestion | undefined>((item) => {
          const value = asObject(item);
          if (!value) return undefined;
          const id = stringOrUndefined(value.id);
          const kind = stringOrUndefined(value.kind) as SessionSignalActionKind | undefined;
          const title = stringOrUndefined(value.title);
          const description = stringOrUndefined(value.description);
          const priority = stringOrUndefined(value.priority) as SessionSignalPriority | undefined;
          if (!id || !kind || !title || !description || !priority) return undefined;
          return {
            id,
            kind,
            title,
            description,
            priority,
            basedOnSignalIds: stringArray(value.basedOnSignalIds),
          } satisfies SessionSignalActionSuggestion;
        })
        .filter(isSessionSignalActionSuggestion)
    : [];

  return signals.length || groups.length || actionSuggestions.length
    ? {
        version: 1,
        generatedAt: stringOrUndefined(raw.generatedAt) ?? new Date().toISOString(),
        signals,
        groups,
        actionSuggestions,
      }
    : undefined;
}

function insightItem(signal: SessionSignal): SessionSignalInsightItem {
  return {
    id: signal.id,
    title: signal.themeLabel,
    detail: signal.reason,
    excerpt: signal.excerpt,
    score: signal.score,
    themeLabel: signal.themeLabel,
    timestampMs: signal.timestampMs,
    suggestedAction: signal.suggestedAction,
  };
}

export function buildSessionSignalIntelligence(
  snapshot?: SessionSignalSnapshot,
): SessionSignalIntelligence {
  const signals = snapshot?.signals ?? [];

  const byType = (type: SessionSignalType) =>
    signals
      .filter((signal) => signal.type === type)
      .map(insightItem)
      .slice(0, 6);

  return {
    pains: byType("pain_point"),
    recurringQuestions: byType("important_question"),
    objections: byType("objection"),
    opportunities: byType("opportunity"),
    decisions: byType("decision"),
    tasks: byType("task"),
    followUps: byType("follow_up"),
    risks: byType("risk"),
    suggestedResponses: signals
      .filter((signal) => signal.recommendedResponse)
      .slice(0, 6)
      .map((signal) => ({
        id: signal.id,
        title: signal.themeLabel,
        response: signal.recommendedResponse ?? "",
        reason: signal.responseReason ?? signal.reason,
        tone: signal.responseTone,
        confidence: signal.responseConfidence,
        nextQuestion: signal.nextQuestion,
      })),
    nextSteps: snapshot?.actionSuggestions ?? [],
  };
}

export function sessionSignalsContextLines(snapshot?: SessionSignalSnapshot) {
  if (!snapshot || snapshot.signals.length === 0) return [] as string[];

  const topGroups = snapshot.groups
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(
      (group) =>
        `${sessionSignalTypeLabels[group.primaryType]}: ${group.label} (score ${Math.round(group.score * 100)}%, recorrencia ${group.recurrence})`,
    );
  const nextSteps = snapshot.actionSuggestions
    .slice(0, 4)
    .map((action) => `${action.title}: ${action.description}`);

  return [
    `Persisted strong signals count: ${snapshot.signals.length}`,
    ...topGroups,
    ...nextSteps.map((item) => `Suggested next step: ${item}`),
  ];
}
