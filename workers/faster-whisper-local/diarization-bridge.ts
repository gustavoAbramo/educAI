import { readFile } from "node:fs/promises";

type DiarizationBridgeBackend = "mock" | "http";

type DiarizationBridgeRequest = {
  file_path: string;
  model?: string;
  language?: string;
  transcript_segments?: Array<Record<string, unknown>>;
  speaker_map?: Record<string, string>;
};

type DiarizationSegment = {
  speaker: string;
  start_ms: number;
  end_ms: number;
  confidence?: number;
};

type DiarizationBridgeResponse = {
  segments: DiarizationSegment[];
};

function env(name: string) {
  return process.env[name]?.trim();
}

function readBackend(): DiarizationBridgeBackend {
  return env("FASTER_WHISPER_DIARIZATION_BRIDGE_BACKEND") === "http" ? "http" : "mock";
}

function parseJson<T>(raw: string, label: string) {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function timeMsValue(
  msValue: unknown,
  camelMsValue: unknown,
  secondsValue: unknown,
  fallback: number,
) {
  if (typeof msValue === "number" && Number.isFinite(msValue)) return msValue;
  if (typeof camelMsValue === "number" && Number.isFinite(camelMsValue)) return camelMsValue;
  if (typeof secondsValue === "number" && Number.isFinite(secondsValue)) {
    return Math.round(secondsValue * 1000);
  }
  return fallback;
}

async function readBridgeRequest(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  const payload = parseJson<DiarizationBridgeRequest>(raw, "Diarization bridge request");

  if (!payload.file_path?.trim()) {
    throw new Error("Diarization bridge request must include file_path.");
  }

  return {
    filePath: payload.file_path.trim(),
    model: payload.model?.trim() || "small",
    language: payload.language?.trim() || "pt-BR",
    transcriptSegments: Array.isArray(payload.transcript_segments)
      ? payload.transcript_segments
      : [],
    speakerMap:
      payload.speaker_map && typeof payload.speaker_map === "object" ? payload.speaker_map : {},
  };
}

function normalizeSegment(item: unknown, index: number): DiarizationSegment | undefined {
  if (!item || typeof item !== "object") return undefined;
  const segment = item as Record<string, unknown>;
  const rawSpeaker =
    typeof segment.speaker === "string"
      ? segment.speaker.trim()
      : typeof segment.label === "string"
        ? segment.label.trim()
        : typeof segment.speaker_id === "string"
          ? segment.speaker_id.trim()
          : "";
  const startMs = timeMsValue(segment.start_ms, segment.startMs, segment.start, index * 2500);
  const endMs = timeMsValue(segment.end_ms, segment.endMs, segment.end, startMs + 2400);

  if (endMs <= startMs) return undefined;

  return {
    speaker: rawSpeaker || `speaker_${(index % 2) + 1}`,
    start_ms: startMs,
    end_ms: endMs,
    confidence: numberValue(segment.confidence, 0.7),
  };
}

function normalizeResponse(payload: Record<string, unknown>): DiarizationBridgeResponse {
  const rawSegments = Array.isArray(payload.segments)
    ? payload.segments
    : Array.isArray(payload.diarization)
      ? payload.diarization
      : Array.isArray(payload.speakers)
        ? payload.speakers
        : [];

  const segments = rawSegments
    .map((item, index) => normalizeSegment(item, index))
    .filter((item): item is DiarizationSegment => Boolean(item));

  if (segments.length === 0) {
    throw new Error("Diarization bridge target returned no segments.");
  }

  return { segments };
}

function buildMockResponse(
  request: Awaited<ReturnType<typeof readBridgeRequest>>,
): DiarizationBridgeResponse {
  const segments = request.transcriptSegments
    .map((item, index) => {
      const startMs = numberValue(item.startMs, numberValue(item.start_ms, index * 2500));
      const endMs = numberValue(item.endMs, numberValue(item.end_ms, startMs + 2400));
      if (endMs <= startMs) return undefined;

      return {
        speaker: `speaker_${(index % 2) + 1}`,
        start_ms: startMs,
        end_ms: endMs,
        confidence: 0.62,
      } satisfies DiarizationSegment;
    })
    .filter((item): item is DiarizationSegment => Boolean(item));

  return {
    segments: segments.length
      ? segments
      : [
          { speaker: "speaker_1", start_ms: 0, end_ms: 2500, confidence: 0.55 },
          { speaker: "speaker_2", start_ms: 2500, end_ms: 5000, confidence: 0.55 },
        ],
  };
}

async function runHttpBridge(
  request: Awaited<ReturnType<typeof readBridgeRequest>>,
): Promise<DiarizationBridgeResponse> {
  const targetUrl = env("FASTER_WHISPER_DIARIZATION_BRIDGE_URL");
  if (!targetUrl) {
    throw new Error(
      "FASTER_WHISPER_DIARIZATION_BRIDGE_URL is required when FASTER_WHISPER_DIARIZATION_BRIDGE_BACKEND=http.",
    );
  }

  const bytes = await readFile(request.filePath);
  const fileName = request.filePath.split(/[/\\]/).pop() || "audio.bin";
  const mimeType = env("FASTER_WHISPER_DIARIZATION_BRIDGE_MIME_TYPE") || "application/octet-stream";

  const form = new FormData();
  form.append("file", new File([bytes], fileName, { type: mimeType }));
  form.append("model", request.model);
  form.append("language", request.language);
  form.append("segments", JSON.stringify(request.transcriptSegments));
  form.append("speakerMap", JSON.stringify(request.speakerMap));

  const response = await fetch(targetUrl, {
    method: "POST",
    body: form,
    headers: env("FASTER_WHISPER_DIARIZATION_BRIDGE_AUTH_HEADER")
      ? {
          Authorization: env("FASTER_WHISPER_DIARIZATION_BRIDGE_AUTH_HEADER") as string,
        }
      : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Diarization bridge target request failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  return normalizeResponse(
    parseJson<Record<string, unknown>>(await response.text(), "Diarization bridge target response"),
  );
}

export async function executeDiarizationBridge(
  requestFilePath: string,
): Promise<DiarizationBridgeResponse> {
  const request = await readBridgeRequest(requestFilePath);
  const backend = readBackend();

  if (backend === "http") {
    return runHttpBridge(request);
  }

  return buildMockResponse(request);
}

async function main() {
  const requestFilePath = process.argv[2];
  if (!requestFilePath) {
    throw new Error("Usage: node --import tsx diarization-bridge.ts <request.json>");
  }

  const result = await executeDiarizationBridge(requestFilePath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === new URL(process.argv[1] || "", "file://").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
