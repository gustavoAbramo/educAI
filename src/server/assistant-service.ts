import {
  buildKnowledgeFallbackResponse,
  providerContextSummary,
  routeAssistantQuestion,
  type AssistantKnowledgeRoute,
} from "@/lib/assistant-knowledge";
import {
  buildLiveAssistantResponse,
  type LiveAssistantContext,
  type LiveAssistantMode,
} from "@/lib/live-assistant";
import { answerGeneralAssistantWithGemini } from "./gemini-provider";
import { answerGeneralAssistantWithOllama } from "./ollama-provider";
import {
  answerGeneralAssistantWithOpenAI,
  answerGeneralAssistantWithOpenAIWebSearch,
} from "./openai-provider";
import {
  providerHasGeminiKey,
  providerHasOpenAIKey,
  resolveAssistantWebSearchMode,
  resolveGenerationProvider,
} from "./provider-runtime";

export type AssistantRespondRequest = {
  message: string;
  mode?: LiveAssistantMode;
  context?: LiveAssistantContext;
};

export type AssistantRespondResult = {
  content: string;
  meta: {
    source: "provider" | "local";
    domain: AssistantKnowledgeRoute["domain"];
    confidence: AssistantKnowledgeRoute["confidence"];
    requiresFreshSources: boolean;
    usedWebSearch: boolean;
    suggestedAgents: string[];
    sources: Array<{
      title?: string;
      url: string;
    }>;
  };
};

function hasOpenAIKey() {
  return providerHasOpenAIKey();
}

function hasGeminiKey() {
  return providerHasGeminiKey();
}

function webSearchEnabled() {
  const configured = resolveAssistantWebSearchMode();
  if (!configured || configured === "auto") return true;
  return configured === "on";
}

function isThinLocalResponse(response: string) {
  return (
    response.includes("Posso resumir a aula") ||
    response.includes("Posso avaliar a clareza") ||
    response.includes("Ainda nao tenho uma definicao pronta") ||
    response.includes("Ainda não tenho uma definição pronta")
  );
}

function hasUsefulKnowledgeFallback(response: string) {
  return (
    !response.includes("Posso responder melhor") &&
    !response.includes("Essa pergunta parece depender de dados recentes ou verificacao externa.")
  );
}

function hasCapturedLessonContext(context?: LiveAssistantContext) {
  if (!context) return false;
  return Boolean(
    context.interimTranscript.trim() ||
    context.transcriptSegments.length ||
    context.insights.importantPoints.length ||
    context.insights.terms.length,
  );
}

function buildProviderInstructions(
  mode: LiveAssistantMode,
  route: AssistantKnowledgeRoute,
  context?: LiveAssistantContext,
) {
  const summary = providerContextSummary(route, context);
  return [
    "Voce e Alexa, a assistente virtual do educAI.",
    "Priorize o contexto da aula e do sistema quando a pergunta tiver relacao com a sessao atual.",
    "Quando a pergunta for geral, responda com conhecimento amplo e linguagem clara em portugues do Brasil.",
    mode === "mentor"
      ? "No modo mentor, responda com tom de apoio didatico e foco em clareza, exemplo e proximo passo."
      : "No modo aluno, responda de forma direta, simples e util para aprendizagem.",
    "Se a pergunta depender de noticia, lei, preco ou dado recente e voce nao tiver verificacao externa, diga isso claramente.",
    route.requiresFreshSources
      ? "Quando usar busca web, responda com o dado atualizado e cite as fontes mais relevantes no final."
      : "Quando a resposta vier apenas do seu conhecimento interno, nao invente fontes.",
    "Nao invente fatos especificos sobre o educAI que nao estejam no contexto recebido.",
    summary.routeSummary,
    summary.sessionSummary || "Sem metadados adicionais de sessao.",
    summary.transcriptPreview
      ? `Trechos recentes da aula:\n${summary.transcriptPreview}`
      : "Sem trechos recentes de aula relevantes.",
    "Se a pergunta for sobre o educAI e o contexto nao bastar, deixe isso explicito em vez de chutar.",
  ].join("\n");
}

