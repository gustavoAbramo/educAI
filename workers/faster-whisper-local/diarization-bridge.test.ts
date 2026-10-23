import * as assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, it } from "node:test";
import { executeDiarizationBridge } from "./diarization-bridge";

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
  const tempDir = await mkdtemp(path.join(tmpdir(), "educai-diarization-bridge-"));
  tempPaths.push(tempDir);

  const audioPath = path.join(tempDir, "meeting.webm");
  const requestPath = path.join(tempDir, "request.json");

  await writeFile(audioPath, "audio-bytes", "utf8");
  await writeFile(
    requestPath,
    JSON.stringify(
      {
        file_path: audioPath,
        model: "small",
        language: "pt-BR",
        transcript_segments: [
          { startMs: 0, endMs: 1100, text: "Bom dia" },
          { startMs: 1100, endMs: 2600, text: "Vamos comecar" },
        ],
        speaker_map: {
          speaker_1: "Professor",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return { requestPath };
}

async function startHttpTarget() {
  const captured: {
    fileName?: string;
    model?: string;
    language?: string;
    segments?: unknown;
    speakerMap?: unknown;
  } = {};

  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/diarize") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const request = new Request("http://127.0.0.1/diarize", {
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
    captured.segments = JSON.parse(String(form.get("segments") || "[]"));
    captured.speakerMap = JSON.parse(String(form.get("speakerMap") || "{}"));

    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        diarization: [
          {
            label: "speaker_2",
            start: 0,
            end: 2.6,
            confidence: 0.91,
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
    throw new Error("Unable to resolve diarization bridge HTTP target address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/diarize`,
    captured,
  };
}

describe("faster-whisper diarization bridge", () => {
  it("returns mock diarization labels by default", async () => {
    const fixture = await createRequestFixture();

    const result = await executeDiarizationBridge(fixture.requestPath);

    assert.deepEqual(
      result.segments.map((segment) => segment.speaker),
      ["speaker_1", "speaker_2"],
    );
    assert.deepEqual(
      result.segments.map((segment) => [segment.start_ms, segment.end_ms]),
      [
        [0, 1100],
        [1100, 2600],
      ],
    );
  });

  it("forwards diarization to a local HTTP target when configured", async () => {
    const fixture = await createRequestFixture();
    const target = await startHttpTarget();

    process.env.FASTER_WHISPER_DIARIZATION_BRIDGE_BACKEND = "http";
    process.env.FASTER_WHISPER_DIARIZATION_BRIDGE_URL = target.baseUrl;
    process.env.FASTER_WHISPER_DIARIZATION_BRIDGE_MIME_TYPE = "audio/webm";

    const result = await executeDiarizationBridge(fixture.requestPath);

    assert.equal(result.segments[0]?.speaker, "speaker_2");
    assert.equal(result.segments[0]?.end_ms, 2600);
    assert.equal(result.segments[0]?.confidence, 0.91);
    assert.equal(target.captured.fileName, "meeting.webm");
    assert.equal(target.captured.model, "small");
    assert.equal(target.captured.language, "pt-BR");
    assert.equal(Array.isArray(target.captured.segments), true);
    assert.deepEqual(target.captured.speakerMap, { speaker_1: "Professor" });
  });
});
