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
  materialsJsonSchema,
  materialsPromptGuidelines,
} from "./material-generation";
import { requestProviderJson } from "./provider-http";
import { serverEnv } from "./runtime-env";
import { getConfiguredSecret } from "./settings-secrets";
import { sessionContextInstruction, sessionContextText } from "./session-context";
import { transcriptSegmentsFromText } from "./transcript-segments";

type OpenAIJson = Record<string, unknown>;

function apiKey() {
  return getConfiguredSecret("OPENAI_API_KEY");
}

export function openAITranscriptionModel() {
  return serverEnv("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-transcribe";
}

export function openAIInsightsModel() {
  return serverEnv("OPENAI_INSIGHTS_MODEL") ?? "gpt-4o-mini";
}

function normalizeLanguage(language: string) {
  const [base] = language.toLowerCase().split("-");
  return /^[a-z]{2,3}$/.test(base) ? base : undefined;
}

async function openAIFetch(path: string, init: RequestInit) {
  const key = apiKey();
  if (!key) return undefined;

  return requestProviderJson<OpenAIJson>({
    provider: "OpenAI",
    url: `https://api.openai.com/v1${path}`,
    init: {
      ...init,
      headers: {
        authorization: `Bearer ${key}`,
        ...init.headers,
      },
    },
  });
}

export async function transcribeRecordingWithOpenAI(
  session: VoiceSession,
  recording?: VoiceRecording,
): Promise<VoiceTranscript | undefined> {
  if (!apiKey() || !recording) return undefined;

  const stored = await readStoredRecording(recording);
  if (!stored) return undefined;

  const form = new FormData();
  const audio = new Blob([stored.bytes as BlobPart], { type: stored.mimeType });
  form.append("file", audio, stored.fileName);
  form.append("model", openAITranscriptionModel());
  form.append("response_format", "json");

  const language = normalizeLanguage(session.language);
  if (language) form.append("language", language);

  if (session.title && session.title !== "Untitled call") {
    form.append(
      "prompt",
      [
        "Preserve names, domain terms, action items, decisions, and educational context.",
        "Preserve English product and technology names exactly when heard, such as frontend, backend, full stack, Lovable, API, endpoint, webhook, TypeScript, JavaScript, Supabase, Fireflies, OpenAI, ChatGPT, React, Vite, GitHub, Next.js, Node.js, Docker, Vercel, Firebase, Prisma, Tailwind, Figma, and Stripe.",
        "Correct obvious speech-recognition mistakes for technical terms, but do not rewrite the speaker's meaning.",
        "If more than one person is audible, separate turns with stable labels, one turn per paragraph, like `Speaker 1: ...` and `Speaker 2: ...`.",
        "Do not invent names; use session participant names only when they are clear.",
        "Use punctuation and paragraph breaks to make the transcript readable.",
        "Session context:",
        sessionContextText(session),
      ].join("\n"),
    );
  }

  const result = await openAIFetch("/audio/transcriptions", {
    method: "POST",
    body: form,
  });

  const text = typeof result?.text === "string" ? normalizeTechnicalTerms(result.text.trim()) : "";
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
    provider: `openai:${openAITranscriptionModel()}`,
  };
}

function extractOutputText(result: OpenAIJson | undefined) {
  if (!result) return undefined;
  if (typeof result.output_text === "string") return result.output_text;

  const output = Array.isArray(result.output) ? result.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const outputItem = item as OpenAIJson;
    const content = Array.isArray(outputItem.content) ? outputItem.content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const fields = part as OpenAIJson;
      if (typeof fields.text === "string") return fields.text;
    }
  }

  return undefined;
}

export async function generateMaterialsWithOpenAI(
  session: VoiceSession,
  transcript: VoiceTranscript,
): Promise<CallMaterials | undefined> {
  if (!apiKey()) return undefined;

  const result = await openAIFetch("/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: openAIInsightsModel(),
      instructions: [
        "You analyze transcripts for a Fireflies-style education and meeting intelligence API.",
        "Return high-signal, production-ready materials.",
        materialsPromptGuidelines(session),
        sessionContextInstruction(session),
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Session context:",
                sessionContextText(session),
                "Transcript:",
                transcript.text,
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "call_materials",
          strict: true,
          schema: materialsJsonSchema(),
        },
      },
    }),
  });

  const output = extractOutputText(result);
  if (!output) return undefined;

  const parsed = JSON.parse(output) as OpenAIJson;
  return callMaterialsFromGeneratedPayload(session, parsed, `openai:${openAIInsightsModel()}`);
}

export async function answerChatWithOpenAI(
  record: SessionRecord,
  message: string,
  citations: TranscriptSegment[],
): Promise<ChatResponse | undefined> {
  if (!apiKey() || !record.transcript) return undefined;

  const result = await openAIFetch("/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: openAIInsightsModel(),
      instructions: [
        "Answer questions about a session using only the transcript, generated materials, and session context.",
        "Be direct and mention when the transcript does not contain enough evidence.",
        sessionContextInstruction(record.session),
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Question: ${message}`,
                "Session context:",
                sessionContextText(record.session),
                "Materials:",
                JSON.stringify(record.materials ?? {}, null, 2),
                "Transcript:",
                record.transcript.text,
              ].join("\n"),
            },
          ],
        },
      ],
    }),
  });

  const content = extractOutputText(result)?.trim();
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

export async function answerGeneralAssistantWithOpenAI(
  instructions: string,
  message: string,
  options?: {
    useWebSearch?: boolean;
  },
): Promise<string | undefined> {
  if (!apiKey()) return undefined;

  const include = options?.useWebSearch ? ["web_search_call.results"] : undefined;
  const result = await openAIFetch("/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: openAIInsightsModel(),
      instructions,
      ...(include ? { include } : {}),
      ...(options?.useWebSearch
        ? {
            tools: [
              {
                type: "web_search",
                user_location: {
                  type: "approximate",
                  country: "BR",
                },
              },
            ],
            tool_choice: "auto",
          }
        : {}),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
          ],
        },
      ],
    }),
  });

  return extractOutputText(result)?.trim();
}

export type OpenAIWebSearchAnswer = {
  content?: string;
  usedWebSearch: boolean;
  sources: Array<{
    title?: string;
    url: string;
  }>;
};

function extractWebSearchSources(result: OpenAIJson | undefined) {
  if (!result) return [];

  const output = Array.isArray(result.output) ? result.output : [];
  const sources: Array<{ title?: string; url: string }> = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const outputItem = item as OpenAIJson;
    if (outputItem.type !== "web_search_call") continue;

    const results = Array.isArray(outputItem.results) ? outputItem.results : [];
    for (const resultItem of results) {
      if (!resultItem || typeof resultItem !== "object") continue;
      const source = resultItem as OpenAIJson;
      const url = typeof source.url === "string" ? source.url : undefined;
      const title = typeof source.title === "string" ? source.title : undefined;
      if (!url) continue;
      sources.push({ title, url });
    }
  }

  return sources;
}

export async function answerGeneralAssistantWithOpenAIWebSearch(
  instructions: string,
  message: string,
): Promise<OpenAIWebSearchAnswer | undefined> {
  if (!apiKey()) return undefined;

  const result = await openAIFetch("/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: openAIInsightsModel(),
      instructions,
      include: ["web_search_call.results"],
      tools: [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            country: "BR",
          },
        },
      ],
      tool_choice: "auto",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
          ],
        },
      ],
    }),
  });

  return {
    content: extractOutputText(result)?.trim(),
    usedWebSearch: true,
    sources: extractWebSearchSources(result),
  };
}