async function tryProviderAnswer(
  route: AssistantKnowledgeRoute,
  message: string,
  instructions: string,
): Promise<
  | {
      content?: string;
      usedWebSearch: boolean;
      sources: Array<{ title?: string; url: string }>;
    }
  | undefined
> {
  const shouldUseWebSearch = route.requiresFreshSources && webSearchEnabled();
  const preferredProvider = resolveGenerationProvider();

  if (hasOpenAIKey() && shouldUseWebSearch) {
    return answerGeneralAssistantWithOpenAIWebSearch(instructions, message);
  }

  if (preferredProvider === "openai" && hasOpenAIKey()) {
    const content = await answerGeneralAssistantWithOpenAI(instructions, message);
    return {
      content,
      usedWebSearch: false,
      sources: [],
    };
  }

  if (preferredProvider === "gemini" && hasGeminiKey()) {
    const content = await answerGeneralAssistantWithGemini(instructions, message);
    return {
      content,
      usedWebSearch: false,
      sources: [],
    };
  }

  if (preferredProvider === "ollama") {
    const content = await answerGeneralAssistantWithOllama(instructions, message);
    return {
      content,
      usedWebSearch: false,
      sources: [],
    };
  }

  if (preferredProvider === "mock") {
    return undefined;
  }

  if (hasOpenAIKey()) {
    const content = await answerGeneralAssistantWithOpenAI(instructions, message);
    return {
      content,
      usedWebSearch: false,
      sources: [],
    };
  }

  if (hasGeminiKey()) {
    const content = await answerGeneralAssistantWithGemini(instructions, message);
    return {
      content,
      usedWebSearch: false,
      sources: [],
    };
  }

  return undefined;
}

export async function answerAssistantMessage(
  request: AssistantRespondRequest,
): Promise<AssistantRespondResult> {
  const message = request.message.trim();
  const mode = request.mode ?? "student";
  const context = request.context;
  const route = routeAssistantQuestion(message, context);
  const localResponse = buildLiveAssistantResponse(message, mode, context ?? emptyContext());
  const knowledgeFallback = buildKnowledgeFallbackResponse(message, mode, context);
  const preferLocalKnowledge =
    route.matchedTerms.length > 0 &&
    route.confidence === "high" &&
    !route.requiresFreshSources &&
    hasUsefulKnowledgeFallback(knowledgeFallback);
  const preferLocalContextual =
    route.domain === "educai" &&
    hasCapturedLessonContext(context) &&
    !isThinLocalResponse(localResponse);
  const preferProvider =
    !preferLocalKnowledge &&
    !preferLocalContextual &&
    (route.shouldUseProvider || isThinLocalResponse(localResponse));

  if (preferProvider) {
    try {
      const providerResponse = await tryProviderAnswer(
        route,
        message,
        buildProviderInstructions(mode, route, context),
      );
      if (providerResponse?.content) {
        return {
          content: providerResponse.content,
          meta: {
            source: "provider",
            domain: route.domain,
            confidence: route.confidence,
            requiresFreshSources: route.requiresFreshSources,
            usedWebSearch: providerResponse.usedWebSearch,
            suggestedAgents: route.suggestedAgents,
            sources: providerResponse.sources,
          },
        };
      }
    } catch (error) {
      console.error("[educAI] assistant provider failed", error);
    }
  }

  const content =
    !knowledgeFallback.includes("Posso responder melhor") && isThinLocalResponse(localResponse)
      ? knowledgeFallback
      : localResponse;

  return {
    content,
    meta: {
      source: "local",
      domain: route.domain,
      confidence: route.confidence,
      requiresFreshSources: route.requiresFreshSources,
      usedWebSearch: false,
      suggestedAgents: route.suggestedAgents,
      sources: [],
    },
  };
}

function emptyContext(): LiveAssistantContext {
  return {
    recording: false,
    transcriptSegments: [],
    interimTranscript: "",
    insights: {
      terms: [],
      transcriptionIssues: [],
      importantPoints: [],
      languageIssues: [],
    },
  };
}
