import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

type WorkerConfig = {
  host: string;
  port: number;
  backend: "mock" | "command";
  defaultModel: string;
  availableModels: string[];
  command?: string;
  diarizationCommand?: string;
  commandTimeoutMs: number;
  maxCommandOutputBytes: number;
  maxConcurrentJobs: number;
  maxUploadBytes: number;
};

type TranscriptionSegment = {
  speaker: string;
  start_ms: number;
  end_ms: number;
  text: string;
};

type DiarizationSegment = {
  speaker: string;
  start_ms: number;
  end_ms: number;
  confidence?: number;
};

type CommandResult = {
  text: string;
  language?: string;
  segments?: TranscriptionSegment[];
};

type DiarizationCommandResult = {
  segments?: unknown[];
};

type WorkerConfigInput = Partial<WorkerConfig>;

class WorkerRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "WorkerRequestError";
  }
}

function workerEnv(name: string) {
  return process.env[name]?.trim();
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseModelList(raw: string | undefined, fallback: string[]) {
  if (!raw) return fallback;
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : fallback;
}

function readWorkerConfig(): WorkerConfig {
  const defaultModel = workerEnv("FASTER_WHISPER_MODEL") || "small";
  return {
    host: workerEnv("FASTER_WHISPER_HOST") || "127.0.0.1",
    port: Number(workerEnv("FASTER_WHISPER_PORT") || "8765"),
    backend: workerEnv("FASTER_WHISPER_WORKER_BACKEND") === "command" ? "command" : "mock",
    defaultModel,
    availableModels: parseModelList(workerEnv("FASTER_WHISPER_AVAILABLE_MODELS"), [
      "tiny",
      "base",
      "small",
      "medium",
      "large-v3",
      defaultModel,
    ]),
    command: workerEnv("FASTER_WHISPER_COMMAND"),
    diarizationCommand: workerEnv("FASTER_WHISPER_DIARIZATION_COMMAND"),
    commandTimeoutMs: positiveInteger(workerEnv("FASTER_WHISPER_COMMAND_TIMEOUT_MS"), 10 * 60_000),
    maxCommandOutputBytes: positiveInteger(
      workerEnv("FASTER_WHISPER_MAX_COMMAND_OUTPUT_BYTES"),
      2 * 1024 * 1024,
    ),
    maxConcurrentJobs: positiveInteger(workerEnv("FASTER_WHISPER_MAX_CONCURRENT_JOBS"), 1),
    maxUploadBytes: positiveInteger(
      workerEnv("FASTER_WHISPER_MAX_UPLOAD_BYTES"),
      500 * 1024 * 1024,
    ),
  };
}

function now() {
  return new Date().toISOString();
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body, null, 2));
}

function textFromContext(context: string) {
  const cleaned = context.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 180) : "";
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

function normalizeDiarizationSegments(rawSegments: unknown[] | undefined): DiarizationSegment[] {
  return (rawSegments ?? [])
    .map((item, index) => {
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
      } satisfies DiarizationSegment;
    })
    .filter((item): item is DiarizationSegment => Boolean(item));
}

function buildMockTranscription(input: {
  fileName: string;
  language: string;
  model: string;
  context: string;
}) {
  const contextPreview = textFromContext(input.context);
  const fileHint = input.fileName || "audio enviado";
  const intro = contextPreview
    ? `O worker local processou ${fileHint} com o contexto: ${contextPreview}.`
    : `O worker local processou ${fileHint} usando o modelo ${input.model}.`;

  const segments: TranscriptionSegment[] = [
    {
      speaker: "Speaker 1",
      start_ms: 0,
      end_ms: 2400,
      text: intro,
    },
    {
      speaker: "Speaker 2",
      start_ms: 2400,
      end_ms: 5200,
      text: "Esta resposta simulada confirma o contrato do worker local para a futura execucao com Faster-Whisper real.",
    },
  ];

  return {
    text: segments.map((segment) => `${segment.speaker}: ${segment.text}`).join("\n\n"),
    language: input.language || "pt-BR",
    segments,
  };
}

function buildSmokeWav() {
  const sampleRate = 16_000;
  const durationSeconds = 0.2;
  const samples = Math.floor(sampleRate * durationSeconds);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

async function requestFromNode(req: IncomingMessage) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  return new Request(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method && !["GET", "HEAD"].includes(req.method.toUpperCase())
        ? (Readable.toWeb(req) as BodyInit)
        : undefined,
    duplex: "half",
  } as RequestInit);
}

