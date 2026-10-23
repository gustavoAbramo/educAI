import type {
  CallMaterials,
  ChatResponse,
  GenerationProviderMode,
  SessionRecord,
  TranscriptSegment,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import { answerChatWithGemini, generateMaterialsWithGemini } from "./gemini-provider";
import { answerChatWithOllama, generateMaterialsWithOllama } from "./ollama-provider";
import { answerChatWithOpenAI, generateMaterialsWithOpenAI } from "./openai-provider";
import {
  providerDiagnosticsEnabled,
  providerHasGeminiKey,
  providerHasOpenAIKey,
  resolveGenerationProvider,
  simulatedProvidersEnabled,
} from "./provider-runtime";

export type MockMaterialsGenerator = (
  session: VoiceSession,
  transcript: VoiceTranscript,
) => CallMaterials;

export type MockChatResponder = (
  record: SessionRecord,
  message: string,
  citations: TranscriptSegment[],
) => ChatResponse;

function logGenerationSelection(
  provider: GenerationProviderMode,
  capability: "materials" | "chat",
) {
  if (!providerDiagnosticsEnabled()) return;
  console.info(
    [
      "[educAI] generation",
      `capability=${capability}`,
      `provider=${provider}`,
      `openaiKey=${providerHasOpenAIKey()}`,
      `geminiKey=${providerHasGeminiKey()}`,
    ].join(" "),
  );
}

export { resolveGenerationProvider } from "./provider-runtime";

export async function generateMaterialsWithConfiguredProvider(
  session: VoiceSession,
  transcript: VoiceTranscript,
  mockGenerator: MockMaterialsGenerator,
): Promise<CallMaterials> {
  const provider = resolveGenerationProvider();
  logGenerationSelection(provider, "materials");

  if (provider === "mock") {
    if (!simulatedProvidersEnabled()) {
      throw new Error(
        "Simulated material generation is disabled in this environment. Configure OpenAI, Gemini, or Ollama before generating materials.",
      );
    }
    return mockGenerator(session, transcript);
  }

  if (provider === "openai") {
    if (!providerHasOpenAIKey()) {
      throw new Error(
        "OpenAI generation is unavailable because OPENAI_API_KEY is not configured. Configure the backend key or switch the AI provider to Gemini or Ollama.",
      );
    }

    const materials = await generateMaterialsWithOpenAI(session, transcript);
    if (!materials) {
      throw new Error(
        "OpenAI generation is unavailable because no content was returned by the provider.",
      );
    }

    return materials;
  }

  if (provider === "ollama") {
    const materials = await generateMaterialsWithOllama(session, transcript);
    if (!materials) {
      throw new Error(
        "Ollama generation is unavailable because no content was returned or the local model could not satisfy the request.",
      );
    }

    return materials;
  }

  if (!providerHasGeminiKey()) {
    throw new Error(
      "Gemini generation is unavailable because GEMINI_API_KEY is not configured. Configure the backend key or switch the AI provider to OpenAI or Ollama.",
    );
  }

  const materials = await generateMaterialsWithGemini(session, transcript);
  if (!materials) {
    throw new Error("Gemini generation is unavailable because no content was returned.");
  }

  return materials;
}

export async function answerChatWithConfiguredProvider(
  record: SessionRecord,
  message: string,
  citations: TranscriptSegment[],
  mockResponder: MockChatResponder,
): Promise<ChatResponse> {
  const provider = resolveGenerationProvider();
  logGenerationSelection(provider, "chat");

  if (provider === "mock") {
    if (!simulatedProvidersEnabled()) {
      throw new Error(
        "Simulated chat is disabled in this environment. Configure OpenAI, Gemini, or Ollama before using the contextual assistant.",
      );
    }
    return mockResponder(record, message, citations);
  }

  if (provider === "openai") {
    if (!providerHasOpenAIKey()) {
      throw new Error(
        "OpenAI chat is unavailable because OPENAI_API_KEY is not configured. Configure the backend key or switch the AI provider to Gemini or Ollama.",
      );
    }

    const response = await answerChatWithOpenAI(record, message, citations);
    if (!response) {
      throw new Error("OpenAI chat is unavailable because no content was returned.");
    }

    return response;
  }

  if (provider === "ollama") {
    const response = await answerChatWithOllama(record, message, citations);
    if (!response) {
      throw new Error(
        "Ollama chat is unavailable because no content was returned by the local model.",
      );
    }

    return response;
  }

  if (!providerHasGeminiKey()) {
    throw new Error(
      "Gemini chat is unavailable because GEMINI_API_KEY is not configured. Configure the backend key or switch the AI provider to OpenAI or Ollama.",
    );
  }

  const response = await answerChatWithGemini(record, message, citations);
  if (!response) {
    throw new Error("Gemini chat is unavailable because no content was returned.");
  }

  return response;
}
