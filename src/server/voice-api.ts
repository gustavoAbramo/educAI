import type {
  AudioSource,
  AssistantWebSearchMode,
  ApiErrorResponse,
  ChatRequest,
  CreateSessionRequest,
  FasterWhisperConnectionStatus,
  GenerationProviderMode,
  MessageRole,
  OllamaConnectionStatus,
  OutputFormat,
  ProviderRuntimeSettingsPatch,
  SessionStatus,
  SessionType,
  SessionRecord,
  TranscriptionProviderMode,
  TranscriptStatus,
  AppSettingsPatch,
  UpdateSessionRequest,
} from "@/lib/voice-intelligence";
import { getFasterWhisperConnectionStatus } from "./faster-whisper-provider";
import { canManageSettings, type WorkspaceSession } from "./auth";
import { getGeminiConnectionStatus, getOpenAIConnectionStatus } from "./cloud-provider-status";
import { persistRecordingUpload, type PendingRecordingUpload } from "./local-recordings";
import { getOllamaConnectionStatus } from "./ollama-provider";
import { answerAssistantMessage, type AssistantRespondRequest } from "./assistant-service";
import {
  ensureProviderRuntimeConfigLoaded,
  getProviderRuntimeConfig,
  updateProviderRuntimeConfig,
} from "./provider-runtime";
import { getProviderRuntimeHealth } from "./provider-runtime-health";
import {
  appendProviderRuntimeHealthHistory,
  getProviderRuntimeHealthHistory,
} from "./provider-runtime-history";
import { serverEnv } from "./runtime-env";
import {
  getAppSettingsCenter,
  getAppVoiceDefaults,
  updateAppSettingsCenter,
  validateAppSettingsCenter,
} from "./settings-center";
import { ensureAppSettingsLoaded } from "./settings-store";
import { ensureSettingsSecretsLoaded } from "./settings-secrets";
import {
  addRecording,
  addUserMessage,
  answerSessionChat,
  createVoiceSession,
  deleteVoiceSession,
  ensureVoiceStoreLoaded,
  generateSessionMaterials,
  getMaterial,
  getRecording,
  getSessionOverview,
  getSessionStatus,
  getTranscript,
  getVoiceSession,
  listChatMessages,
  listMaterials,
  listRecordings,
  listVoiceSessions,
  transcribeSession,
  updateVoiceSession,
  updateSessionStatus,
  updateTranscript,
} from "./voice-store";

type RouteMatch = {
  parts: string[];
};

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-api-key",
    "access-control-max-age": "86400",
  };
}

function json<T>(data: T, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...init.headers,
    },
  });
}

function errorResponse(error: unknown, path: string) {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp,
        path,
      },
    };
    return json(body, { status: error.status });
  }

  if (error instanceof Error && ["SESSION_NOT_FOUND", "AUDIO_NOT_FOUND"].includes(error.message)) {
    return json<ApiErrorResponse>(
      {
        error: {
          code: error.message,
          message:
            error.message === "SESSION_NOT_FOUND" ? "Session not found." : "Audio not found.",
          timestamp,
          path,
        },
      },
      { status: 404 },
    );
  }

  console.error(error);
  return json<ApiErrorResponse>(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected API error.",
        timestamp,
        path,
      },
    },
    { status: 500 },
  );
}

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ApiError(400, "INVALID_REQUEST", "Request body must be valid JSON.", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

const sessionTypes = new Set<SessionType>([
  "CLASS",
  "MENTORING",
  "MEETING",
  "TRAINING",
  "WORKSHOP",
  "CONSULTING",
  "SALES_CALL",
  "PRESENTATION",
  "OTHER",
]);

const sessionStatuses = new Set<SessionStatus>([
  "CREATED",
  "RECORDING",
  "UPLOADING_AUDIO",
  "AUDIO_UPLOADED",
  "TRANSCRIBING",
  "TRANSCRIBED",
  "GENERATING_MATERIALS",
  "READY",
  "FAILED",
  "CANCELED",
]);

const transcriptStatuses = new Set<TranscriptStatus>([
  "PENDING",
  "TRANSCRIBING",
  "COMPLETED",
  "EDITED",
  "FAILED",
]);

const outputFormats = new Set<OutputFormat>(["TEXT", "MARKDOWN", "JSON"]);

const audioSources = new Set<AudioSource>(["DESKTOP", "WEB", "BOT", "UPLOAD"]);
const transcriptionProviderModes = new Set<TranscriptionProviderMode>([
  "mock",
  "openai",
  "gemini",
  "faster-whisper",
]);
const generationProviderModes = new Set<GenerationProviderMode>([
  "mock",
  "openai",
  "gemini",
  "ollama",
]);
const assistantWebSearchModes = new Set<AssistantWebSearchMode>(["auto", "on", "off"]);

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function maxAudioUploadBytes() {
  const parsed = Number(serverEnv("EDUCAI_MAX_AUDIO_UPLOAD_BYTES"));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 500 * 1024 * 1024;
}

function enforceRequestSize(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ApiError(
      413,
      "AUDIO_UPLOAD_TOO_LARGE",
      `audio.file exceeds the configured limit of ${maxBytes} bytes.`,
    );
  }
}

