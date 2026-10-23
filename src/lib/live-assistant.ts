export type LiveAssistantMode = "student" | "mentor";

export type AssistantVoiceState = "idle" | "listening" | "thinking" | "speaking";

export type LiveAssistantMessageRole = "user" | "assistant";

export type LiveAssistantMessage = {
  id: string;
  role: LiveAssistantMessageRole;
  content: string;
  createdAt: string;
};

export type LiveAssistantPrompt = {
  label: string;
  prompt: string;
  description: string;
};

export type LiveAssistantMarkerKind =
  | "technical_term"
  | "important_point"
  | "language_issue"
  | "transcription_issue"
  | "follow_up";

export type LiveAssistantMarker = {
  id: string;
  kind: LiveAssistantMarkerKind;
  label: string;
  detail: string;
  createdAt: string;
  speakerName?: string;
  offsetMs?: number;
};

export type LiveAssistantTimelineItem = {
  id: string;
  label: string;
  detail: string;
  createdAt: string;
  speakerName?: string;
  offsetMs?: number;
};

export type LiveAssistantTranscriptSegment = {
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
};

export type LiveAssistantInsights = {
  terms: string[];
  transcriptionIssues: string[];
  importantPoints: string[];
  languageIssues: string[];
};

export type LiveAssistantContext = {
  sessionTitle?: string;
  sessionType?: string;
  recording: boolean;
  activeSpeaker?: string;
  transcriptSegments: LiveAssistantTranscriptSegment[];
  interimTranscript: string;
  insights: LiveAssistantInsights;
};

export type LiveAssistantSnapshot = {
  mode: LiveAssistantMode;
  updatedAt: string;
  messages: LiveAssistantMessage[];
  prompts: LiveAssistantPrompt[];
  markers: LiveAssistantMarker[];
  timeline: LiveAssistantTimelineItem[];
};

const glossary: Record<string, string> = {
  api: "uma interface que permite um sistema pedir e receber dados de outro",
  "api-first": "uma estratégia em que o contrato da API vem antes da interface final",
  endpoint: "um endereço específico da API para executar uma ação ou buscar dados",
  frontend: "a parte visual do sistema, com que o usuário interage: telas, botões e layout",
  backend: "a parte que roda no servidor: regras de negócio, banco de dados e integrações",
  fullstack: "quem atua tanto no frontend quanto no backend",
  "banco de dados": "onde o sistema guarda e organiza os dados de forma persistente",
  framework: "um conjunto de ferramentas e padrões que acelera a construção de software",
  biblioteca: "um conjunto de código pronto para reutilizar em um projeto",
  componente: "um bloco reutilizável de interface ou de código",
  deploy: "publicar a aplicação para que ela fique disponível em produção",
  bug: "um erro ou comportamento inesperado no software",
  variavel: "um espaço nomeado que guarda um valor que pode mudar",
  funcao: "um bloco de código reutilizável que executa uma tarefa",
  json: "um formato de texto leve para troca de dados entre sistemas",
  http: "o protocolo de comunicação entre o navegador e o servidor na web",
  autenticacao: "o processo de confirmar quem está acessando o sistema",
  integracao: "a conexão entre sistemas para trocar dados ou automatizar tarefas",
  transcricao: "o texto gerado a partir do áudio ou da fala capturada",
  contexto: "o conjunto de informações recentes que ajuda a IA a responder melhor",
  prompt: "a pergunta ou comando enviado à IA para guiar a resposta",
  webhook: "um aviso automático enviado por um sistema quando algo acontece",
  payload: "o conteúdo útil que vai dentro de uma requisição ou resposta",
  streaming: "envio de áudio ou dados em tempo real, sem esperar o arquivo completo",
  live: "a captura ou resposta acontecendo enquanto a aula ainda está rolando",
};

