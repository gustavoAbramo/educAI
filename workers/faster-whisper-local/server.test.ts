import * as assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import { createFasterWhisperWorkerServer } from "./server";

const runtimes: Array<ReturnType<typeof createFasterWhisperWorkerServer>> = [];
const tempPaths: string[] = [];

afterEach(async () => {
  while (runtimes.length > 0) {
    const runtime = runtimes.pop();
    if (!runtime) continue;
    await runtime.close();
  }

  while (tempPaths.length > 0) {
    const target = tempPaths.pop();
    if (!target) continue;
    await rm(target, { recursive: true, force: true });
  }
});

async function startWorker(config?: Parameters<typeof createFasterWhisperWorkerServer>[0]) {
  const runtime = createFasterWhisperWorkerServer({
    host: "127.0.0.1",
    port: 0,
    backend: "mock",
    defaultModel: "small",
    availableModels: ["small", "medium"],
    ...config,
  });
  runtimes.push(runtime);
  await runtime.listen();
  return runtime;
}

function getBaseUrl(runtime: ReturnType<typeof createFasterWhisperWorkerServer>) {
  const address = runtime.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Worker server address is unavailable.");
  }

  return `http://${runtime.config.host}:${(address as AddressInfo).port}`;
}

async function waitForActiveJob(baseUrl: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    if (health.activeJobs === 1) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Worker did not report an active job.");
}

