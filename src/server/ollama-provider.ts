import type {
  CallMaterials,
  ChatMessage,
  ChatResponse,
  OllamaConnectionStatus,
  ProviderRuntimeCheck,
  SessionRecord,
  TranscriptSegment,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import {
  callMaterialsFromGeneratedPayload,
  materialsJsonShape,
  materialsPromptGuidelines,
} from "./material-generation";
import { providerRequestTimeoutMs, requestProviderJson } from "./provider-http";
import { getProviderRuntimeConfig } from "./provider-runtime";
import { sessionContextInstruction, sessionContextText } from "./session-context";

type OllamaJson = Record<string, unknown>;
type OllamaJsonRepairResult = {
  payload: OllamaJson;
  repaired: boolean;
};
type OllamaParsedJson = {
  payload: OllamaJson;
  issue?: string;
};

const materialPayloadKeys = [
  "summary",
  "topics",
  "technicalReport",
  "lessonDiagnosis",
  "actionItems",
  "questions",
  "mindMap",
  "executiveHandoff",
  "suggestedResponses",
  "commercialBrief",
];

function resolveOllamaSettings() {
  const { settings } = getProviderRuntimeConfig();
  return {
    baseUrl: settings.ollamaBaseUrl.replace(/\/+$/, ""),
    model: settings.ollamaModel.trim(),
  };
}

function extractText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function check(
  id: string,
  label: string,
  status: ProviderRuntimeCheck["status"],
  detail: string,
): ProviderRuntimeCheck {
  return {
    id,
    label,
    status,
    detail,
  };
}

function isJsonGenerationValid(output: string) {
  try {
    const parsed = JSON.parse(extractJsonText(output)) as Record<string, unknown>;
    return parsed.ok === true;
  } catch {
    return false;
  }
}

function parseOllamaJsonOutput(output: string): OllamaJson | undefined {
  if (!output.trim()) return undefined;

  try {
    const parsed = JSON.parse(extractJsonText(output)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as OllamaJson)
      : undefined;
  } catch {
    return undefined;
  }
}

function hasUsableMaterialPayload(payload: OllamaJson) {
  return materialPayloadKeys.some((key) => {
    const value = payload[key];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return typeof value === "string" && value.trim().length > 0;
  });
}

function parseOllamaMaterialsOutput(output: string): OllamaParsedJson | undefined {
  const payload = parseOllamaJsonOutput(output);
  if (!payload) {
    return undefined;
  }

  if (!hasUsableMaterialPayload(payload)) {
    return {
      payload,
      issue: "JSON valido, mas sem secoes reconheciveis de materiais.",
    };
  }

  return { payload };
}

async function ollamaFetch(path: string, body?: unknown) {
  const { baseUrl } = resolveOllamaSettings();
  return requestProviderJson<OllamaJson>({
    provider: "Ollama",
    url: `${baseUrl}${path}`,
    // Local CPU generation can take minutes; EDUCAI_PROVIDER_TIMEOUT_MS still overrides.
    timeoutMs: body ? providerRequestTimeoutMs(600_000) : undefined,
    init: {
      method: body ? "POST" : "GET",
      headers: body
        ? {
            "content-type": "application/json",
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  });
}

async function generateTextWithOllama(prompt: string, options?: { json?: boolean }) {
  const { model } = resolveOllamaSettings();
  const result = await ollamaFetch("/api/generate", {
    model,
    prompt,
    stream: false,
    // Thinking models (qwen3) spend minutes reasoning on CPU before answering.
    think: false,
    format: options?.json ? "json" : undefined,
    options: {
      temperature: options?.json ? 0.2 : 0.4,
    },
  });

  return extractText(result.response);
}

async function generateJsonWithOllamaRepair(
  prompt: string,
): Promise<OllamaJsonRepairResult | undefined> {
  const firstOutput = await generateTextWithOllama(prompt, { json: true });
  if (!firstOutput) return undefined;

  const parsed = parseOllamaMaterialsOutput(firstOutput);
  if (parsed && !parsed.issue) {
    return {
      payload: parsed.payload,
      repaired: false,
    };
  }

  const repairedOutput = await generateTextWithOllama(
    [
      "You are a strict JSON repair engine.",
      "Repair the following model output into one valid JSON object only.",
      "Do not add markdown, commentary, explanations, or fields that are not implied by the original output.",
      "If a field is incomplete, preserve the closest valid value instead of inventing new facts.",
      parsed?.issue ? `Repair reason: ${parsed.issue}` : "Repair reason: invalid JSON syntax.",
      "Required JSON shape:",
      JSON.stringify(materialsJsonShape(), null, 2),
      "Broken output:",
      firstOutput,
    ].join("\n"),
    { json: true },
  );

  const repaired = repairedOutput ? parseOllamaMaterialsOutput(repairedOutput) : undefined;
  if (!repaired || repaired.issue) {
    throw new Error(
      repaired?.issue ?? "Ollama returned invalid JSON and the repair attempt also failed.",
    );
  }

  return {
    payload: repaired.payload,
    repaired: true,
  };
}

export async function getOllamaConnectionStatus(): Promise<OllamaConnectionStatus> {
  const { baseUrl, model } = resolveOllamaSettings();
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  try {
    const result = await ollamaFetch("/api/tags");
    const models = Array.isArray(result.models) ? result.models : [];
    const availableModels = models
      .map((item) =>
        item && typeof item === "object"
          ? extractText((item as Record<string, unknown>).model) ||
            extractText((item as Record<string, unknown>).name)
          : "",
      )
      .filter(Boolean);

    const activeModelAvailable = availableModels.includes(model);
    let jsonGenerationReady = false;
    let generationProbeMessage = activeModelAvailable
      ? "Modelo encontrado; teste JSON ainda nao executado."
      : "Teste JSON nao executado porque o modelo ativo nao foi encontrado.";

    if (activeModelAvailable) {
      try {
        const probe = await generateTextWithOllama(
          [
            "Return only this JSON object and nothing else:",
            '{"ok":true,"provider":"ollama"}',
          ].join("\n"),
          { json: true },
        );
        jsonGenerationReady = Boolean(probe && isJsonGenerationValid(probe));
        generationProbeMessage = jsonGenerationReady
          ? "Modelo respondeu um JSON simples valido."
          : "Modelo respondeu, mas nao devolveu JSON valido no teste simples.";
      } catch (error) {
        generationProbeMessage =
          error instanceof Error
            ? `Falha no teste de geracao JSON: ${error.message}`
            : "Falha no teste de geracao JSON.";
      }
    }

    const checks = [
      check("endpoint", "Endpoint local", "pass", `Ollama respondeu em ${baseUrl}.`),
      check(
        "model",
        "Modelo ativo",
        activeModelAvailable ? "pass" : "fail",
        activeModelAvailable
          ? `Modelo ${model} encontrado.`
          : `Modelo ${model} nao apareceu entre os modelos locais.`,
      ),
      check(
        "json_generation",
        "Geracao JSON",
        jsonGenerationReady ? "pass" : activeModelAvailable ? "warn" : "fail",
        generationProbeMessage,
      ),
    ];

    const status = activeModelAvailable ? "ready" : "model_missing";
    return {
      provider: "ollama",
      baseUrl,
      model,
      checkedAt,
      status,
      reachable: true,
      activeModelAvailable,
      availableModels,
      jsonGenerationReady,
      latencyMs: Date.now() - startedAt,
      checks,
      message: activeModelAvailable
        ? jsonGenerationReady
          ? `Ollama respondeu, o modelo ${model} esta disponivel e passou no teste JSON.`
          : `Ollama respondeu e o modelo ${model} esta disponivel, mas o teste JSON precisa de atencao.`
        : `Ollama respondeu, mas o modelo ${model} nao apareceu na lista local.`,
    };
  } catch (error) {
    return {
      provider: "ollama",
      baseUrl,
      model,
      checkedAt,
      status: "unreachable",
      reachable: false,
      activeModelAvailable: false,
      availableModels: [],
      jsonGenerationReady: false,
      latencyMs: Date.now() - startedAt,
      checks: [
        check(
          "endpoint",
          "Endpoint local",
          "fail",
          error instanceof Error
            ? error.message
            : "Nao foi possivel conectar ao endpoint configurado do Ollama.",
        ),
        check("model", "Modelo ativo", "fail", "Modelo nao verificado porque o endpoint falhou."),
        check(
          "json_generation",
          "Geracao JSON",
          "fail",
          "Teste JSON nao executado porque o endpoint falhou.",
        ),
      ],
      message:
        error instanceof Error
          ? error.message
          : "Nao foi possivel conectar ao endpoint configurado do Ollama.",
    };
  }
}

export async function generateMaterialsWithOllama(
  session: VoiceSession,
  transcript: VoiceTranscript,
): Promise<CallMaterials | undefined> {
  const { model } = resolveOllamaSettings();

  const prompt = [
    "You analyze transcripts for a Fireflies-style education and meeting intelligence API.",
    "Return only valid JSON with no markdown fence.",
    materialsPromptGuidelines(session),
    sessionContextInstruction(session),
    "Required JSON shape:",
    JSON.stringify(materialsJsonShape(), null, 2),
    "Session context:",
    sessionContextText(session),
    "Transcript:",
    transcript.text,
  ].join("\n");

  const result = await generateJsonWithOllamaRepair(prompt);

  if (!result) return undefined;

  const materials = callMaterialsFromGeneratedPayload(session, result.payload, `ollama:${model}`);
  if (result.repaired) {
    return {
      ...materials,
      model: `ollama:${model}:json-repaired`,
    };
  }

  return materials;
}

export async function answerChatWithOllama(
  record: SessionRecord,
  message: string,
  citations: TranscriptSegment[],
): Promise<ChatResponse | undefined> {
  const { model } = resolveOllamaSettings();
  if (!record.transcript) return undefined;

  const content = await generateTextWithOllama(
    [
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
  );

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

export async function answerGeneralAssistantWithOllama(
  instructions: string,
  message: string,
): Promise<string | undefined> {
  return generateTextWithOllama([instructions, "", "Pergunta do usuario:", message].join("\n"));
}
