import { readFile } from "node:fs/promises";

type BridgeBackend = "mock" | "http";

type BridgeRequest = {
  file_path: string;
  model?: string;
  language?: string;
  context?: string;
};

type BridgeSegment = {
  speaker?: string;
  start_ms?: number;
  end_ms?: number;
  text?: string;
};

type BridgeResponse = {
  text: string;
  language?: string;
  segments?: BridgeSegment[];
};

function env(name: string) {
  return process.env[name]?.trim();
}

function readBackend(): BridgeBackend {
  return env("FASTER_WHISPER_BRIDGE_BACKEND") === "http" ? "http" : "mock";
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

async function readBridgeRequest(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  const payload = parseJson<BridgeRequest>(raw, "Bridge request");

  if (!payload.file_path?.trim()) {
    throw new Error("Bridge request must include file_path.");
  }

  return {
    filePath: payload.file_path.trim(),
    model: payload.model?.trim() || "small",
    language: payload.language?.trim() || "pt-BR",
    context: payload.context?.trim() || "",
  };
}

function normalizeResponse(
  payload: Record<string, unknown>,
  fallbackLanguage: string,
): BridgeResponse {
  const text =
    typeof payload.text === "string"
      ? payload.text.trim()
      : typeof payload.transcript === "string"
        ? payload.transcript.trim()
        : typeof payload.content === "string"
          ? payload.content.trim()
          : "";

  if (!text) {
    throw new Error("Bridge target returned no transcript text.");
  }

  const language =
    typeof payload.language === "string" && payload.language.trim()
      ? payload.language.trim()
      : fallbackLanguage;

  const rawSegments = Array.isArray(payload.segments) ? payload.segments : [];
  const segments = rawSegments
    .map((item) => {
      if (!item || typeof item !== "object") return undefined;
      const segment = item as Record<string, unknown>;
      const segmentText = typeof segment.text === "string" ? segment.text.trim() : "";
      if (!segmentText) return undefined;

      return {
        speaker:
          typeof segment.speaker === "string" ? segment.speaker.trim() || "Speaker 1" : "Speaker 1",
        start_ms: typeof segment.start_ms === "number" ? segment.start_ms : 0,
        end_ms: typeof segment.end_ms === "number" ? segment.end_ms : 0,
        text: segmentText,
      } satisfies BridgeSegment;
    })
    .filter((item): item is BridgeSegment => Boolean(item));

  return {
    text,
    language,
    segments,
  };
}

function buildMockResponse(request: Awaited<ReturnType<typeof readBridgeRequest>>): BridgeResponse {
  const context = request.context.replace(/\s+/g, " ").trim();
  const intro = context
    ? `Bridge local processou o audio com o contexto: ${context.slice(0, 160)}.`
    : `Bridge local processou o audio com o modelo ${request.model}.`;

  return {
    text: `${intro}\n\nEsta resposta confirma o contrato do bridge para um backend HTTP ou executavel real.`,
    language: request.language,
    segments: [
      {
        speaker: "Speaker 1",
        start_ms: 0,
        end_ms: 2200,
        text: intro,
      },
      {
        speaker: "Speaker 2",
        start_ms: 2200,
        end_ms: 4700,
        text: "Esta resposta confirma o contrato do bridge para um backend HTTP ou executavel real.",
      },
    ],
  };
}

async function runHttpBridge(
  request: Awaited<ReturnType<typeof readBridgeRequest>>,
): Promise<BridgeResponse> {
  const targetUrl = env("FASTER_WHISPER_BRIDGE_TRANSCRIBE_URL");
  if (!targetUrl) {
    throw new Error(
      "FASTER_WHISPER_BRIDGE_TRANSCRIBE_URL is required when FASTER_WHISPER_BRIDGE_BACKEND=http.",
    );
  }

  const bytes = await readFile(request.filePath);
  const fileName = request.filePath.split(/[/\\]/).pop() || "audio.bin";
  const mimeType = env("FASTER_WHISPER_BRIDGE_MIME_TYPE") || "application/octet-stream";

  const form = new FormData();
  form.append("file", new File([bytes], fileName, { type: mimeType }));
  form.append("model", request.model);
  form.append("language", request.language);
  if (request.context) {
    form.append("context", request.context);
  }

  const response = await fetch(targetUrl, {
    method: "POST",
    body: form,
    headers: env("FASTER_WHISPER_BRIDGE_AUTH_HEADER")
      ? {
          Authorization: env("FASTER_WHISPER_BRIDGE_AUTH_HEADER") as string,
        }
      : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bridge target request failed (${response.status}): ${text.slice(0, 500)}`);
  }

  return normalizeResponse(
    parseJson<Record<string, unknown>>(await response.text(), "Bridge target response"),
    request.language,
  );
}

export async function executeBridge(requestFilePath: string): Promise<BridgeResponse> {
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
    throw new Error("Usage: node --import tsx command-bridge.ts <request.json>");
  }

  const result = await executeBridge(requestFilePath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === new URL(process.argv[1] || "", "file://").href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