function validateSessionInput(input: Partial<CreateSessionRequest>) {
  const title = asString(input.title);
  const type = asString(input.type);
  const language = asString(input.language);

  if (!title) {
    throw new ApiError(400, "INVALID_REQUEST", "session.title is required.");
  }
  if (!sessionTypes.has(type as SessionType)) {
    throw new ApiError(400, "INVALID_REQUEST", "session.type is required and must be valid.");
  }
  if (!language) {
    throw new ApiError(400, "INVALID_REQUEST", "session.language is required.");
  }

  return {
    title,
    type: type as SessionType,
    language,
  };
}

function validateSessionPatch(payload: Record<string, unknown>): UpdateSessionRequest {
  const patch: UpdateSessionRequest = {};

  if ("title" in payload) {
    const title = asString(payload.title);
    if (!title) {
      throw new ApiError(400, "INVALID_REQUEST", "session.title must not be empty.");
    }
    patch.title = title;
  }

  if ("participants" in payload) {
    if (!Array.isArray(payload.participants)) {
      throw new ApiError(400, "INVALID_REQUEST", "session.participants must be an array.");
    }

    patch.participants = payload.participants
      .map((participant) => {
        if (!participant || typeof participant !== "object" || Array.isArray(participant)) {
          return undefined;
        }
        const data = participant as Record<string, unknown>;
        const name = asString(data.name);
        if (!name) return undefined;
        return {
          id: asString(data.id) || undefined,
          name,
          email: asString(data.email) || undefined,
          role: asString(data.role) || undefined,
        };
      })
      .filter((participant): participant is NonNullable<typeof participant> =>
        Boolean(participant),
      );
  }

  if ("metadata" in payload) {
    if (
      !payload.metadata ||
      typeof payload.metadata !== "object" ||
      Array.isArray(payload.metadata)
    ) {
      throw new ApiError(400, "INVALID_REQUEST", "session.metadata must be an object.");
    }

    patch.metadata = payload.metadata as Record<string, unknown>;
  }

  return patch;
}

function validatePatchedStatus(value: unknown): SessionStatus {
  const status = asString(value);
  if (!sessionStatuses.has(status as SessionStatus)) {
    throw new ApiError(400, "INVALID_REQUEST", "status must be a valid SessionStatus value.");
  }
  return status as SessionStatus;
}

