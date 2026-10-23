import type { AssistantKnowledgeRoute } from "./assistant-knowledge";

export type AssistantQuestionLogEntry = {
  id: string;
  question: string;
  source: "provider" | "local";
  domain: AssistantKnowledgeRoute["domain"];
  confidence: AssistantKnowledgeRoute["confidence"];
  requiresFreshSources: boolean;
  createdAt: string;
};

const STORAGE_KEY = "educai.assistant.question-gaps";
const MAX_ENTRIES = 40;

export function logAssistantQuestionGap(
  question: string,
  route: AssistantKnowledgeRoute,
  source: "provider" | "local",
) {
  if (typeof window === "undefined") return;
  if (source === "provider" && route.confidence !== "low" && !route.requiresFreshSources) return;

  const entry: AssistantQuestionLogEntry = {
    id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    question,
    source,
    domain: route.domain,
    confidence: route.confidence,
    requiresFreshSources: route.requiresFreshSources,
    createdAt: new Date().toISOString(),
  };

  try {
    const current = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as AssistantQuestionLogEntry[];
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([entry, ...current].slice(0, MAX_ENTRIES)),
    );
  } catch {
    // Ignora falha local de persistencia para nao impactar a assistente.
  }
}