describe("faster-whisper worker", () => {
  it("serves health and models endpoints", async () => {
    const runtime = await startWorker();
    const baseUrl = getBaseUrl(runtime);

    const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
    const models = await fetch(`${baseUrl}/models`).then((response) => response.json());

    assert.equal(health.status, "ok");
    assert.equal(health.backend, "mock");
    assert.equal(health.limits.maxConcurrentJobs, 1);
    assert.equal(Array.isArray(models.models), true);
    assert.equal(models.models[0]?.id, "small");
  });

  it("returns a mock transcription payload", async () => {
    const runtime = await startWorker({
      defaultModel: "medium",
      availableModels: ["small", "medium", "large-v3"],
    });
    const baseUrl = getBaseUrl(runtime);
    const form = new FormData();
    form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));
    form.append("model", "medium");
    form.append("language", "pt-BR");
    form.append("context", "Aula sobre providers locais e transcricao offline.");

    const result = await fetch(`${baseUrl}/transcribe`, {
      method: "POST",
      body: form,
    }).then((response) => response.json());

    assert.match(String(result.text), /providers locais/i);
    assert.equal(Array.isArray(result.segments), true);
    assert.equal(result.model, "medium");
    assert.equal(result.provider, "faster-whisper-worker:mock");
  });

  it("returns diarization labels for transcript segments", async () => {
    const runtime = await startWorker();
    const baseUrl = getBaseUrl(runtime);
    const form = new FormData();
    form.append("file", new File(["audio-bytes"], "meeting.webm", { type: "audio/webm" }));
    form.append(
      "segments",
      JSON.stringify([
        { startMs: 0, endMs: 1000, text: "Oi" },
        { startMs: 1000, endMs: 2200, text: "Tudo bem" },
      ]),
    );

    const result = await fetch(`${baseUrl}/diarize`, {
      method: "POST",
      body: form,
    }).then((response) => response.json());

    assert.equal(result.provider, "faster-whisper-diarization:mock");
    assert.deepEqual(
      result.segments.map((segment: { speaker: string }) => segment.speaker),
      ["speaker_1", "speaker_2"],
    );
  });

  it("runs a command smoke test only when command backend is enabled", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "educai-worker-smoke-test-"));
    tempPaths.push(tempDir);
    const scriptPath = path.join(tempDir, "smoke-command.mjs");
    await writeFile(
      scriptPath,
      [
        "import { readFile } from 'node:fs/promises';",
        "const request = JSON.parse(await readFile(process.argv[2], 'utf8'));",
        "process.stdout.write(JSON.stringify({",
        "  text: `smoke ok ${request.model} ${request.language}`,",
        "  language: request.language,",
        "  segments: [{ speaker: 'Speaker 1', start_ms: 0, end_ms: 200, text: 'smoke ok' }]",
        "}));",
      ].join("\n"),
      "utf8",
    );

    const mockRuntime = await startWorker();
    const mockResponse = await fetch(`${getBaseUrl(mockRuntime)}/smoke-test`, {
      method: "POST",
    });
    assert.equal(mockResponse.status, 409);

    const commandRuntime = await startWorker({
      backend: "command",
      command: `"${process.execPath}" "${scriptPath}"`,
      commandTimeoutMs: 1_000,
    });
    const commandResponse = await fetch(`${getBaseUrl(commandRuntime)}/smoke-test`, {
      method: "POST",
    });
    const payload = await commandResponse.json();

    assert.equal(commandResponse.status, 200);
    assert.equal(payload.ok, true);
    assert.match(String(payload.textPreview), /smoke ok small pt-BR/i);
    assert.equal(payload.segmentsCount, 1);
    assert.equal(typeof payload.latencyMs, "number");
  });

  it("runs a diarization command smoke test only when diarization command is configured", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "educai-diarization-smoke-test-"));
    tempPaths.push(tempDir);
    const scriptPath = path.join(tempDir, "diarization-command.mjs");
    await writeFile(
      scriptPath,
      [
        "import { readFile } from 'node:fs/promises';",
        "const request = JSON.parse(await readFile(process.argv[2], 'utf8'));",
        "const segments = request.transcript_segments.map((segment, index) => ({",
        "  label: `speaker_${index + 1}`,",
        "  start: segment.startMs / 1000,",
        "  end: segment.endMs / 1000,",
        "  confidence: 0.93",
        "}));",
        "process.stdout.write(JSON.stringify({ segments }));",
      ].join("\n"),
      "utf8",
    );

    const mockRuntime = await startWorker();
    const mockResponse = await fetch(`${getBaseUrl(mockRuntime)}/diarize-smoke-test`, {
      method: "POST",
    });
    assert.equal(mockResponse.status, 409);

    const commandRuntime = await startWorker({
      diarizationCommand: `"${process.execPath}" "${scriptPath}"`,
      commandTimeoutMs: 1_000,
    });
    const commandResponse = await fetch(`${getBaseUrl(commandRuntime)}/diarize-smoke-test`, {
      method: "POST",
    });
    const payload = await commandResponse.json();

    assert.equal(commandResponse.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.segmentsCount, 2);
    assert.deepEqual(payload.speakers, ["speaker_1", "speaker_2"]);
    assert.equal(typeof payload.latencyMs, "number");
  });

  it("rejects uploads above the configured limit", async () => {
    const runtime = await startWorker({ maxUploadBytes: 5 });
    const form = new FormData();
    form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

    const response = await fetch(`${getBaseUrl(runtime)}/transcribe`, {
      method: "POST",
      body: form,
    });
    const result = await response.json();

    assert.equal(response.status, 413);
    assert.match(String(result.error), /configured limit/i);
  });

  it("limits concurrent command jobs and times out stalled commands", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "educai-worker-test-"));
    tempPaths.push(tempDir);
    const scriptPath = path.join(tempDir, "slow-command.mjs");
    await writeFile(
      scriptPath,
      [
        "await new Promise((resolve) => setTimeout(resolve, 120));",
        'process.stdout.write(JSON.stringify({ text: "finished", segments: [] }));',
      ].join("\n"),
      "utf8",
    );

    const runtime = await startWorker({
      backend: "command",
      command: `"${process.execPath}" "${scriptPath}"`,
      commandTimeoutMs: 50,
      maxConcurrentJobs: 1,
    });
    const baseUrl = getBaseUrl(runtime);
    const request = () => {
      const form = new FormData();
      form.append("file", new File(["audio"], "sample.webm", { type: "audio/webm" }));
      return fetch(`${baseUrl}/transcribe`, { method: "POST", body: form });
    };

    const first = request();
    await waitForActiveJob(baseUrl);
    const second = await request();
    const firstResponse = await first;
    const firstPayload = await firstResponse.json();

    assert.equal(second.status, 429);
    assert.equal(firstResponse.status, 504);
    assert.match(String(firstPayload.error), /timed out/i);
  });
});