function validateTranscriptPatch(payload: Record<string, unknown>) {
  const text = asString(payload.text);
  const status = asString(payload.status);
  const format = asString(payload.format);
  const segments = Array.isArray(payload.segments) ? payload.segments : [];

  if (!text) {
    throw new ApiError(400, "INVALID_REQUEST", "transcript.text is required.");
  }
  if (!transcriptStatuses.has(status as TranscriptStatus)) {
    throw new ApiError(400, "INVALID_REQUEST", "transcript.status must be valid.");
  }
  if (!outputFormats.has(format as OutputFormat)) {
    throw new ApiError(400, "INVALID_REQUEST", "transcript.format must be valid.");
  }
  if (!Array.isArray(segments)) {
    throw new ApiError(400, "INVALID_REQUEST", "transcript.segments must be an array.");
  }

  return {
    text,
    status: status as TranscriptStatus,
    format: format as OutputFormat,
    segments,
  };
}

function validateProviderSettingsPatch(
  payload: Record<string, unknown>,
): ProviderRuntimeSettingsPatch {
  const patch: ProviderRuntimeSettingsPatch = {};

  if ("transcriptionProvider" in payload) {
    const provider = asString(payload.transcriptionProvider);
    if (!transcriptionProviderModes.has(provider as TranscriptionProviderMode)) {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "transcriptionProvider must be mock (development only), openai, gemini, or faster-whisper.",
      );
    }
    patch.transcriptionProvider = provider as TranscriptionProviderMode;
  }

  if ("generationProvider" in payload) {
    const provider = asString(payload.generationProvider);
    if (!generationProviderModes.has(provider as GenerationProviderMode)) {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "generationProvider must be mock (development only), openai, gemini, or ollama.",
      );
    }
    patch.generationProvider = provider as GenerationProviderMode;
  }

  if ("assistantWebSearch" in payload) {
    const mode = asString(payload.assistantWebSearch);
    if (!assistantWebSearchModes.has(mode as AssistantWebSearchMode)) {
      throw new ApiError(400, "INVALID_REQUEST", "assistantWebSearch must be auto, on, or off.");
    }
    patch.assistantWebSearch = mode as AssistantWebSearchMode;
  }

  if ("ollamaBaseUrl" in payload) {
    if (typeof payload.ollamaBaseUrl !== "string") {
      throw new ApiError(400, "INVALID_REQUEST", "ollamaBaseUrl must be a string.");
    }
    patch.ollamaBaseUrl = payload.ollamaBaseUrl;
  }

  if ("ollamaModel" in payload) {
    if (typeof payload.ollamaModel !== "string") {
      throw new ApiError(400, "INVALID_REQUEST", "ollamaModel must be a string.");
    }
    patch.ollamaModel = payload.ollamaModel;
  }

  if ("geminiModel" in payload) {
    if (typeof payload.geminiModel !== "string") {
      throw new ApiError(400, "INVALID_REQUEST", "geminiModel must be a string.");
    }
    patch.geminiModel = payload.geminiModel;
  }

  if ("fasterWhisperBaseUrl" in payload) {
    if (typeof payload.fasterWhisperBaseUrl !== "string") {
      throw new ApiError(400, "INVALID_REQUEST", "fasterWhisperBaseUrl must be a string.");
    }
    patch.fasterWhisperBaseUrl = payload.fasterWhisperBaseUrl;
  }

  if ("fasterWhisperModel" in payload) {
    if (typeof payload.fasterWhisperModel !== "string") {
      throw new ApiError(400, "INVALID_REQUEST", "fasterWhisperModel must be a string.");
    }
    patch.fasterWhisperModel = payload.fasterWhisperModel;
  }

  return patch;
}

function numberOrUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMetadata(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

async function readRecordingUpload(request: Request): Promise<PendingRecordingUpload> {
  const contentType = request.headers.get("content-type") ?? "";
  const maxBytes = maxAudioUploadBytes();
  enforceRequestSize(request, maxBytes);

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") ?? form.get("audio") ?? form.get("recording");
    const source = asString(form.get("source"));

    if (!audioSources.has(source as AudioSource)) {
      throw new ApiError(400, "INVALID_REQUEST", "audio.source is required and must be valid.");
    }

    if (isUploadedFile(file)) {
      if (file.size > maxBytes) {
        throw new ApiError(
          413,
          "AUDIO_UPLOAD_TOO_LARGE",
          `audio.file exceeds the configured limit of ${maxBytes} bytes.`,
        );
      }
      return {
        file,
        source: source as AudioSource,
        fileName: file.name || "recording.webm",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        durationSeconds: numberOrUndefined(form.get("durationSeconds")),
        status: "UPLOADED",
        metadata: parseMetadata(form.get("metadata")),
      };
    }

    throw new ApiError(400, "INVALID_REQUEST", "audio.file is required in multipart upload.");
  }

  if (contentType.includes("application/json")) {
    throw new ApiError(400, "INVALID_REQUEST", "audio.file is required in upload endpoint.");
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new ApiError(400, "INVALID_REQUEST", "audio.file is required in upload endpoint.");
  }
  if (bytes.byteLength > maxBytes) {
    throw new ApiError(
      413,
      "AUDIO_UPLOAD_TOO_LARGE",
      `audio.file exceeds the configured limit of ${maxBytes} bytes.`,
    );
  }

  const source = asString(request.headers.get("x-audio-source"));
  if (!audioSources.has(source as AudioSource)) {
    throw new ApiError(400, "INVALID_REQUEST", "audio.source is required and must be valid.");
  }

  return {
    source: source as AudioSource,
    bytes,
    fileName: request.headers.get("x-file-name") ?? "recording.webm",
    mimeType: contentType || "application/octet-stream",
    sizeBytes: bytes.byteLength,
    status: "UPLOADED",
    metadata: {},
  };
}