async function parseMultipartTranscriptionRequest(req: IncomingMessage, config: WorkerConfig) {
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > config.maxUploadBytes) {
    throw new WorkerRequestError(
      `Upload exceeds the configured limit of ${config.maxUploadBytes} bytes.`,
      413,
    );
  }

  const request = await requestFromNode(req);
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    throw new WorkerRequestError("file is required.", 400);
  }
  if (file.size > config.maxUploadBytes) {
    throw new WorkerRequestError(
      `Upload exceeds the configured limit of ${config.maxUploadBytes} bytes.`,
      413,
    );
  }

  return {
    file,
    model: String(form.get("model") || "")
      .trim()
      .slice(0, 120),
    language: String(form.get("language") || "")
      .trim()
      .slice(0, 40),
    context: String(form.get("context") || "")
      .trim()
      .slice(0, 20_000),
  };
}

async function parseMultipartDiarizationRequest(req: IncomingMessage, config: WorkerConfig) {
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > config.maxUploadBytes) {
    throw new WorkerRequestError(
      `Upload exceeds the configured limit of ${config.maxUploadBytes} bytes.`,
      413,
    );
  }

  const request = await requestFromNode(req);
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    throw new WorkerRequestError("file is required.", 400);
  }
  if (file.size > config.maxUploadBytes) {
    throw new WorkerRequestError(
      `Upload exceeds the configured limit of ${config.maxUploadBytes} bytes.`,
      413,
    );
  }

  const segmentsJson = String(form.get("segments") || "[]");
  const rawSegments = JSON.parse(segmentsJson) as unknown;
  const segments = Array.isArray(rawSegments) ? rawSegments : [];

  return {
    file,
    model: String(form.get("model") || "")
      .trim()
      .slice(0, 120),
    language: String(form.get("language") || "")
      .trim()
      .slice(0, 40),
    segments,
    speakerMap: String(form.get("speakerMap") || "{}")
      .trim()
      .slice(0, 20_000),
  };
}

function parseCommandLine(commandLine: string) {
  const parts = commandLine.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  return parts.map((part) => part.replace(/^"(.*)"$/, "$1")).filter(Boolean);
}

function spawnCommand(
  command: string,
  args: string[],
  options: { timeoutMs: number; maxOutputBytes: number },
) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const enforceOutputLimit = () => {
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) <= options.maxOutputBytes) return;
      child.kill();
      finish(() =>
        reject(
          new WorkerRequestError(
            `Transcription command exceeded ${options.maxOutputBytes} bytes of output.`,
            502,
          ),
        ),
      );
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(() =>
        reject(
          new WorkerRequestError(
            `Transcription command timed out after ${options.timeoutMs}ms.`,
            504,
          ),
        ),
      );
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      enforceOutputLimit();
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      enforceOutputLimit();
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => finish(() => resolve({ stdout, stderr, code })));
  });
}

