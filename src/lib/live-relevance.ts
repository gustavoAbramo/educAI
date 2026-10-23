type MetricValue = number | undefined;

export type LiveRelevanceCategory =
  | "question"
  | "task"
  | "decision"
  | "risk"
  | "highlight"
  | "noise";

export type LiveResponseTone = "consultivo" | "direto" | "acolhedor" | "tecnico" | "comercial";

export type LiveRelevanceContext = {
  sessionTitle?: string;
  sessionType?: string;
  audience?: string;
  objectives?: string;
  activeSpeaker?: string;
  recentSegments?: string[];
  transcriptionIssues?: string[];
  languageIssues?: string[];
};

export type LiveRelevanceEvaluation = {
  id: string;
  category: LiveRelevanceCategory;
  text: string;
  relevanceScore: number;
  reason: string;
  recurrence: number;
  suggestedAction?: string;
};

export type LiveResponseSuggestion = {
  relatedSignal: string;
  response: string;
  reason: string;
  confidence: number;
  tone: LiveResponseTone;
  nextQuestion?: string;
};

export type LiveRelevanceResult = {
  evaluations: LiveRelevanceEvaluation[];
  topInsight?: LiveRelevanceEvaluation;
  responseSuggestion?: LiveResponseSuggestion;
};

type LiveRelevanceCandidate = {
  id: string;
  text: string;
  source: "interim" | "highlight" | "transcription_issue" | "language_issue";
};