// Apelidos comuns -> chave canonica do glossario (chaves ja normalizadas).
const glossaryAliases: Record<string, string> = {
  front: "frontend",
  "front-end": "frontend",
  "front end": "frontend",
  back: "backend",
  "back-end": "backend",
  "back end": "backend",
  "full-stack": "fullstack",
  "full stack": "fullstack",
  db: "banco de dados",
  database: "banco de dados",
  "base de dados": "banco de dados",
  lib: "biblioteca",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactText(text: string, limit = 110) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized
    .slice(0, limit)
    .replace(/\s+\S*$/, "")
    .trim()}...`;
}

function uniqueValues(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalizeText(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function slugId(prefix: string, value: string) {
  const suffix = value
    .slice(0, 40)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${prefix}-${suffix || Math.random().toString(36).slice(2, 8)}`;
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function transcriptWindow(context: LiveAssistantContext, limit = 4) {
  return context.transcriptSegments.slice(-limit);
}

function transcriptText(context: LiveAssistantContext) {
  return [...context.transcriptSegments.map((segment) => segment.text), context.interimTranscript]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function recentSegmentAt(context: LiveAssistantContext, index: number) {
  const segments = transcriptWindow(context, 4);
  return segments[index] ?? segments[segments.length - 1];
}

function buildMarkers(context: LiveAssistantContext, mode: LiveAssistantMode) {
  const markers: LiveAssistantMarker[] = [];
  const terms = pickTerms(context, 5);
  const points = pickInsightPoints(context, 4);
  const issueList = [...context.insights.transcriptionIssues, ...context.insights.languageIssues];

  terms.slice(0, 3).forEach((term, index) => {
    const segment = recentSegmentAt(context, index);
    markers.push({
      id: slugId("term", `${term}-${index}`),
      kind: "technical_term",
      label: `Termo: ${term}`,
      detail: glossaryDefinition(term),
      createdAt: new Date().toISOString(),
      speakerName: segment?.speakerName,
      offsetMs: segment?.offsetMs,
    });
  });

  points.slice(0, 3).forEach((point, index) => {
    const segment = recentSegmentAt(context, index);
    markers.push({
      id: slugId("point", `${point}-${index}`),
      kind: "important_point",
      label: "Ponto importante",
      detail: compactText(point, 130),
      createdAt: new Date().toISOString(),
      speakerName: segment?.speakerName,
      offsetMs: segment?.offsetMs,
    });
  });

  issueList.slice(0, 3).forEach((issue, index) => {
    const segment = recentSegmentAt(context, index);
    markers.push({
      id: slugId("issue", `${issue}-${index}`),
      kind: context.insights.languageIssues.includes(issue)
        ? "language_issue"
        : "transcription_issue",
      label: context.insights.languageIssues.includes(issue)
        ? "Linguagem a revisar"
        : "Transcrição a revisar",
      detail: compactText(issue, 140),
      createdAt: new Date().toISOString(),
      speakerName: segment?.speakerName,
      offsetMs: segment?.offsetMs,
    });
  });

  if (mode === "mentor") {
    const followUp = terms[0] ?? points[0];
    if (followUp) {
      markers.push({
        id: slugId("follow", followUp),
        kind: "follow_up",
        label: "Pergunta sugerida",
        detail: `Que exemplo ajuda a fixar ${compactText(followUp, 80)}?`,
        createdAt: new Date().toISOString(),
        speakerName: context.activeSpeaker,
        offsetMs: transcriptWindow(context, 1)[0]?.offsetMs,
      });
    }
  }

  return uniqueMarkers(markers);
}

function uniqueMarkers(markers: LiveAssistantMarker[]) {
  const seen = new Set<string>();
  return markers.filter((marker) => {
    const key = `${marker.kind}:${normalizeText(marker.label)}:${normalizeText(marker.detail)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTimeline(context: LiveAssistantContext, markers: LiveAssistantMarker[]) {
  const segmentItems = transcriptWindow(context, 4).map((segment, index) => ({
    id: slugId("timeline-segment", `${segment.speakerName}-${index}`),
    label: segment.speakerName,
    detail: compactText(segment.text, 110),
    createdAt: new Date(segment.createdAt ?? Date.now()).toISOString(),
    speakerName: segment.speakerName,
    offsetMs: segment.offsetMs ?? index * 60000,
  }));

  return [
    ...segmentItems,
    ...markers.slice(0, 6).map((marker) => ({
      id: slugId("timeline-marker", `${marker.kind}-${marker.label}`),
      label: marker.label,
      detail: marker.detail,
      createdAt: marker.createdAt,
      speakerName: marker.speakerName,
      offsetMs: marker.offsetMs,
    })),
  ].sort((a, b) => {
    const aOffset = typeof a.offsetMs === "number" ? a.offsetMs : Number.MAX_SAFE_INTEGER;
    const bOffset = typeof b.offsetMs === "number" ? b.offsetMs : Number.MAX_SAFE_INTEGER;
    if (aOffset !== bOffset) return aOffset - bOffset;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function pickInsightPoints(context: LiveAssistantContext, limit = 3) {
  const points = uniqueValues(context.insights.importantPoints, limit);
  if (points.length) return points;

  const recent = transcriptWindow(context, limit).map((segment) => segment.text);
  return uniqueValues(
    recent
      .map((sentence) => splitSentences(sentence)[0] ?? sentence)
      .map((sentence) => compactText(sentence, 130)),
    limit,
  );
}

function pickTerms(context: LiveAssistantContext, limit = 6) {
  return uniqueValues(context.insights.terms, limit);
}

function buildBulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function resolveGlossaryKey(term: string): string | null {
  const normalized = normalizeText(term);
  const aliased = glossaryAliases[normalized] ?? normalized;
  if (glossary[aliased]) return aliased;
  if (glossary[normalized]) return normalized;
  return null;
}

function glossaryDefinition(term: string) {
  const key = resolveGlossaryKey(term);
  return key ? glossary[key] : "um termo técnico que apareceu na aula";
}

function capitalizeTerm(term: string) {
  const clean = term.replace(/\s+/g, " ").trim();
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}

function isGenericDefinitionTerm(term: string) {
  const normalized = normalizeText(term).trim();
  if (!normalized) return true;

  const genericTerms = new Set([
    "isso",
    "isto",
    "aquilo",
    "esse",
    "essa",
    "esses",
    "essas",
    "este",
    "esta",
    "estes",
    "estas",
    "aqui",
    "ai",
    "ali",
    "parte",
    "trecho",
    "topico",
    "tema",
    "assunto",
    "negocio",
    "coisa",
    "contexto",
  ]);

  if (genericTerms.has(normalized)) return true;
  if (/^(isso|isto|aquilo|essa?|este|esta)\s+/.test(normalized)) return true;
  if (/\b(aqui|agora|da aula|do audio|do trecho)\b/.test(normalized)) return true;

  return false;
}

function includesWholeTerm(text: string, term: string) {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term).trim();
  if (!normalizedTerm) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}([^a-z0-9]|$)`, "i");
  return pattern.test(normalizedText);
}

/** Extrai o termo de perguntas de definicao: "o que e X", "defina X", "o que significa X". */
function extractDefinitionTerm(question: string): string | null {
  const match = question.match(
    /^\s*(?:o que\s+(?:é|e|sao|são|significa[m]?|vem a ser)|que\s+(?:é|e)|defina|define|defini[cç][aã]o de)\s+(.+?)[\s?.!]*$/i,
  );
  if (!match) return null;
  const term = match[1].replace(/^(?:o|a|os|as|um|uma)\s+/i, "").trim();
  if (term.length < 2 || isGenericDefinitionTerm(term)) return null;
  return term;
}

/** Responde uma definicao de forma direta (sem devolver pergunta). */
function defineAnswer(term: string, context: LiveAssistantContext) {
  const title = capitalizeTerm(term);
  const key = resolveGlossaryKey(term);
  if (key) {
    return `**${title}**\n${glossary[key]}.`;
  }

  const fromTranscript = transcriptText(context)
    ? splitSentences(transcriptText(context)).find((sentence) =>
        normalizeText(sentence).includes(normalizeText(term)),
      )
    : undefined;

  if (fromTranscript) {
    return `**${title}**\nNa aula, apareceu assim: ${compactText(fromTranscript, 160)}.`;
  }

  return `**${title}**\nAinda não tenho uma definição pronta desse termo. Se ele aparecer na aula, eu explico pelo contexto capturado.`;
}

function extractQuestionTerm(question: string, terms: string[]) {
  const normalizedQuestion = normalizeText(question);
  const matches = terms.find((term) => includesWholeTerm(normalizedQuestion, term));
  if (matches) return matches;

  for (const known of [...Object.keys(glossary), ...Object.keys(glossaryAliases)]) {
    if (includesWholeTerm(normalizedQuestion, known)) return known;
  }

  return undefined;
}

function contextTextForInference(context: LiveAssistantContext) {
  return [
    transcriptText(context),
    ...context.transcriptSegments.flatMap((segment) => segment.technicalTerms ?? []),
    ...context.insights.terms,
    ...context.insights.importantPoints,
  ]
    .filter(Boolean)
    .join(" ");
}

function contextMentionsAny(context: LiveAssistantContext, terms: string[]) {
  const normalized = normalizeText(contextTextForInference(context));
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function isStackRelationshipQuestion(normalizedQuestion: string, context: LiveAssistantContext) {
  const mentionsStackFamily =
    /(front\s*end|frontend|front-end|back\s*end|backend|back-end|full\s*stack|fullstack|full-stack)/i.test(
      normalizedQuestion,
    );
  const asksForRelation =
    /(relacao|relaciona|diferenca|diferenciar|como.*junta|como.*conecta|camada|ponta\s+a\s+ponta|explica.*junto)/i.test(
      normalizedQuestion,
    );
  const asksFullStack = /(full\s*stack|fullstack|full-stack)/i.test(normalizedQuestion);
  const contextHasFrontend = contextMentionsAny(context, ["frontend", "front-end", "front end"]);
  const contextHasBackend = contextMentionsAny(context, ["backend", "back-end", "back end"]);

  return (
    (mentionsStackFamily && asksForRelation) ||
    (asksFullStack && contextHasFrontend && contextHasBackend)
  );
}

function stackRelationshipAnswer(context: LiveAssistantContext) {
  const contextHasFrontend = contextMentionsAny(context, ["frontend", "front-end", "front end"]);
  const contextHasBackend = contextMentionsAny(context, ["backend", "back-end", "back end"]);
  const contextLine =
    contextHasFrontend || contextHasBackend
      ? "Pelo contexto capturado, a aula esta tratando de camadas de uma aplicacao."
      : "Mesmo que esse termo nao tenha sido falado literalmente, ele se encaixa no contexto tecnico da aula.";

  return [
    "**Front-end, back-end e full stack**",
    contextLine,
    buildBulletList([
      "Front-end e a parte visual: telas, botoes, formularios e experiencia do usuario.",
      "Back-end e a parte do servidor: regras de negocio, banco de dados, autenticacao e integracoes.",
      "Full stack e a visao ou atuacao que conecta as duas camadas, entendendo o caminho inteiro entre interface, API, servidor e dados.",
    ]),
    "Um bom jeito de explicar: quando o usuario clica em salvar, o front-end coleta a acao, chama uma API, o back-end valida e salva no banco. A pessoa full stack entende esse fluxo completo.",
  ].join("\n\n");
}

function summaryAnswer(context: LiveAssistantContext) {
  const points = pickInsightPoints(context, 3);
  const terms = pickTerms(context, 4);

  if (!points.length && !transcriptText(context)) {
    return "Ainda sem contexto para resumir. Deixe a aula avançar um pouco.";
  }

  const lines = ["**Resumo até agora**"];
  lines.push(
    points.length
      ? buildBulletList(points.map((point) => compactText(point, 90)))
      : compactText(transcriptText(context), 160),
  );
  if (terms.length) lines.push(`Termos: ${terms.join(", ")}.`);
  return lines.join("\n\n");
}

function simpleExplanationAnswer(context: LiveAssistantContext, term?: string) {
  const selectedTerm = term ?? pickTerms(context, 1)[0];

  if (selectedTerm) {
    return `**${selectedTerm}**\n${glossaryDefinition(selectedTerm)}.`;
  }

  if (!transcriptText(context)) {
    return "Sem fala suficiente para explicar ainda. Tente de novo em alguns segundos.";
  }

  const sentence = splitSentences(transcriptText(context))[0] ?? transcriptText(context);
  return `Em poucas palavras: ${compactText(sentence, 160)}.`;
}

function missedAnswer(context: LiveAssistantContext) {
  const recent = transcriptWindow(context, 3);
  const points = pickInsightPoints(context, 3);

  if (!recent.length && !points.length) {
    return "Ainda não há trechos suficientes para apontar o que passou.";
  }

  return [
    "**Você pode ter perdido**",
    points.length
      ? buildBulletList(points.map((point) => compactText(point, 90)))
      : buildBulletList(
          recent.map((segment) => `${segment.speakerName}: ${compactText(segment.text, 90)}`),
        ),
  ].join("\n\n");
}

function importantPointsAnswer(context: LiveAssistantContext) {
  const points = pickInsightPoints(context, 4);
  return [
    "**Pontos-chave**",
    points.length
      ? buildBulletList(points.map((point) => compactText(point, 90)))
      : "Ainda sem pontos confiáveis. Deixe a aula avançar.",
  ].join("\n\n");
}

function mentorQuestionAnswer(context: LiveAssistantContext) {
  const focus = pickTerms(context, 1)[0] ?? pickInsightPoints(context, 1)[0] ?? "esse ponto";
  const question =
    context.sessionType?.toUpperCase() === "MENTORING"
      ? `Você pode aprofundar ${compactText(focus, 60)} com um exemplo prático?`
      : `Pode dar um exemplo prático de ${compactText(focus, 60)}?`;
  return `**Pergunte agora**\n> ${question}`;
}

function practicalStepsAnswer(context: LiveAssistantContext) {
  const points = pickInsightPoints(context, 3);
  const steps = points.length
    ? points.map((point, index) => `${index + 1}. ${compactText(point, 90)}`)
    : [
        "1. Defina o conceito principal em uma frase.",
        "2. Dê um exemplo concreto.",
        "3. Aplique numa tarefa real.",
      ];
  return ["**Próximos passos**", steps.join("\n")].join("\n\n");
}

function commercialResponseAnswer(context: LiveAssistantContext) {
  const point =
    pickInsightPoints(context, 1)[0] ?? transcriptWindow(context, 1)[0]?.text ?? "esse ponto";
  const question = pickTerms(context, 1)[0];
  const opener = question
    ? `Voce pode responder assim: Faz sentido olhar ${question} com cuidado.`
    : "Voce pode responder assim: Faz sentido olhar isso com cuidado.";

  return [
    "**Resposta pronta**",
    opener,
    `Complete com valor pratico e proximo passo: ${compactText(point, 96)}.`,
  ].join("\n\n");
}

function followUpAnswer(context: LiveAssistantContext) {
  const focus = pickInsightPoints(context, 1)[0] ?? pickTerms(context, 1)[0] ?? "esse tema";
  return [
    "**Follow-up sugerido**",
    `Retome ${compactText(focus, 72)} com dono, prazo e proxima validacao.`,
    "Se fizer sentido, confirme qual e o proximo passo concreto antes de encerrar.",
  ].join("\n\n");
}

function executiveSummaryAnswer(context: LiveAssistantContext) {
  const points = pickInsightPoints(context, 3);
  if (!points.length) {
    return "Resumo executivo ainda fraco. Deixe a conversa avancar mais um pouco.";
  }

  return [
    "**Resumo executivo**",
    buildBulletList(points.map((point) => compactText(point, 84))),
  ].join("\n\n");
}
function technicalTermsAnswer(context: LiveAssistantContext) {
  const terms = pickTerms(context, 5);
  if (!terms.length) {
    return "Nenhum termo técnico detectado até agora.";
  }
  return [
    "**Termos técnicos**",
    buildBulletList(terms.map((term) => `${term} — ${glossaryDefinition(term)}`)),
  ].join("\n\n");
}

function doubtsAnswer(context: LiveAssistantContext) {
  const points = pickInsightPoints(context, 2);
  const terms = pickTerms(context, 2);
  const doubts = uniqueValues(
    [
      terms[0] ? `Como ${terms[0]} se aplica na prática?` : "",
      points[0] ? `O que diferencia "${compactText(points[0], 50)}" do resto?` : "",
      points[1] ? `Que exemplo fixa "${compactText(points[1], 50)}"?` : "",
    ],
    3,
  );
  return [
    "**Dúvidas para revisar**",
    doubts.length ? buildBulletList(doubts) : "Ainda sem contexto para boas dúvidas.",
  ].join("\n\n");
}

function communicationAnswer(context: LiveAssistantContext) {
  const issues = uniqueValues(
    [...context.insights.transcriptionIssues, ...context.insights.languageIssues],
    4,
  );
  if (!issues.length) {
    return "Comunicação consistente até agora. Sem ajustes urgentes.";
  }
  return [
    "**Comunicação — revisar**",
    buildBulletList(issues.map((issue) => compactText(issue, 100))),
  ].join("\n\n");
}

export function buildLiveAssistantPrompts(
  mode: LiveAssistantMode,
  context: LiveAssistantContext,
): LiveAssistantPrompt[] {
  const hasContext = context.transcriptSegments.length > 0 || context.interimTranscript.trim();
  const points = pickInsightPoints(context, 2);
  const terms = pickTerms(context, 2);
  const focus = terms[0] ?? points[0] ?? "a parte atual";

  const studentPrompts: LiveAssistantPrompt[] = [
    {
      label: "Resumir ate agora",
      prompt: "Resuma o que foi explicado ate agora.",
      description: "Panorama rapido da aula com base no que ja foi capturado.",
    },
    {
      label: "Explicar simples",
      prompt: `Explique ${focus} de forma simples.`,
      description: "Traduz a explicacao para uma linguagem mais direta.",
    },
    {
      label: "Pontos importantes",
      prompt: "Liste os pontos mais importantes ate agora.",
      description: "Destaca o que merece revisao imediata.",
    },
    {
      label: "Termos tecnicos",
      prompt: "Quais termos tecnicos apareceram ate agora?",
      description: "Mostra a linguagem tecnica que vale revisar depois.",
    },
    {
      label: "Pergunta ao mentor",
      prompt: "Que pergunta eu poderia fazer ao mentor agora?",
      description: "Ajuda a transformar a aula em participacao ativa.",
    },
    {
      label: "Proximos passos",
      prompt: "Transforme essa explicacao em passos praticos.",
      description: "Converte o conteudo em acao concreta.",
    },
  ];

  const mentorPrompts: LiveAssistantPrompt[] = [
    {
      label: "Analisar clareza",
      prompt: "Analise a clareza desta explicacao.",
      description: "Avalia se a fala esta organizada e didatica.",
    },
    {
      label: "Apontar informalidade",
      prompt: "Apontar linguagem informal, repeticoes ou vicios de linguagem.",
      description: "Marca pontos de comunicacao que podem ser melhorados.",
    },
    {
      label: "Melhorar didatica",
      prompt: `Como reexplicar ${focus} de forma mais didatica?`,
      description: "Sugere uma versao mais clara para o publico.",
    },
    {
      label: "Trecho confuso",
      prompt: "Qual parte esta mais confusa ate agora?",
      description: "Identifica o trecho que merece mais desenvolvimento.",
    },
    {
      label: "Pergunta de checagem",
      prompt: "Crie uma pergunta para verificar se o publico entendeu.",
      description: "Ajuda a testar entendimento ao vivo.",
    },
    {
      label: "Pontos positivos",
      prompt: "Quais pontos foram bem explicados?",
      description: "Mostra o que a fala ja tem de forte.",
    },
  ];

  const prompts = mode === "mentor" ? mentorPrompts : studentPrompts;

  return hasContext ? prompts : prompts.slice(0, 4);
}

export function buildLiveAssistantResponse(
  question: string,
  mode: LiveAssistantMode,
  context: LiveAssistantContext,
) {
  const normalized = normalizeText(question);
  const term = extractQuestionTerm(question, pickTerms(context, 6));

  const definitionTerm = extractDefinitionTerm(question);
  if (isStackRelationshipQuestion(normalized, context)) return stackRelationshipAnswer(context);
  if (definitionTerm) return defineAnswer(definitionTerm, context);

  if (/(resumo executivo|handoff|brief executivo|sumario executivo)/i.test(normalized))
    return executiveSummaryAnswer(context);
  if (/(resum|sumariz|panorama)/i.test(normalized)) return summaryAnswer(context);
  if (
    /(resposta|responder|o que eu respondo|como responder|contornar|obje[cç]ao|objection)/i.test(
      normalized,
    )
  )
    return commercialResponseAnswer(context);
  if (/(follow[\s-]*up|acompanhamento|retomar|proxima pergunta|pergunta final)/i.test(normalized))
    return followUpAnswer(context);
  if (/(explic|simpl[ae]|mais\s+simples|significa)/i.test(normalized))
    return simpleExplanationAnswer(context, term);
  if (/(perdi|o que eu perdi|ultimos?\s+minutos|ultimas?\s+partes)/i.test(normalized))
    return missedAnswer(context);
  if (/(pontos?\s+mais\s+importantes?|pontos?\s+importantes?)/i.test(normalized))
    return importantPointsAnswer(context);
  if (/(d[uú]vidas?|anotar|quais\s+duvidas?)/i.test(normalized)) return doubtsAnswer(context);
  if (
    /(pergunta.*mentor|pergunta.*professor|checar|verificar\s+entendimento|tirar\s+duvidas?)/i.test(
      normalized,
    )
  )
    return mentorQuestionAnswer(context);
  if (/(passos?\s+praticos?|pr[oó]ximos?\s+passos?|transforme.*passos?)/i.test(normalized))
    return practicalStepsAnswer(context);
  if (/(termos?\s+tecnicos?|terminos?\s+tecnicos?)/i.test(normalized))
    return technicalTermsAnswer(context);
  if (/(claridade|informal|repeti|vicio|didatic|comunicacao)/i.test(normalized))
    return communicationAnswer(context);

  if (term) return defineAnswer(term, context);

  return mode === "mentor"
    ? "Posso avaliar a clareza, apontar informalidades ou sugerir uma pergunta de checagem. É só indicar o trecho ou o tema."
    : "Posso resumir a aula, explicar um termo, listar os pontos-chave ou indicar os próximos passos.";
}

export function buildLiveAssistantSnapshot(
  mode: LiveAssistantMode,
  messages: LiveAssistantMessage[],
  prompts: LiveAssistantPrompt[],
  context: LiveAssistantContext,
): LiveAssistantSnapshot {
  const markers = buildMarkers(context, mode);
  return {
    mode,
    updatedAt: new Date().toISOString(),
    messages,
    prompts,
    markers,
    timeline: buildTimeline(context, markers),
  };
}

export function liveAssistantModeLabel(mode: LiveAssistantMode) {
  return mode === "mentor" ? "Mentor" : "Aluno";
}