function parseRoute(pathname: string): RouteMatch | null {
  if (!pathname.startsWith("/api/v1")) return null;

  const parts = pathname
    .replace(/^\/api\/v1\/?/, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  return { parts };
}

function requireSession(sessionId: string | undefined, ownerId?: string): SessionRecord {
  if (!sessionId) {
    throw new ApiError(400, "SESSION_ID_REQUIRED", "A session id is required.");
  }

  const record = getVoiceSession(sessionId, ownerId);
  if (!record) {
    throw new ApiError(404, "SESSION_NOT_FOUND", "Session not found.");
  }

  return record;
}

function sessionStatus(record: SessionRecord) {
  return record.status;
}

async function handleSessions(request: Request, route: RouteMatch, ownerId?: string) {
  const [, sessionId, resource, resourceId] = route.parts;

  if (!sessionId) {
    if (request.method === "GET") {
      return json({
        data: listVoiceSessions(ownerId).map((record) => ({
          ...record.session,
          audioCount: record.recordings.length,
          hasTranscript: Boolean(record.transcript),
          hasMaterials: Boolean(record.materials),
        })),
      });
    }

    if (request.method === "POST") {
      const body = await readJson<Partial<CreateSessionRequest>>(request);
      const validated = validateSessionInput(body);
      const created = await createVoiceSession(
        {
          ...body,
          ...validated,
          participants: body.participants ?? [],
          metadata: body.metadata ?? {},
        },
        ownerId,
      );
      return json({ data: created.session }, { status: 201 });
    }
  }

  const record = requireSession(sessionId, ownerId);

  if (!resource && request.method === "GET") {
    return json({ data: record.session });
  }

  if (!resource && request.method === "PATCH") {
    const body = await readJson<Record<string, unknown>>(request);
    return json({ data: await updateVoiceSession(record.session.id, validateSessionPatch(body)) });
  }

  if (!resource && request.method === "DELETE") {
    await deleteVoiceSession(record.session.id);
    return json({ data: { id: record.session.id, deleted: true } });
  }

  if (resource === "overview" && request.method === "GET") {
    return json({ data: getSessionOverview(record.session.id) });
  }

  if (resource === "status" && request.method === "GET") {
    return json({ data: sessionStatus(record) });
  }

  if (resource === "status" && request.method === "PATCH") {
    const body = await readJson<Record<string, unknown>>(request);
    const status = validatePatchedStatus(body.status);
    const currentStep = asString(body.currentStep) || undefined;
    const progress = typeof body.progress === "number" ? body.progress : undefined;
    const error = asString(body.error) || undefined;
    const updated = await updateSessionStatus(
      record.session.id,
      status,
      currentStep,
      progress,
      error,
    );
    return json({ data: updated });
  }

  if (resource === "audio" && request.method === "POST") {
    try {
      const upload = await persistRecordingUpload(
        record.session.id,
        await readRecordingUpload(request),
      );
      const audio = await addRecording(record.session.id, upload);
      return json({ data: audio }, { status: 201 });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "AUDIO_UPLOAD_FAILED", "Failed to upload audio.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (resource === "audio" && request.method === "GET") {
    return json({ data: listRecordings(record.session.id) });
  }

  if (resource === "transcribe" && request.method === "POST") {
    if (record.recordings.length === 0) {
      throw new ApiError(
        404,
        "AUDIO_NOT_FOUND",
        "Transcript can only be generated after audio upload.",
      );
    }
    try {
      const transcript = await transcribeSession(record.session.id);
      return json({ data: transcript }, { status: 201 });
    } catch (error) {
      throw new ApiError(500, "TRANSCRIPTION_FAILED", "Failed to transcribe audio.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (resource === "transcript" && request.method === "GET") {
    const transcript = getTranscript(record.session.id);
    if (!transcript) {
      throw new ApiError(404, "AUDIO_NOT_FOUND", "Transcript is not available yet.");
    }
    return json({ data: transcript });
  }

  if (resource === "transcript" && request.method === "PATCH") {
    const body = await readJson<Record<string, unknown>>(request);
    const payload = validateTranscriptPatch(body);
    const transcript = await updateTranscript(record.session.id, payload);
    return json({ data: transcript });
  }

  if (resource === "materials" && request.method === "POST" && resourceId === "generate") {
    if (!record.transcript) {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "materials can only be generated when transcript exists.",
      );
    }
    try {
      const materials = await generateSessionMaterials(record.session.id);
      return json({ data: materials?.items ?? [] }, { status: 201 });
    } catch (error) {
      throw new ApiError(500, "MATERIAL_GENERATION_FAILED", "Failed to generate materials.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (resource === "materials" && request.method === "GET" && !resourceId) {
    return json({ data: listMaterials(record.session.id) });
  }

  if (resource === "materials" && request.method === "GET" && resourceId) {
    const material = getMaterial(record.session.id, resourceId);
    if (!material) {
      throw new ApiError(404, "MATERIAL_GENERATION_FAILED", "Material not found.");
    }
    return json({ data: material });
  }

  if (resource === "chat" && resourceId === "messages" && request.method === "POST") {
    const body = await readJson<ChatRequest>(request);
    const message = body.message?.trim();
    if (!message) {
      throw new ApiError(400, "INVALID_REQUEST", "chat.message is required.");
    }

    try {
      const userMessage = await addUserMessage(record.session.id, message);
      const assistant = await answerSessionChat(record.session.id, message);
      return json({ data: [userMessage, assistant.message] }, { status: 201 });
    } catch (error) {
      throw new ApiError(500, "CHAT_FAILED", "Failed to process chat message.", {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (resource === "chat" && resourceId === "messages" && request.method === "GET") {
    return json({ data: listChatMessages(record.session.id) });
  }

  throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method or endpoint not allowed.");
}

export async function handleVoiceApiRequest(
  request: Request,
  session?: WorkspaceSession,
): Promise<Response | null> {
  const url = new URL(request.url);
  const route = parseRoute(url.pathname);
  if (!route) return null;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const isSettings = route.parts[0] === "settings";
    const isVoiceDefaults =
      isSettings &&
      route.parts.length === 2 &&
      route.parts[1] === "audio-defaults" &&
      request.method === "GET";
    if (isSettings && session && !canManageSettings(session) && !isVoiceDefaults) {
      throw new ApiError(
        403,
        "ADMIN_REQUIRED",
        "As configurações do servidor exigem uma conta de administração.",
      );
    }

    await ensureAppSettingsLoaded();
    await ensureSettingsSecretsLoaded();
    await ensureVoiceStoreLoaded();
    await ensureProviderRuntimeConfigLoaded();

    if (route.parts.length === 0 || route.parts[0] === "health") {
      return json({
        data: {
          service: "educAI Voice Intelligence API",
          version: "0.1.0",
          status: "ok",
        },
      });
    }

    if (route.parts[0] === "sessions") {
      return await handleSessions(request, route, session?.ownerId);
    }

    if (isVoiceDefaults) return json({ data: getAppVoiceDefaults() });

    if (route.parts[0] === "settings" && route.parts[1] === "status" && request.method === "GET") {
      return json({ data: await validateAppSettingsCenter() });
    }

    if (
      route.parts[0] === "settings" &&
      route.parts[1] === "validate" &&
      request.method === "POST"
    ) {
      return json({ data: await validateAppSettingsCenter() });
    }

    if (route.parts[0] === "settings" && route.parts.length === 1 && request.method === "GET") {
      return json({ data: await getAppSettingsCenter() });
    }

    if (route.parts[0] === "settings" && route.parts.length === 1 && request.method === "PATCH") {
      const body = await readJson<AppSettingsPatch>(request);
      return json({ data: await updateAppSettingsCenter(body) });
    }

    if (route.parts[0] === "settings" && route.parts[1] === "providers") {
      if (
        route.parts[2] === "faster-whisper" &&
        route.parts[3] === "status" &&
        request.method === "GET"
      ) {
        const data: FasterWhisperConnectionStatus = await getFasterWhisperConnectionStatus();
        return json({ data });
      }

      if (route.parts[2] === "ollama" && route.parts[3] === "status" && request.method === "GET") {
        const data: OllamaConnectionStatus = await getOllamaConnectionStatus();
        return json({ data });
      }

      if (route.parts[2] === "gemini" && route.parts[3] === "status" && request.method === "GET") {
        const data = await getGeminiConnectionStatus();
        return json({ data });
      }

      if (route.parts[2] === "openai" && route.parts[3] === "status" && request.method === "GET") {
        const data = await getOpenAIConnectionStatus();
        return json({ data });
      }

      if (route.parts[2] === "runtime-status" && request.method === "GET") {
        const data = await getProviderRuntimeHealth();
        await appendProviderRuntimeHealthHistory(data);
        return json({ data });
      }

      if (route.parts[2] === "runtime-history" && request.method === "GET") {
        const data = await getProviderRuntimeHealthHistory();
        return json({ data });
      }

      if (request.method === "GET") {
        return json({ data: getProviderRuntimeConfig() });
      }

      if (request.method === "PATCH") {
        const body = await readJson<Record<string, unknown>>(request);
        try {
          const data = await updateProviderRuntimeConfig(validateProviderSettingsPatch(body));
          return json({ data });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to update provider settings.";
          throw new ApiError(400, "INVALID_REQUEST", message);
        }
      }
    }

    if (
      route.parts[0] === "assistant" &&
      route.parts[1] === "respond" &&
      request.method === "POST"
    ) {
      const body = await readJson<AssistantRespondRequest>(request);
      const message = asString(body.message);
      if (!message) {
        throw new ApiError(400, "INVALID_REQUEST", "assistant.message is required.");
      }

      const data = await answerAssistantMessage({
        message,
        mode: body.mode,
        context: body.context,
      });

      return json({ data }, { status: 200 });
    }

    throw new ApiError(404, "ENDPOINT_NOT_FOUND", "Endpoint not found.");
  } catch (error) {
    return errorResponse(error, url.pathname);
  }
}
