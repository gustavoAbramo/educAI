import type {
  FasterWhisperConnectionStatus,
  ProviderRuntimeCheck,
  TranscriptSegment,
  VoiceRecording,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import { normalizeTechnicalTerms } from "@/lib/technical-terms";
import { readStoredRecording } from "./local-recordings";
import { requestProviderJson } from "./provider-http";
import { getProviderRuntimeConfig } from "./provider-runtime";
import { sessionContextText } from "./session-context";
import { transcriptSegmentsFromText } from "./transcript-segments";

type FasterWhisperJson = Record<string, unknown>;

function resolveFasterWhisperSettings() {
  const { settings } = getProviderRuntimeConfig();
  return {
    baseUrl: settings.fasterWhisperBaseUrl.replace(/\/+$/, ""),
    model: settings.fasterWhisperModel.trim(),
  };
}

function extractText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function extractBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function extractBackend(value: unknown): "mock" | "command" | "unknown" {
  return value === "mock" || value === "command" ? value : "unknown";
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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

function parseAvailableModels(payload: FasterWhisperJson) {
  const raw = Array.isArray(payload.models)
    ? payload.models
    : Array.isArray(payload.available_models)
      ? payload.available_models
      : [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const model = item as Record<string, unknown>;
      return extractText(model.id) || extractText(model.model) || extractText(model.name);
    })
    .filter(Boolean);
}

function providerSegments(session: VoiceSession, payload: FasterWhisperJson, text: string) {
  const rawSegments = Array.isArray(payload.segments) ? payload.segments : [];
  const segments: TranscriptSegment[] = rawSegments
    .map((item, index) => {
      if (!item || typeof item !== "object") return undefined;
      const segment = item as Record<string, unknown>;
      const segmentText = normalizeTechnicalTerms(
        extractText(segment.text) || extractText(segment.transcript),
      );
      if (!segmentText) return undefined;

      const startMs = Math.round(
        extractNumber(segment.startMs) ||
          extractNumber(segment.start_ms) ||
          extractNumber(segment.start) * 1000,
      );
      const endMs = Math.round(
        extractNumber(segment.endMs) ||
          extractNumber(segment.end_ms) ||
          extractNumber(segment.end) * 1000,
      );
      const speaker =
        extractText(segment.speaker) || extractText(segment.speakerName) || "Speaker 1";

      return {
        id: extractText(segment.id) || `seg_${crypto.randomUUID()}_${index}`,
        speaker,
        startMs,
        endMs: endMs > 0 ? endMs : Math.max(startMs + 1200, startMs),
        text: segmentText,
      } satisfies TranscriptSegment;
    })
    .filter((item): item is TranscriptSegment => Boolean(item));

  return segments.length > 0 ? segments : transcriptSegmentsFromText(session, text);
}

async function fasterWhisperFetch(path: string, init?: RequestInit) {
  const { baseUrl } = resolveFasterWhisperSettings();
  return requestProviderJson<FasterWhisperJson>({
    provider: "Faster-Whisper",
    url: `${baseUrl}${path}`,
    init,
  });
}

async function runFasterWhisperSmokeTest() {
  try {
    const payload = await fasterWhisperFetch("/smoke-test", {
      method: "POST",
    });
    const ok = extractBoolean(payload.ok);
    const textPreview = extractText(payload.textPreview);
    const latencyMs = extractNumber(payload.latencyMs);

    return {
      ok: ok && Boolean(textPreview),
      detail: ok
        ? `Smoke test executado${latencyMs ? ` em ${latencyMs}ms` : ""}.`
        : extractText(payload.error) || "Smoke test nao retornou texto valido.",
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error ? error.message : "Smoke test do Faster-Whisper falhou sem detalhe.",
    };
  }
}

async function runFasterWhisperDiarizationSmokeTest() {
  try {
    const payload = await fasterWhisperFetch("/diarize-smoke-test", {
      method: "POST",
    });
    const ok = extractBoolean(payload.ok);
    const segmentsCount = extractNumber(payload.segmentsCount);
    const latencyMs = extractNumber(payload.latencyMs);

    return {
      ok: ok && segmentsCount > 0,
      detail: ok
        ? `Smoke de diarizacao executado${latencyMs ? ` em ${latencyMs}ms` : ""}.`
        : extractText(payload.error) || "Smoke de diarizacao nao retornou segmentos validos.",
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Smoke de diarizacao falhou sem detalhe.",
    };
  }
}

export async function getFasterWhisperConnectionStatus(): Promise<FasterWhisperConnectionStatus> {
  const { baseUrl, model } = resolveFasterWhisperSettings();
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  try {
    const healthPayload = await fasterWhisperFetch("/health");
    const modelsPayload = await fasterWhisperFetch("/models");
    const availableModels = parseAvailableModels(modelsPayload);
    const activeModelAvailable = availableModels.includes(model);
    const runtimeBackend = extractBackend(healthPayload.backend);
    const runtimeCommandConfigured = extractBoolean(healthPayload.commandConfigured);
    const diarization = objectValue(healthPayload.diarization);
    const diarizationBackend = extractBackend(diarization.backend);
    const diarizationCommandConfigured = extractBoolean(diarization.commandConfigured);
    const serviceName = extractText(healthPayload.service) || "Faster-Whisper worker";
    const canRunSmokeTest =
      runtimeBackend === "command" && runtimeCommandConfigured && activeModelAvailable;
    const smokeTest = canRunSmokeTest
      ? await runFasterWhisperSmokeTest()
      : {
          ok: false,
          detail:
            "Smoke test nao executado porque backend, comando ou modelo ainda nao estao prontos.",
        };
    const smokeTranscriptionReady = smokeTest.ok;
    const canRunDiarizationSmokeTest =
      diarizationBackend === "command" && diarizationCommandConfigured && activeModelAvailable;
    const diarizationSmokeTest = canRunDiarizationSmokeTest
      ? await runFasterWhisperDiarizationSmokeTest()
      : {
          ok: false,
          detail:
            "Smoke de diarizacao nao executado porque comando ou modelo ainda nao estao prontos.",
        };
    const smokeDiarizationReady = diarizationSmokeTest.ok;

    const status =
      runtimeBackend === "mock"
        ? "mock_mode"
        : runtimeBackend === "command" && !runtimeCommandConfigured
          ? "misconfigured"
          : activeModelAvailable && smokeTranscriptionReady
            ? "ready"
            : activeModelAvailable
              ? "misconfigured"
              : "model_missing";

    const checks = [
      check("endpoint", "Endpoint local", "pass", `Worker respondeu em ${baseUrl}.`),
      check(
        "backend",
        "Backend real",
        runtimeBackend === "command" ? "pass" : runtimeBackend === "mock" ? "warn" : "fail",
        runtimeBackend === "command"
          ? "Worker esta em modo command."
          : runtimeBackend === "mock"
            ? "Worker esta online, mas em modo mock."
            : "Worker nao informou um backend reconhecido.",
      ),
      check(
        "command",
        "Comando local",
        runtimeBackend !== "command" ? "warn" : runtimeCommandConfigured ? "pass" : "fail",
        runtimeBackend !== "command"
          ? "Comando nao se aplica enquanto o backend nao estiver em modo command."
          : runtimeCommandConfigured
            ? "FASTER_WHISPER_COMMAND esta configurado."
            : "Configure FASTER_WHISPER_COMMAND para transcricao real.",
      ),
      check(
        "model",
        "Modelo ativo",
        activeModelAvailable ? "pass" : "fail",
        activeModelAvailable
          ? `Modelo ${model} encontrado no worker.`
          : `Modelo ${model} nao apareceu na lista do worker.`,
      ),
      check(
        "smoke_transcription",
        "Smoke de transcricao",
        smokeTranscriptionReady ? "pass" : canRunSmokeTest ? "fail" : "warn",
        smokeTranscriptionReady
          ? `${smokeTest.detail} Pipeline command validado.`
          : smokeTest.detail,
      ),
      check(
        "diarization",
        "Diarizacao local",
        smokeDiarizationReady ? "pass" : canRunDiarizationSmokeTest ? "fail" : "warn",
        smokeDiarizationReady
          ? `${diarizationSmokeTest.detail} Separacao de falantes validada.`
          : canRunDiarizationSmokeTest
            ? diarizationSmokeTest.detail
            : "Worker usa diarizacao simulada/fallback ate configurar FASTER_WHISPER_DIARIZATION_COMMAND.",
      ),
    ];

    const message =
      status === "mock_mode"
        ? `Faster-Whisper respondeu, mas o worker ainda esta em modo mock. Use backend=command para transcricao local real.`
        : status === "misconfigured"
          ? canRunSmokeTest
            ? `Faster-Whisper respondeu, mas o smoke test de transcricao falhou: ${smokeTest.detail}`
            : `O worker respondeu em modo command, mas ainda falta configurar FASTER_WHISPER_COMMAND.`
          : activeModelAvailable && smokeTranscriptionReady
            ? `Faster-Whisper respondeu, o modelo ${model} esta disponivel e o smoke test passou.`
            : `Faster-Whisper respondeu, mas o modelo ${model} nao apareceu na lista do worker local.`;

    return {
      provider: "faster-whisper",
      baseUrl,
      model,
      checkedAt,
      status,
      reachable: true,
      activeModelAvailable,
      availableModels,
      runtimeBackend,
      runtimeCommandConfigured,
      diarizationBackend,
      diarizationCommandConfigured,
      smokeTranscriptionReady,
      smokeDiarizationReady,
      latencyMs: Date.now() - startedAt,
      checks,
      serviceName,
      message,
    };
  } catch (error) {
    return {
      provider: "faster-whisper",
      baseUrl,
      model,
      checkedAt,
      status: "unreachable",
      reachable: false,
      activeModelAvailable: false,
      availableModels: [],
      runtimeBackend: "unknown",
      runtimeCommandConfigured: false,
      diarizationBackend: "unknown",
      diarizationCommandConfigured: false,
      smokeTranscriptionReady: false,
      smokeDiarizationReady: false,
      latencyMs: Date.now() - startedAt,
      checks: [
        check(
          "endpoint",
          "Endpoint local",
          "fail",
          error instanceof Error
            ? error.message
            : "Nao foi possivel conectar ao endpoint configurado do Faster-Whisper.",
        ),
        check("backend", "Backend real", "fail", "Backend nao verificado."),
        check("command", "Comando local", "fail", "Comando nao verificado."),
        check("model", "Modelo ativo", "fail", "Modelo nao verificado."),
        check(
          "smoke_transcription",
          "Transcricao real",
          "fail",
          "Teste de transcricao nao executado porque o endpoint falhou.",
        ),
        check(
          "diarization",
          "Diarizacao local",
          "fail",
          "Teste de diarizacao nao executado porque o endpoint falhou.",
        ),
      ],
      serviceName: "Faster-Whisper worker",
      message:
        error instanceof Error
          ? error.message
          : "Nao foi possivel conectar ao endpoint configurado do Faster-Whisper.",
    };
  }
}

export async function transcribeRecordingWithFasterWhisper(
  session: VoiceSession,
  recording?: VoiceRecording,
): Promise<VoiceTranscript | undefined> {
  if (!recording) return undefined;

  const runtimeStatus = await getFasterWhisperConnectionStatus();
  if (runtimeStatus.status !== "ready") {
    throw new Error(
      runtimeStatus.status === "mock_mode"
        ? "Faster-Whisper is connected, but the worker is still in simulated mode. Use the explicit mock provider for tests or configure backend=command for real local transcription."
        : runtimeStatus.message,
    );
  }

  const stored = await readStoredRecording(recording);
  if (!stored) return undefined;

  const { model } = resolveFasterWhisperSettings();
  const form = new FormData();
  const audio = new Blob([stored.bytes as BlobPart], { type: stored.mimeType });
  form.append("file", audio, stored.fileName);
  form.append("model", model);
  form.append("language", session.language);
  form.append("context", sessionContextText(session));

  const result = await fasterWhisperFetch("/transcribe", {
    method: "POST",
    body: form,
  });

  const text = normalizeTechnicalTerms(
    extractText(result.text) || extractText(result.transcript) || extractText(result.content),
  );
  if (!text) return undefined;

  return {
    id: `trn_${crypto.randomUUID()}`,
    sessionId: session.id,
    language: extractText(result.language) || session.language,
    status: "COMPLETED",
    text,
    segments: providerSegments(session, result, text),
    format: "TEXT",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: `faster-whisper:${model}`,
  };
}