function clamp01(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function compactText(value: string, limit = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized
    .slice(0, limit)
    .replace(/\s+\S*$/, "")
    .trim()}...`;
}

function average(values: MetricValue[]) {
  const numeric = values.filter((value): value is number => typeof value === "number");
  if (!numeric.length) return undefined;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function normalizeForMatch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTerms(terms: string[]) {
  return terms.map((term) => normalizeForMatch(term)).filter(Boolean);
}

function sentenceFragments(text: string) {
  return text
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueCandidates(candidates: LiveRelevanceCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = normalizeForMatch(candidate.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractKeywordPhrases(text: string) {
  const normalized = normalizeForMatch(text);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter((word) => word.length >= 4)
    .slice(0, 8);
}

function recurrenceForText(text: string, corpus: string[], terms: string[]) {
  const keywords = [...extractKeywordPhrases(text), ...terms].filter(Boolean);
  if (!keywords.length) return 1;

  let matches = 0;
  for (const entry of corpus) {
    const normalized = normalizeForMatch(entry);
    if (!normalized) continue;
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      matches += 1;
    }
  }

  return Math.max(1, matches);
}

function classifyText(
  text: string,
  source: LiveRelevanceCandidate["source"],
): {
  category: LiveRelevanceCategory;
  reasonParts: string[];
  suggestedAction?: string;
} {
  const normalized = normalizeForMatch(text);
  const reasonParts: string[] = [];

  const hasQuestion =
    text.includes("?") ||
    /\b(como|por que|porque|qual|quais|quando|onde|sera|seria|duvida|duvidas|nao entendi)\b/i.test(
      normalized,
    );
  const hasDecision =
    /\b(decidimos|decisao|decisão|ficou combinado|vamos seguir|aprovado|fechado|definimos|vai ser|sera feito)\b/i.test(
      normalized,
    );
  const hasTask =
    /\b(precisa|precisamos|vou|vamos|ficou de|tarefa|enviar|revisar|corrigir|ajustar|fazer|entregar|registrar|acompanhar)\b/i.test(
      normalized,
    );
  const hasRisk =
    source === "transcription_issue" ||
    /\b(risco|problema|falha|travado|bloqueio|bloqueado|nao consigo|nao estamos conseguindo|dificuldade|erro|inseguro|incerteza|objecao|objeção|caro|demorado)\b/i.test(
      normalized,
    );
  const isNoise =
    source === "language_issue" ||
    normalized.length < 18 ||
    /\b(aham|uh|hum|tipo|ne|ok|ta|certo|beleza|entao)\b/i.test(normalized);

  if (hasDecision) {
    reasonParts.push("ha indicio explicito de decisao");
    return {
      category: "decision",
      reasonParts,
      suggestedAction:
        "Confirme a decisao, impacto e proximo responsavel enquanto o contexto esta fresco.",
    };
  }

  if (hasTask) {
    reasonParts.push("ha linguagem acionavel de proximo passo");
    return {
      category: "task",
      reasonParts,
      suggestedAction:
        "Transforme o ponto em tarefa com responsavel, prazo e criterio de conclusao.",
    };
  }

  if (hasQuestion) {
    reasonParts.push("a fala indica duvida ou pergunta explicita");
    return {
      category: "question",
      reasonParts,
      suggestedAction: "Responda de forma objetiva e confirme se a explicacao resolveu a duvida.",
    };
  }

  if (hasRisk) {
    reasonParts.push("ha linguagem de risco, objeção ou bloqueio");
    return {
      category: "risk",
      reasonParts,
      suggestedAction: "Aprofunde a causa do bloqueio e valide o impacto antes de seguir.",
    };
  }

  if (isNoise) {
    reasonParts.push(
      source === "language_issue"
        ? "o sinal veio de alerta de linguagem, nao de conteudo central"
        : "o trecho ainda tem pouco conteudo especifico",
    );
    return {
      category: "noise",
      reasonParts,
    };
  }

  reasonParts.push(
    "o trecho traz um ponto util, mas sem formato claro de pergunta, tarefa ou decisao",
  );
  return {
    category: "highlight",
    reasonParts,
    suggestedAction: "Explore esse ponto com um exemplo pratico ou evidencia adicional.",
  };
}

function scoreCategory(category: LiveRelevanceCategory) {
  switch (category) {
    case "decision":
      return 0.42;
    case "task":
      return 0.36;
    case "question":
      return 0.33;
    case "risk":
      return 0.34;
    case "highlight":
      return 0.22;
    case "noise":
    default:
      return 0.01;
  }
}

function signalStrength(metrics: { confidence?: number; clarity?: number; conviction?: number }) {
  return average([metrics.confidence, metrics.clarity, metrics.conviction]) ?? 0.52;
}

function contextAlignment(text: string, context: LiveRelevanceContext, terms: string[]) {
  const normalizedText = normalizeForMatch(text);
  const contextBits = [
    context.sessionTitle,
    context.sessionType,
    context.audience,
    context.objectives,
  ]
    .filter(Boolean)
    .map((value) => normalizeForMatch(value ?? ""));
  const termMatches = terms.filter((term) => normalizedText.includes(term)).length;
  const contextMatches = contextBits.filter((bit) => bit && normalizedText.includes(bit)).length;
  return clamp01(termMatches * 0.16 + contextMatches * 0.12);
}

function buildReason(
  category: LiveRelevanceCategory,
  recurrence: number,
  strength: number,
  reasonParts: string[],
) {
  const fragments = [...reasonParts];
  if (recurrence >= 3) fragments.push("o sinal se repetiu em mais de um momento da aula");
  if (strength >= 0.72)
    fragments.push("as metricas locais indicam boa confianca para destacar este trecho");
  if (category === "noise" && strength < 0.55) {
    fragments.push("as metricas ainda nao sustentam destaque alto");
  }
  return fragments.join("; ");
}

function buildResponseSuggestion(
  insight: LiveRelevanceEvaluation,
  context: LiveRelevanceContext,
): LiveResponseSuggestion | undefined {
  if (insight.category === "noise" || insight.relevanceScore < 0.45) return undefined;

  const sessionType = normalizeForMatch(context.sessionType ?? "");
  const salesLike = /\b(sales|consulting|meeting|negociacao|reuniao comercial|comercial)\b/.test(
    sessionType,
  );
  const teachingLike = /\b(class|mentoring|training|workshop)\b/.test(sessionType);

  let tone: LiveResponseTone = salesLike ? "consultivo" : teachingLike ? "acolhedor" : "direto";
  let response = "";
  let reason = "";
  let nextQuestion = "";

  if (insight.category === "question") {
    tone = salesLike ? "consultivo" : teachingLike ? "acolhedor" : "tecnico";
    response = salesLike
      ? "Faz sentido voce trazer essa duvida. Vou te mostrar de forma objetiva como isso funciona e o que muda na pratica para o seu contexto."
      : "Boa pergunta. Vou responder em partes, com um exemplo concreto, para ficar claro o que muda na pratica.";
    reason = "A conversa sinaliza uma duvida real que merece resposta clara antes de avancar.";
    nextQuestion = salesLike
      ? "Qual parte disso mais pesa na sua decisao hoje?"
      : "Quer que eu mostre um exemplo pratico ou recapitule o conceito base?";
  } else if (insight.category === "risk") {
    tone = salesLike ? "consultivo" : "acolhedor";
    response = salesLike
      ? "Entendo a preocupacao. Antes de propor qualquer caminho, quero alinhar exatamente onde esta o risco para responder de forma segura e sem forcar uma solucao."
      : "Entendi o ponto de atencao. Vamos isolar a causa principal antes de decidir a melhor resposta.";
    reason =
      "Ha indicio de bloqueio, objeção ou inseguranca, entao vale reduzir friccao e validar causa.";
    nextQuestion = salesLike
      ? "O que hoje torna esse ponto mais sensivel para voce: custo, tempo, risco ou confianca?"
      : "Qual parte exatamente esta travando mais: conceito, exemplo ou execucao?";
  } else if (insight.category === "task") {
    tone = salesLike ? "direto" : "consultivo";
    response =
      "Perfeito. Vou transformar isso em um proximo passo claro, com dono e criterio de conclusao, para nao ficar solto depois da aula.";
    reason = "O trecho ja aponta acao concreta e pode ser fechado com mais nitidez operacional.";
    nextQuestion = "Quem fica responsavel por isso e como vamos saber que ficou bem resolvido?";
  } else if (insight.category === "decision") {
    tone = "direto";
    response =
      "Fechado. Vou recapitular a decisao em uma frase e confirmar impacto, responsavel e proximo marco para manter alinhamento.";
    reason = "A fala traz decisao explicita e vale consolidar o acordo imediatamente.";
    nextQuestion = "Quer que eu registre tambem o motivo dessa decisao e o proximo checkpoint?";
  } else {
    tone = salesLike ? "comercial" : "consultivo";
    response = salesLike
      ? "Esse ponto parece importante para a conversa. Posso conectar isso ao beneficio pratico para avancarmos sem parecer forcado."
      : "Esse ponto merece exploracao. Posso aprofundar com um exemplo ou uma aplicacao pratica para consolidar entendimento.";
    reason =
      "O sinal e relevante, mas ainda funciona melhor como exploracao guiada do que como fechamento.";
    nextQuestion = salesLike
      ? "Se isso fizer sentido, qual seria o proximo criterio para voce considerar avancar?"
      : "Quer que eu aprofunde com um caso real ou conecte com o objetivo da aula?";
  }

  return {
    relatedSignal: compactText(insight.text, 120),
    response,
    reason,
    confidence: clamp01(insight.relevanceScore * 0.95),
    tone,
    nextQuestion,
  };
}

function buildCandidates(args: {
  terms: string[];
  highlights: string[];
  interimTranscript: string;
  context: LiveRelevanceContext;
}) {
  const candidates: LiveRelevanceCandidate[] = [];
  const trimmedInterim = args.interimTranscript.trim();

  if (trimmedInterim) {
    candidates.push({
      id: "interim",
      text: trimmedInterim,
      source: "interim",
    });
  }

  args.highlights.slice(0, 5).forEach((highlight, index) => {
    candidates.push({
      id: `highlight_${index}`,
      text: highlight,
      source: "highlight",
    });
  });

  args.context.transcriptionIssues?.slice(0, 3).forEach((issue, index) => {
    candidates.push({
      id: `transcription_issue_${index}`,
      text: issue,
      source: "transcription_issue",
    });
  });

  args.context.languageIssues?.slice(0, 2).forEach((issue, index) => {
    candidates.push({
      id: `language_issue_${index}`,
      text: issue,
      source: "language_issue",
    });
  });

  return uniqueCandidates(candidates);
}

export function evaluateLiveRelevance(args: {
  terms: string[];
  highlights: string[];
  interimTranscript: string;
  metrics: {
    confidence?: number;
    clarity?: number;
    conviction?: number;
  };
  context?: LiveRelevanceContext;
}): LiveRelevanceResult {
  const context = args.context ?? {};
  const terms = normalizeTerms(args.terms);
  const candidates = buildCandidates({
    terms: args.terms,
    highlights: args.highlights,
    interimTranscript: args.interimTranscript,
    context,
  });

  if (!candidates.length) {
    return {
      evaluations: [],
    };
  }

  const corpus = [
    args.interimTranscript,
    ...(context.recentSegments ?? []),
    ...args.highlights,
    ...(context.transcriptionIssues ?? []),
    ...(context.languageIssues ?? []),
  ].filter(Boolean);
  const strength = signalStrength(args.metrics);

  const evaluations = candidates
    .map((candidate) => {
      const { category, reasonParts, suggestedAction } = classifyText(
        candidate.text,
        candidate.source,
      );
      const recurrence = recurrenceForText(candidate.text, corpus, terms);
      const lengthFactor = clamp01(candidate.text.trim().length / 140);
      const recurrenceFactor = clamp01((recurrence - 1) * 0.22);
      const metricFactor =
        category === "noise"
          ? clamp01((strength - 0.48) * 0.12)
          : clamp01((strength - 0.45) * 0.38);
      const alignmentFactor = contextAlignment(candidate.text, context, terms);
      const sourceFactor =
        candidate.source === "interim"
          ? 0.08
          : candidate.source === "highlight"
            ? 0.1
            : candidate.source === "transcription_issue"
              ? 0.05
              : -0.08;
      const genericPenalty = /\b(importante|interessante|legal|bacana|ok|certo|beleza)\b/i.test(
        normalizeForMatch(candidate.text),
      )
        ? 0.12
        : 0;
      const insufficientPenalty = candidate.text.trim().length < 22 ? 0.24 : 0;
      const score = clamp01(
        scoreCategory(category) +
          lengthFactor * 0.14 +
          recurrenceFactor +
          metricFactor +
          alignmentFactor +
          sourceFactor -
          genericPenalty -
          insufficientPenalty,
      );
      const cappedScore =
        category === "noise"
          ? Math.min(score, candidate.source === "language_issue" ? 0.22 : 0.28)
          : score;

      return {
        id: candidate.id,
        category,
        text: compactText(candidate.text, 180),
        relevanceScore: cappedScore,
        recurrence,
        reason: buildReason(category, recurrence, strength, reasonParts),
        suggestedAction,
      } satisfies LiveRelevanceEvaluation;
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  const topInsight = evaluations.find((item) => item.relevanceScore >= 0.34);

  return {
    evaluations,
    topInsight,
    responseSuggestion: topInsight ? buildResponseSuggestion(topInsight, context) : undefined,
  };
}
