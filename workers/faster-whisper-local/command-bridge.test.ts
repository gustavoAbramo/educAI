import * as assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, it } from "node:test";
import { executeBridge } from "./command-bridge";

const tempPaths: string[] = [];
const originalEnv = { ...process.env };
const servers: Server[] = [];

afterEach(async () => {
  process.env = { ...originalEnv };

  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) continue;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  while (tempPaths.length > 0) {
    const target = tempPaths.pop();
    if (!target) continue;
    await rm(target, { recursive: true, force: true });
  }
});

async function createRequestFixture() {
  const tempDir = await mkdtemp(path.join(tmpdir(), "educai-faster-whisper-bridge-"));
  tempPaths.push(tempDir);

  const audioPath = path.join(tempDir, "sample.webm");
  const requestPath = path.join(tempDir, "request.json");

  await writeFile(audioPath, "audio-bytes", "utf8");
  await writeFile(
    requestPath,
    JSON.stringify(
      {
        file_path: audioPath,
        model: "small",
        language: "pt-BR",
        context: "Aula sobre runtime local e transcricao offline.",
      },
      null,
      2,
    ),
    "utf8",
  );

  return { audioPath, requestPath };
}

async function startHttpTarget() {
  const captured: {
    fileName?: string;
    model?: string;
    language?: string;
    context?: string;
  } = {};

  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/transcribe") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const request = new Request("http://127.0.0.1/transcribe", {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: Readable.toWeb(req) as BodyInit,
      duplex: "half",
    } as RequestInit);
    const form = await request.formData();
    const file = form.get("file");

    if (file instanceof File) {
      captured.fileName = file.name;
    }
    captured.model = String(form.get("model") || "");
    captured.language = String(form.get("language") || "");
    captured.context = String(form.get("context") || "");

    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        text: "Professor: Bridge HTTP respondeu com transcricao real.",
        language: "pt-BR",
        segments: [
          {
            speaker: "Professor",
            start_ms: 0,
            end_ms: 1800,
            text: "Bridge HTTP respondeu com transcricao real.",
          },
        ],
      }),
    );
  });

  servers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve bridge HTTP target address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/transcribe`,
    captured,
  };
}

describe("faster-whisper command bridge", () => {
  it("returns a mock response by default", async () => {
    const fixture = await createRequestFixture();

    const result = await executeBridge(fixture.requestPath);

    assert.match(result.text, /contrato do bridge/i);
    assert.equal(result.language, "pt-BR");
    assert.equal(Array.isArray(result.segments), true);
  });

  it("forwards transcription to a local HTTP target when configured", async () => {
    const fixture = await createRequestFixture();
    const target = await startHttpTarget();

    process.env.FASTER_WHISPER_BRIDGE_BACKEND = "http";
    process.env.FASTER_WHISPER_BRIDGE_TRANSCRIBE_URL = target.baseUrl;
    process.env.FASTER_WHISPER_BRIDGE_MIME_TYPE = "audio/webm";

    const result = await executeBridge(fixture.requestPath);

    assert.match(result.text, /transcricao real/i);
    assert.equal(result.language, "pt-BR");
    assert.equal(target.captured.fileName, "sample.webm");
    assert.equal(target.captured.model, "small");
    assert.equal(target.captured.language, "pt-BR");
    assert.match(String(target.captured.context), /runtime local/i);
  });
});
