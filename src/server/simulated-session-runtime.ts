import type {
  CallMaterials,
  ChatMessage,
  ChatResponse,
  MaterialItem,
  SessionRecord,
  TranscriptSegment,
  VoiceRecording,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import { generatedMaterialTitle, type GeneratedMaterialType } from "@/lib/material-definitions";
import { buildSessionSignalIntelligence, sessionSignalSnapshotFromMetadata } from "@/lib/session-signals";
import { sessionContextText } from "./session-context";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function participantName(session: VoiceSession, index: number, fallback: string) {
  return session.participants[index]?.name ?? fallback;
}

function titleContext(session: VoiceSession) {
  return session.title;
}

export function buildSimulatedTranscript(
  session: VoiceSession,
  recording?: VoiceRecording,
): VoiceTranscript {
  const host = participantName(session, 0, "Host");
  const guest = participantName(session, 1, "Participant");
  const topic = titleContext(session);
  const recordingLabel = recording?.fileName ?? "the uploaded recording";

  const segments: TranscriptSegment[] = [
    {
      id: id("seg"),
      speaker: host,
      startMs: 0,
      endMs: 14200,
      text: `Thanks for joining. The main goal of ${topic} is to align context, capture the most important points, and make sure the follow-up is clear.`,
    },
    {
      id: id("seg"),
      speaker: guest,
      startMs: 14200,
      endMs: 30500,
      text: "The most important need is to avoid losing information from calls. We need searchable transcripts, concise summaries, and a reliable API that the platform can call after each session.",
    },
    {
      id: id("seg"),
      speaker: host,
      startMs: 30500,
      endMs: 49200,
      text: "The first version should process uploaded audio, return status updates, generate action items, and keep the contract stable for live streaming later.",
    },
    {
      id: id("seg"),
      speaker: guest,
      startMs: 49200,
      endMs: 63800,
      text: `That works. We can start with ${recordingLabel}, validate the API response, and then connect the real transcription and AI providers behind the same endpoints.`,
    },
  ];

  return {
    id: id("trn"),
    sessionId: session.id,
    language: session.language,
    status: "COMPLETED",
    text: segments.map((segment) => `${segment.speaker}: ${segment.text}`).join("\n\n"),
    segments,
    format: "TEXT",
    createdAt: now(),
    updatedAt: now(),
    provider: "educai-simulated-transcriber",
  };
}

export function buildSimulatedMaterials(
  session: VoiceSession,
  _transcript: VoiceTranscript,
): CallMaterials {
  const topic = titleContext(session);
  const context = sessionContextText(session);
  const generatedAt = now();
  const persistedSignals = sessionSignalSnapshotFromMetadata(session.metadata);
  const persistedIntelligence = buildSessionSignalIntelligence(persistedSignals);

  const material = (
    type: GeneratedMaterialType,
    content: string,
    title = generatedMaterialTitle(type),
  ): MaterialItem => ({
    id: id("mat"),
    sessionId: session.id,
    type,
    title,
    content,
    format: "MARKDOWN",
    status: "COMPLETED",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  });

  const summary = [
    `The session about ${topic} was processed with the available transcript and session context.`,
    `Context used: ${context}`,
    "The agreed direction is to extract the important points, produce follow-up materials, and keep the API contract stable while AI providers evolve.",
  ].join("\n\n");

  const topics = [
    "Product direction: Voice intelligence layer for calls and API-first workflow.",
    "Technical path: create sessions, upload recordings, process transcript and insights.",
    "Next evolution: real STT provider, live streaming pipeline, and webhooks.",
  ];

  const insights = [
    "## Resumo geral da aula/conversa",
    `A sessao sobre ${topic} apresentou uma direcao clara: transformar o educAI em uma camada de inteligencia de voz com API estavel, transcricao, materiais e chat sobre a conversa.`,
    "",
    "## Pontos importantes identificados",
    "- Produto API-first para permitir integracao com outras plataformas.",
    "- Upload de audio como primeiro marco antes de captura ao vivo.",
    "- Contrato estavel enquanto os providers de IA evoluem por tras dos endpoints.",
    "",
    "## Analise da comunicacao",
    "A conversa foi objetiva e organizada em torno de prioridades tecnicas. A explicacao manteve foco em produto, API e proximos passos, com linguagem adequada para uma decisao de arquitetura.",
    "",
    "## Erros de linguagem e informalidade",
    "- Nao ha evidencia suficiente de girias ou vicios de linguagem relevantes no modo simulado.",
    "",
    "## Pontos a melhorar",
    "- Detalhar criterios de sucesso para transcricao real, materiais e chat.",
    "- Separar melhor curto prazo, medio prazo e arquitetura de producao.",
    "",
    "## Pontos positivos",
    "- Boa clareza sobre o objetivo central.",
    "- Priorizacao correta do fluxo de API antes do empacotamento desktop.",
  ].join("\n");

  const defaultActionItems = [
    "[HIGH | TECHNICAL_CORRECTION] 1. Validar o provider real de transcricao antes da proxima aula | Responsavel: equipe tecnica | Por que: a qualidade do relatorio depende da transcricao oficial | Criterio: gerar uma aula completa sem voltar para simulacao",
    "[MEDIUM | CONTENT_REVIEW] 2. Revisar os conceitos de API, status e materiais gerados | Responsavel: pessoa estudante | Por que: esses termos sustentam o fluxo explicado | Criterio: explicar o fluxo sem consultar o resumo",
    "[MEDIUM | EXERCISE] 3. Criar um exemplo curto de integracao consumindo os endpoints | Responsavel: professor ou facilitador | Por que: o exemplo transforma a decisao tecnica em aprendizado pratico | Criterio: demonstrar criar sessao, enviar audio e consultar resultado",
    "[LOW | COMMUNICATION] 4. Separar melhor curto prazo e arquitetura futura na explicacao | Responsavel: apresentador | Por que: reduz ambiguidade entre MVP e producao | Criterio: apresentar uma linha do tempo simples no inicio da proxima gravacao",
  ];

  const defaultLessonDiagnosis = [
    "## Resumo acionavel",
    "A conversa deixou claro que a dor principal e perder informacao util das chamadas e que a oportunidade imediata esta em transformar isso em fluxo confiavel de transcricao, materiais e follow-up.",
    "",
    "## Dores identificadas",
    "- Perda de informacao entre chamadas e follow-up | Evidencia: o participante destacou a necessidade de transcripts pesquisaveis e resumos concisos.",
    "",
    "## Duvidas recorrentes",
    "- Como validar a API e os materiais sem depender logo de streaming ao vivo | Evidencia: a conversa repetiu a prioridade de comecar por upload de audio.",
    "",
    "## Objecoes percebidas",
    "- Nao houve objecoes fortes no modo simulado; o risco maior esta na complexidade de implementacao futura.",
    "",
    "## Oportunidades de melhoria ou avancar",
    "- API-first como vantagem competitiva | Evidencia: a sessao reforcou integracao com outras plataformas | Proximo passo: demonstrar um fluxo real fim a fim.",
    "",
    "## Pontos de atencao",
    "- Definir criterios de sucesso por etapa | Evidencia: a conversa citou upload, transcricao, materiais e estabilidade, mas sem metricas detalhadas.",
    "",
    "## Decisoes e tarefas futuras",
    "- DECISION | HIGH | Validar primeiro upload de audio e contrato da API antes do streaming | Evidencia: a primeira versao deve processar audio enviado e manter contrato estavel.",
    "- TASK | MEDIUM | Criar um exemplo curto de integracao | Responsavel: equipe tecnica | Evidencia: a sessao pediu demonstracao pratica dos endpoints.",
    "",
    "## Resumo para agir depois",
    "- Provar o fluxo completo antes de aumentar a complexidade do produto.",
    "- Amarrar melhor transcricao, materiais e chat como entregas coerentes.",
    "",
    "## Recomendacoes praticas",
    "- Medir qualidade da transcricao e utilidade dos materiais com cenarios reais.",
    "- Registrar tarefas e decisoes de forma mais formal nas proximas sessoes.",
    "",
    "## Respostas sugeridas",
    "### pain",
    "Sinal: Perda de informacao depois das chamadas.",
    "Resposta recomendada: Faz sentido priorizar isso. Se resolvermos captura, resumo e follow-up com consistencia, o ganho aparece rapido sem depender de um salto tecnico maior logo de inicio.",
    "Motivo: A dor ja esta explicita e a resposta ancora valor com baixo atrito.",
    "Confianca: HIGH | Tom: CONSULTIVO",
    "Proxima pergunta: Onde hoje essa perda pesa mais: historico, acoes ou decisao comercial?",
  ].join("\n");

  const actionItems = persistedIntelligence.nextSteps.length
    ? persistedIntelligence.nextSteps.map(
        (item, index) =>
          `[${item.priority.toUpperCase()} | NEXT_STEP] ${index + 1}. ${item.title} | Por que: ${item.description} | Criterio: executar a acao e registrar o resultado da sessao`,
      )
    : defaultActionItems;

  const lessonDiagnosis = persistedSignals?.signals.length
    ? [
        "## Resumo acionavel",
        persistedSignals.groups.length
          ? persistedSignals.groups
              .slice(0, 3)
              .map((group) => `${group.label}: ${group.summary}`)
              .join(" ")
          : "A sessao gerou sinais fortes persistidos para orientar os proximos passos.",
        "",
        "## Dores identificadas",
        ...(persistedIntelligence.pains.length
          ? persistedIntelligence.pains.map(
              (item) => `- ${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
            )
          : ["- Nao houve dores fortes persistidas nesta sessao."]),
        "",
        "## Duvidas recorrentes",
        ...(persistedIntelligence.recurringQuestions.length
          ? persistedIntelligence.recurringQuestions.map(
              (item) => `- ${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
            )
          : ["- Nao houve duvidas recorrentes fortes persistidas nesta sessao."]),
        "",
        "## Objecoes percebidas",
        ...(persistedIntelligence.objections.length
          ? persistedIntelligence.objections.map(
              (item) => `- ${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
            )
          : ["- Nao houve objecoes fortes persistidas nesta sessao."]),
        "",
        "## Oportunidades de melhoria ou avancar",
        ...(persistedIntelligence.opportunities.length
          ? persistedIntelligence.opportunities.map(
              (item) => `- ${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
            )
          : ["- Nao houve oportunidades fortes persistidas nesta sessao."]),
        "",
        "## Pontos de atencao",
        ...(persistedIntelligence.risks.length
          ? persistedIntelligence.risks.map(
              (item) => `- ${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
            )
          : ["- Nao houve riscos fortes persistidos nesta sessao."]),
        "",
        "## Decisoes e tarefas futuras",
        ...[
          ...persistedIntelligence.decisions.map(
            (item) => `- DECISION | ${item.title} | Evidencia: ${item.excerpt}`,
          ),
          ...persistedIntelligence.tasks.map(
            (item) => `- TASK | ${item.title} | Evidencia: ${item.excerpt}`,
          ),
          ...persistedIntelligence.followUps.map(
            (item) => `- FOLLOW_UP | ${item.title} | Evidencia: ${item.excerpt}`,
          ),
        ],
        "",
        "## Resumo para agir depois",
        ...(persistedIntelligence.nextSteps.length
          ? persistedIntelligence.nextSteps.map((item) => `- ${item.title}: ${item.description}`)
          : ["- Nenhuma acao adicional foi sugerida a partir dos sinais persistidos."]),
        "",
        "## Recomendacoes praticas",
        ...(persistedIntelligence.nextSteps.length
          ? persistedIntelligence.nextSteps.map((item) => `- ${item.description}`)
          : ["- Reunir mais contexto real para novas recomendacoes." ]),
        "",
        "## Respostas sugeridas",
        ...(persistedIntelligence.suggestedResponses.length
          ? persistedIntelligence.suggestedResponses.flatMap((item) => [
              `### ${item.title}`,
              `Sinal: ${item.title}`,
              `Resposta recomendada: ${item.response}`,
              `Motivo: ${item.reason}`,
              [
                item.confidence !== undefined
                  ? `Confianca: ${Math.round(item.confidence * 100)}%`
                  : "",
                item.tone ? `Tom: ${String(item.tone).toUpperCase()}` : "",
              ]
                .filter(Boolean)
                .join(" | "),
              item.nextQuestion ? `Proxima pergunta: ${item.nextQuestion}` : "",
              "",
            ])
          : ["Ainda nao ha respostas sugeridas fortes persistidas nesta sessao."]),
      ].join("\n")
    : defaultLessonDiagnosis;

  const questions = [
    "## Faceis",
    "### 1. Qual e o objetivo central do fluxo API-first?",
    "Resposta: Permitir que outras plataformas criem sessoes, enviem audio e consultem transcricao, resumo, mapa, perguntas e acoes por endpoints estaveis.",
    "Foco: compreensao conceitual",
    "Como revisar: Reconte o fluxo em tres etapas: criar sessao, enviar audio e consultar materiais.",
    "Nivel: BASIC",
    "",
    "### 2. Por que o upload de audio aparece antes do streaming ao vivo?",
    "Resposta: Porque o upload reduz complexidade inicial e permite validar contrato, transcricao e geracao de materiais antes de lidar com captura em tempo real.",
    "Foco: priorizacao tecnica",
    "Como revisar: Compare o risco de processar um arquivo pronto com o risco de processar audio em tempo real.",
    "Nivel: BASIC",
    "",
    "## Medias",
    "### 3. O que precisa acontecer depois que a transcricao oficial fica pronta?",
    "Resposta: O sistema deve gerar materiais derivados, como resumo, relatorio, mapa mental, perguntas, acoes e suporte ao chat com base na transcricao.",
    "Foco: aplicacao do fluxo",
    "Como revisar: Desenhe a cadeia transcricao -> materiais -> chat.",
    "Nivel: INTERMEDIATE",
    "",
    "### 4. Como voce validaria se o contrato da API esta estavel?",
    "Resposta: Testaria criacao de sessao, upload, status, transcricao, materiais e chat conferindo se os campos retornados permanecem consistentes entre providers.",
    "Foco: validacao pratica",
    "Como revisar: Liste os endpoints e marque qual saida cada um deve entregar.",
    "Nivel: INTERMEDIATE",
    "",
    "## Reflexivas",
    "### 5. Por que separar provider de transcricao e geracao de materiais melhora a arquitetura?",
    "Resposta: Porque o sistema pode trocar OpenAI, Gemini ou um simulador explicito sem quebrar endpoints, mantendo contrato estavel e reduzindo acoplamento entre servicos.",
    "Foco: reflexao arquitetural",
    "Como revisar: Explique o beneficio para manutencao e testes.",
    "Nivel: ADVANCED",
    "",
    "### 6. Como a explicacao poderia ficar mais clara para uma audiencia nao tecnica?",
    "Resposta: Poderia usar uma analogia simples, mostrar uma linha do tempo do processamento e separar o que ja funciona do que e evolucao futura.",
    "Foco: comunicacao didatica",
    "Como revisar: Regrave a explicacao em ate um minuto evitando termos sem definicao.",
    "Nivel: ADVANCED",
  ];

  return {
    sessionId: session.id,
    items: [
      material("SUMMARY", summary),
      material("TOPICS", topics.map((item) => `- ${item}`).join("\n")),
      material("INSIGHTS", insights),
      material("LESSON_DIAGNOSIS", lessonDiagnosis),
      material("ACTION_ITEMS", actionItems.map((item) => `- ${item}`).join("\n")),
      material("QUESTIONS", questions.join("\n")),
      material(
        "EXECUTIVE_HANDOFF",
        [
          "## Resumo executivo",
          summary,
          "",
          "## O que precisa ficar claro",
          "- A conversa ja deixa tarefas e proximos passos mais definidos.",
          "- O diagnostico final deve ser usado para alinhar time e dono de cada acao.",
          "",
          "## Proximos passos recomendados",
          actionItems.map((item) => `- ${item}`).join("\n"),
        ].join("\n"),
      ),
      material(
        "SUGGESTED_RESPONSES",
        [
          "### Resposta sugerida",
          "Resposta: Posso consolidar isso em um plano objetivo e te mostrar o melhor proximo passo com base no que apareceu na conversa.",
          "Motivo: A resposta ancora valor pratico sem prometer alem do contexto capturado.",
          "Proxima pergunta: Qual parte voce quer transformar em acao primeiro?",
        ].join("\n"),
      ),
      material(
        "COMMERCIAL_BRIEF",
        [
          "## Leitura comercial",
          "A sessao mostrou sinais de valor em clareza, automacao e proximos passos.",
          "",
          "## Oportunidades",
          "- Existe espaco para transformar duvidas e dores em proposta mais concreta.",
          "",
          "## Follow-ups e CRM",
          "- Registrar oportunidade e dono do proximo contato.",
        ].join("\n"),
      ),
      material(
        "MIND_MAP",
        [
          `# ${topic}`,
          "",
          "## Conceito do produto",
          "- API-first",
          "  - Criar sessoes",
          "  - Enviar audio",
          "  - Consultar resultados",
          "",
          "## Fluxo de audio",
          "- Upload inicial",
          "  - Validar contrato",
          "  - Processar arquivo gravado",
          "",
          "## Materiais gerados",
          "- Resumo e topicos",
          "  - Organizar conceitos",
          "  - Apoiar revisao",
          "- Acoes e perguntas",
          "  - Proximos passos",
          "  - Checagem de entendimento",
          "",
          "## Melhorias",
          "- Captura ao vivo",
          "  - Streaming futuro",
          "  - Diarizacao melhor",
          "- Producao",
          "  - Persistencia robusta",
          "  - Webhooks",
          "",
          "## Linguagem utilizada",
          "- Termos tecnicos",
          "  - API",
          "  - Providers",
          "- Comunicacao",
          "  - Objetiva",
          "  - Profissional",
        ].join("\n"),
      ),
    ],
    generatedAt,
    model: "educai-simulated-insights-v1",
  };
}

export function buildSimulatedChatResponse(
  record: SessionRecord,
  citations: TranscriptSegment[],
): ChatResponse {
  const materials = record.materials;

  let content =
    "I can answer with more confidence after this session has a transcript and generated insights.";

  if (materials) {
    const summary = materials.items.find((item) => item.type === "SUMMARY")?.content ?? "";
    const actionPreview =
      materials.items.find((item) => item.type === "ACTION_ITEMS")?.content ?? "";
    content = `Based on this call, the main takeaway is: ${summary} Next actions: ${actionPreview}`;
  }

  const assistantMessage: ChatMessage = {
    id: id("msg"),
    sessionId: record.session.id,
    role: "ASSISTANT",
    content,
    createdAt: now(),
  };

  return {
    message: assistantMessage,
    citations,
  };
}