async function transcribeViaCommand(
  config: WorkerConfig,
  payload: Awaited<ReturnType<typeof parseMultipartTranscriptionRequest>>,
) {
  if (!config.command) {
    throw new Error(
      "FASTER_WHISPER_COMMAND is required when FASTER_WHISPER_WORKER_BACKEND=command.",
    );
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "educai-faster-whisper-"));
  const inputPath = path.join(tempDir, path.basename(payload.file.name || "audio.bin"));
  const requestPath = path.join(tempDir, "request.json");

  try {
    const bytes = new Uint8Array(await payload.file.arrayBuffer());
    await writeFile(inputPath, bytes);
    await writeFile(
      requestPath,
      JSON.stringify(
        {
          file_path: inputPath,
          model: payload.model || config.defaultModel,
          language: payload.language,
          context: payload.context,
        },
        null,
        2,
      ),
      "utf8",
    );

    const [command, ...args] = parseCommandLine(config.command);
    if (!command) {
      throw new WorkerRequestError("FASTER_WHISPER_COMMAND did not contain an executable.", 500);
    }
    const result = await spawnCommand(command, [...args, requestPath], {
      timeoutMs: config.commandTimeoutMs,
      maxOutputBytes: config.maxCommandOutputBytes,
    });

    if (result.code !== 0) {
      const detail = (result.stderr || result.stdout).trim().slice(0, 2_000);
      throw new WorkerRequestError(
        `Transcription command failed (${result.code})${detail ? `: ${detail}` : "."}`,
        502,
      );
    }

    const parsed = JSON.parse(result.stdout) as CommandResult;
    if (!parsed.text?.trim()) {
      throw new WorkerRequestError("Transcription command returned no text.", 502);
    }

    return {
      text: parsed.text.trim(),
      language: parsed.language?.trim() || payload.language || "pt-BR",
      segments: parsed.segments ?? [],
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function mockDiarization(
  payload: Awaited<ReturnType<typeof parseMultipartDiarizationRequest>>,
): DiarizationCommandResult {
  const sourceSegments = payload.segments
    .map((item, index) => {
      if (!item || typeof item !== "object") return undefined;
      const segment = item as Record<string, unknown>;
      const startMs = typeof segment.startMs === "number" ? segment.startMs : index * 2500;
      const endMs =
        typeof segment.endMs === "number" && segment.endMs > startMs
          ? segment.endMs
          : startMs + 2400;
      return {
        speaker: `speaker_${(index % 2) + 1}`,
        start_ms: startMs,
        end_ms: endMs,
        confidence: 0.62,
      };
    })
    .filter((item): item is DiarizationSegment => Boolean(item));

  return {
    segments: sourceSegments.length
      ? sourceSegments
      : [
          { speaker: "speaker_1", start_ms: 0, end_ms: 2500, confidence: 0.55 },
          { speaker: "speaker_2", start_ms: 2500, end_ms: 5000, confidence: 0.55 },
        ],
  };
}

async function diarizeViaCommand(
  config: WorkerConfig,
  payload: Awaited<ReturnType<typeof parseMultipartDiarizationRequest>>,
) {
  if (!config.diarizationCommand) {
    throw new Error("FASTER_WHISPER_DIARIZATION_COMMAND is required for real diarization.");
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "educai-diarization-"));
  const inputPath = path.join(tempDir, path.basename(payload.file.name || "audio.bin"));
  const requestPath = path.join(tempDir, "request.json");

  try {
    const bytes = new Uint8Array(await payload.file.arrayBuffer());
    await writeFile(inputPath, bytes);
    await writeFile(
      requestPath,
      JSON.stringify(
        {
          file_path: inputPath,
          model: payload.model || config.defaultModel,
          language: payload.language,
          transcript_segments: payload.segments,
          speaker_map: payload.speakerMap ? JSON.parse(payload.speakerMap) : {},
        },
        null,
        2,
      ),
      "utf8",
    );

    const [command, ...args] = parseCommandLine(config.diarizationCommand);
    if (!command) {
      throw new WorkerRequestError(
        "FASTER_WHISPER_DIARIZATION_COMMAND did not contain an executable.",
        500,
      );
    }
    const result = await spawnCommand(command, [...args, requestPath], {
      timeoutMs: config.commandTimeoutMs,
      maxOutputBytes: config.maxCommandOutputBytes,
    });

    if (result.code !== 0) {
      const detail = (result.stderr || result.stdout).trim().slice(0, 2_000);
      throw new WorkerRequestError(
        `Diarization command failed (${result.code})${detail ? `: ${detail}` : "."}`,
        502,
      );
    }

    const parsed = JSON.parse(result.stdout) as DiarizationCommandResult;
    const segments = normalizeDiarizationSegments(parsed.segments);
    if (segments.length === 0) {
      throw new WorkerRequestError("Diarization command returned no segments.", 502);
    }

    return { segments };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function handleHealth(
  _req: IncomingMessage,
  res: ServerResponse,
  config: WorkerConfig,
  state: { activeJobs: number },
) {
  json(res, 200, {
    status: "ok",
    service: "educAI Faster-Whisper Worker",
    backend: config.backend,
    commandConfigured: config.backend === "command" ? Boolean(config.command?.trim()) : false,
    diarization: {
      backend: config.diarizationCommand?.trim() ? "command" : "mock",
      commandConfigured: Boolean(config.diarizationCommand?.trim()),
    },
    configuredModel: config.defaultModel,
    limits: {
      commandTimeoutMs: config.commandTimeoutMs,
      maxCommandOutputBytes: config.maxCommandOutputBytes,
      maxConcurrentJobs: config.maxConcurrentJobs,
      maxUploadBytes: config.maxUploadBytes,
    },
    activeJobs: state.activeJobs,
    checkedAt: now(),
  });
}

async function handleModels(_req: IncomingMessage, res: ServerResponse, config: WorkerConfig) {
  json(res, 200, {
    models: config.availableModels.map((model) => ({ id: model })),
  });
}

async function handleTranscribe(
  req: IncomingMessage,
  res: ServerResponse,
  config: WorkerConfig,
  state: { activeJobs: number },
) {
  if (state.activeJobs >= config.maxConcurrentJobs) {
    json(res, 429, {
      error: `Worker is busy. Maximum concurrent jobs: ${config.maxConcurrentJobs}.`,
    });
    return;
  }

  state.activeJobs += 1;
  try {
    const payload = await parseMultipartTranscriptionRequest(req, config);
    const model = payload.model || config.defaultModel;
    const language = payload.language || "pt-BR";

    const result =
      config.backend === "command"
        ? await transcribeViaCommand(config, payload)
        : buildMockTranscription({
            fileName: payload.file.name,
            language,
            model,
            context: payload.context,
          });

    json(res, 200, {
      text: result.text,
      language: result.language,
      segments: result.segments,
      provider: `faster-whisper-worker:${config.backend}`,
      model,
      generatedAt: now(),
    });
  } catch (error) {
    json(res, error instanceof WorkerRequestError ? error.status : 500, {
      error: error instanceof Error ? error.message : "Unexpected transcription error.",
    });
  } finally {
    state.activeJobs -= 1;
  }
}

async function handleDiarize(
  req: IncomingMessage,
  res: ServerResponse,
  config: WorkerConfig,
  state: { activeJobs: number },
) {
  if (state.activeJobs >= config.maxConcurrentJobs) {
    json(res, 429, {
      error: `Worker is busy. Maximum concurrent jobs: ${config.maxConcurrentJobs}.`,
    });
    return;
  }

  state.activeJobs += 1;
  try {
    const payload = await parseMultipartDiarizationRequest(req, config);
    const model = payload.model || config.defaultModel;
    const result = config.diarizationCommand
      ? await diarizeViaCommand(config, payload)
      : mockDiarization(payload);

    json(res, 200, {
      segments: result.segments ?? [],
      provider: `faster-whisper-diarization:${config.diarizationCommand ? "command" : "mock"}`,
      model,
      generatedAt: now(),
    });
  } catch (error) {
    json(res, error instanceof WorkerRequestError ? error.status : 500, {
      error: error instanceof Error ? error.message : "Unexpected diarization error.",
    });
  } finally {
    state.activeJobs -= 1;
  }
}

async function handleSmokeTest(
  _req: IncomingMessage,
  res: ServerResponse,
  config: WorkerConfig,
  state: { activeJobs: number },
) {
  if (config.backend !== "command") {
    json(res, 409, {
      ok: false,
      error: "Smoke test requires FASTER_WHISPER_WORKER_BACKEND=command.",
    });
    return;
  }

  if (!config.command?.trim()) {
    json(res, 409, {
      ok: false,
      error: "Smoke test requires FASTER_WHISPER_COMMAND.",
    });
    return;
  }

  if (state.activeJobs >= config.maxConcurrentJobs) {
    json(res, 429, {
      ok: false,
      error: `Worker is busy. Maximum concurrent jobs: ${config.maxConcurrentJobs}.`,
    });
    return;
  }

  state.activeJobs += 1;
  const startedAt = Date.now();
  try {
    const result = await transcribeViaCommand(config, {
      file: new File([buildSmokeWav()], "educai-smoke.wav", { type: "audio/wav" }),
      model: config.defaultModel,
      language: "pt-BR",
      context: "Smoke test tecnico do pipeline local do educAI.",
    });

    json(res, 200, {
      ok: true,
      backend: config.backend,
      model: config.defaultModel,
      textPreview: result.text.slice(0, 240),
      segmentsCount: result.segments.length,
      latencyMs: Date.now() - startedAt,
      checkedAt: now(),
    });
  } catch (error) {
    json(res, error instanceof WorkerRequestError ? error.status : 502, {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected smoke test error.",
      latencyMs: Date.now() - startedAt,
      checkedAt: now(),
    });
  } finally {
    state.activeJobs -= 1;
  }
}

async function handleDiarizationSmokeTest(
  _req: IncomingMessage,
  res: ServerResponse,
  config: WorkerConfig,
  state: { activeJobs: number },
) {
  if (!config.diarizationCommand?.trim()) {
    json(res, 409, {
      ok: false,
      error: "Smoke test requires FASTER_WHISPER_DIARIZATION_COMMAND.",
    });
    return;
  }

  if (state.activeJobs >= config.maxConcurrentJobs) {
    json(res, 429, {
      ok: false,
      error: `Worker is busy. Maximum concurrent jobs: ${config.maxConcurrentJobs}.`,
    });
    return;
  }

  state.activeJobs += 1;
  const startedAt = Date.now();
  try {
    const result = await diarizeViaCommand(config, {
      file: new File([buildSmokeWav()], "educai-diarization-smoke.wav", {
        type: "audio/wav",
      }),
      model: config.defaultModel,
      language: "pt-BR",
      segments: [
        { startMs: 0, endMs: 1200, text: "Primeiro falante do smoke test." },
        { startMs: 1200, endMs: 2600, text: "Segundo falante do smoke test." },
      ],
      speakerMap: JSON.stringify({
        speaker_1: "Speaker 1",
        speaker_2: "Speaker 2",
      }),
    });
    const segments = result.segments ?? [];
    const speakers = [...new Set(segments.map((segment) => segment.speaker).filter(Boolean))];

    json(res, 200, {
      ok: segments.length > 0,
      backend: "command",
      model: config.defaultModel,
      segmentsCount: segments.length,
      speakers,
      latencyMs: Date.now() - startedAt,
      checkedAt: now(),
    });
  } catch (error) {
    json(res, error instanceof WorkerRequestError ? error.status : 502, {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected diarization smoke test error.",
      latencyMs: Date.now() - startedAt,
      checkedAt: now(),
    });
  } finally {
    state.activeJobs -= 1;
  }
}

async function routeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: WorkerConfig,
  state: { activeJobs: number },
) {
  const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;

  if (req.method === "GET" && pathname === "/health") {
    return handleHealth(req, res, config, state);
  }

  if (req.method === "GET" && pathname === "/models") {
    return handleModels(req, res, config);
  }

  if (req.method === "POST" && pathname === "/transcribe") {
    return handleTranscribe(req, res, config, state);
  }

  if (req.method === "POST" && pathname === "/diarize") {
    return handleDiarize(req, res, config, state);
  }

  if (req.method === "POST" && pathname === "/smoke-test") {
    return handleSmokeTest(req, res, config, state);
  }

  if (req.method === "POST" && pathname === "/diarize-smoke-test") {
    return handleDiarizationSmokeTest(req, res, config, state);
  }

  json(res, 404, {
    error: "Endpoint not found.",
  });
}

export function createFasterWhisperWorkerServer(configOverrides: WorkerConfigInput = {}) {
  const config = {
    ...readWorkerConfig(),
    ...configOverrides,
  } satisfies WorkerConfig;
  const state = { activeJobs: 0 };
  const server = createServer((req, res) => {
    void routeRequest(req, res, config, state).catch((error) => {
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined);
        return;
      }
      json(res, 500, {
        error: error instanceof Error ? error.message : "Unexpected worker error.",
      });
    });
  });
  server.requestTimeout = config.commandTimeoutMs + 30_000;
  server.headersTimeout = 30_000;

  return {
    config,
    server,
    listen() {
      return new Promise<Server>((resolve) => {
        server.listen(config.port, config.host, () => resolve(server));
      });
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

if (import.meta.url === new URL(process.argv[1] || "", "file://").href) {
  const runtime = createFasterWhisperWorkerServer();
  runtime
    .listen()
    .then(() => {
      console.log(
        `[educAI] Faster-Whisper worker listening on http://${runtime.config.host}:${runtime.config.port} backend=${runtime.config.backend} model=${runtime.config.defaultModel}`,
      );
    })
    .catch((error) => {
      console.error("[educAI] failed to start Faster-Whisper worker", error);
      process.exitCode = 1;
    });
}
