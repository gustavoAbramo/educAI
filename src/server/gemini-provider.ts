import type {
  CallMaterials,
  ChatMessage,
  ChatResponse,
  SessionRecord,
  TranscriptSegment,
  VoiceRecording,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import { normalizeTechnicalTerms } from "@/lib/technical-terms";
import { readStoredRecording } from "./local-recordings";
import {
  callMaterialsFromGeneratedPayload,
  materialsJsonShape,
  materialsPromptGuidelines,
} from "./material-generation";
import { ProviderHttpError, providerRequestTimeoutMs, requestProviderJson } from "./provider-http";
import { defaultGeminiModel, getProviderRuntimeConfig } from "./provider-runtime";
import { serverEnv } from "./runtime-env";
import { getConfiguredSecret } from "./settings-secrets";
import { sessionContextInstruction, sessionContextText } from "./session-context";
import { transcriptSegmentsFromText } from "./transcript-segments";

type GeminiJson = Record<string, unknown>;

function apiKey() {
  return getConfiguredSecret("GEMINI_API_KEY")?.trim();
}

// O modelo escolhido em Configuracoes vale para tudo; as variaveis de
// ambiente, quando definidas, continuam tendo prioridade.
function configuredModel() {
  return getProviderRuntimeConfig().settings.geminiModel.trim() || defaultGeminiModel;
}

export function geminiTranscriptionModel() {
  return serverEnv("GEMINI_TRANSCRIBE_MODEL")?.trim() || configuredModel();
}

export function geminiInsightsModel() {
  return (
    serverEnv("GEMINI_INSIGHTS_MODEL")?.trim() ||
    serverEnv("GEMINI_TRANSCRIBE_MODEL")?.trim() ||
    configuredModel()
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

// Timeout nao entra: repetir uma chamada que ja demorou demais so gasta a
// cota diaria (pequena no plano gratuito) e multiplica a espera.
function isTransientGeminiError(error: unknown) {
  return (
    error instanceof ProviderHttpError &&
    (error.code === "NETWORK_ERROR" ||
      error.status === 500 ||
      error.status === 502 ||
      error.status === 503 ||
      error.status === 504)
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geminiFetch(model: string, body: unknown, timeoutMs?: number) {
  const key = apiKey();
  if (!key) return undefined;

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestProviderJson<GeminiJson>({
        provider: "Gemini",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        init: {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify(body),
        },
        timeoutMs,
      });
    } catch (error) {
      const canRetry = isTransientGeminiError(error) && attempt < maxAttempts;
      if (!canRetry) throw error;

      console.warn(`[educAI] Gemini request failed; retrying ${attempt + 1}/${maxAttempts}.`);
      await wait(attempt * 750);
    }
  }

  return undefined;
}

function extractGeminiText(result: GeminiJson | undefined) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const content = (candidate as GeminiJson).content;
    if (!content || typeof content !== "object") continue;

    const parts = Array.isArray((content as GeminiJson).parts)
      ? ((content as GeminiJson).parts as unknown[])
      : [];

    const text = parts
      .map((part) => (part && typeof part === "object" ? (part as GeminiJson).text : undefined))
      .filter((part): part is string => typeof part === "string")
      .join("\n")
      .trim();

    if (text) return text;
  }

  return undefined;
}

function extractJsonText(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  if (fenced) return fenced;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

export async function generateMaterialsWithGemini(
  session: VoiceSession,
  transcript: VoiceTranscript,
): Promise<CallMaterials | undefined> {
  if (!apiKey()) return undefined;

  const model = geminiInsightsModel();
  const result = await geminiFetch(
    model,
    {
      generationConfig: {
        responseMimeType: "application/json",
      },
      contents: [
        {
          parts: [
            {
              text: [
                "Analyze this transcript and return only valid JSON.",
                materialsPromptGuidelines(session),
                sessionContextInstruction(session),
                "Required JSON shape:",
                JSON.stringify(materialsJsonShape(), null, 2),
                "Session context:",
                sessionContextText(session),
                "Transcript:",
                transcript.text,
              ].join("\n"),
            },
          ],
        },
      ],
    },
    // Todos os materiais (resumo, relatorio, mapa mental...) saem de uma
    // chamada so; 30s nao basta para gerar esse JSON inteiro.
    providerRequestTimeoutMs(180_000),
  );

  const output = extractGeminiText(result);
  if (!output) return undefined;

  const parsed = JSON.parse(extractJsonText(output)) as GeminiJson;
  return callMaterialsFromGeneratedPayload(session, parsed, `gemini:${model}`);
}

export async function transcribeRecordingWithGemini(
  session: VoiceSession,
  recording?: VoiceRecording,
): Promise<VoiceTranscript | undefined> {
  if (!apiKey() || !recording) return undefined;

  const stored = await readStoredRecording(recording);
  if (!stored) return undefined;

  const model = geminiTranscriptionModel();
  const result = await geminiFetch(
    model,
    {
      contents: [
        {
          parts: [
            {
              text: [
                "Transcribe this audio as accurately as possible.",
                "Return only the transcript text.",
                "Preserve English product and technology names exactly when heard, such as frontend, backend, full stack, Lovable, API, endpoint, webhook, TypeScript, JavaScript, Supabase, Fireflies, OpenAI, ChatGPT, React, Vite, GitHub, Next.js, Node.js, Docker, Vercel, Firebase, Prisma, Tailwind, Figma, and Stripe.",
                "Correct obvious speech-recognition mistakes for technical terms, but do not rewrite the speaker's meaning.",
                "If more than one person is audible, separate turns with stable labels, one turn per paragraph, like `Speaker 1: ...` and `Speaker 2: ...`.",
                "Do not invent names; use session participant names only when they are clear.",
                "Use punctuation and paragraph breaks to make the transcript readable.",
                "Session context:",
                sessionContextText(session),
              ].join("\n"),
            },
            {
              inlineData: {
                mimeType: stored.mimeType,
                data: bytesToBase64(stored.bytes),
              },
            },
          ],
        },
      ],
    },
    // Transcrever o audio inteiro de uma aula leva minutos, nao segundos.
    providerRequestTimeoutMs(600_000),
  );

  const text = normalizeTechnicalTerms(extractGeminiText(result) ?? "");
  if (!text) return undefined;

  return {
    id: `trn_${crypto.randomUUID()}`,
    sessionId: session.id,
    language: session.language,
    status: "COMPLETED",
    text,
    segments: transcriptSegmentsFromText(session, text),
    format: "TEXT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: `gemini:${model}`,
  };
}

export async function answerGeneralAssistantWithGemini(
  instructions: string,
  message: string,
): Promise<string | undefined> {
  if (!apiKey()) return undefined;

  const model = geminiInsightsModel();
  const result = await geminiFetch(model, {
    contents: [
      {
        parts: [
          {
            text: `${instructions}\n\nPergunta do usuario:\n${message}`,
          },
        ],
      },
    ],
  });

  return extractGeminiText(result)?.trim();
}

export async function answerChatWithGemini(
  record: SessionRecord,
  message: string,
  citations: TranscriptSegment[],
): Promise<ChatResponse | undefined> {
  if (!apiKey() || !record.transcript) return undefined;

  const model = geminiInsightsModel();
  const result = await geminiFetch(
    model,
    {
      contents: [
        {
          parts: [
            {
              text: [
                "Responda perguntas sobre uma sessao usando apenas a transcricao, os materiais gerados e o contexto da sessao.",
                "Se faltar evidencia, diga isso claramente.",
                sessionContextInstruction(record.session),
                `Pergunta: ${message}`,
                "Contexto da sessao:",
                sessionContextText(record.session),
                "Materiais:",
                JSON.stringify(record.materials ?? {}, null, 2),
                "Transcricao:",
                record.transcript.text,
              ].join("\n"),
            },
          ],
        },
      ],
    },
    // O chat manda a transcricao e os materiais inteiros junto da pergunta.
    providerRequestTimeoutMs(120_000),
  );

  const content = extractGeminiText(result)?.trim();
  if (!content) return undefined;

  const assistantMessage: ChatMessage = {
    id: `msg_${crypto.randomUUID()}`,
    sessionId: record.session.id,
    role: "ASSISTANT",
    content,
    createdAt: new Date().toISOString(),
  };

  return {
    message: assistantMessage,
    citations,
  };
}
