import * as assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import type { VoiceRecording } from "@/lib/voice-intelligence";
import { readStoredRecording } from "./local-recordings";

const tempPaths: string[] = [];
const originalRecordingsDir = process.env.EDUCAI_RECORDINGS_DIR;

afterEach(async () => {
  if (originalRecordingsDir === undefined) {
    delete process.env.EDUCAI_RECORDINGS_DIR;
  } else {
    process.env.EDUCAI_RECORDINGS_DIR = originalRecordingsDir;
  }

  while (tempPaths.length > 0) {
    const target = tempPaths.pop();
    if (!target) continue;
    await rm(target, { recursive: true, force: true });
  }
});

function recordingWithPath(filePath: string): VoiceRecording {
  return {
    id: "rec_test",
    sessionId: "ses_test",
    fileName: "sample.webm",
    mimeType: "audio/webm",
    sizeBytes: 5,
    source: "UPLOAD",
    status: "UPLOADED",
    storage: {
      provider: "local",
      key: "ses_test/sample.webm",
      path: filePath,
      savedAt: new Date().toISOString(),
    },
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

describe("local recording storage boundaries", () => {
  it("reads a recording stored inside the configured directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "educai-recordings-"));
    tempPaths.push(root);
    const target = path.join(root, "ses_test", "sample.webm");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "audio", "utf8");
    process.env.EDUCAI_RECORDINGS_DIR = root;

    const stored = await readStoredRecording(recordingWithPath(target));

    assert.equal(new TextDecoder().decode(stored?.bytes), "audio");
  });

  it("rejects a persisted recording path outside the configured directory", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "educai-recordings-"));
    const outside = await mkdtemp(path.join(tmpdir(), "educai-outside-"));
    tempPaths.push(root, outside);
    const target = path.join(outside, "secret.txt");
    await writeFile(target, "secret", "utf8");
    process.env.EDUCAI_RECORDINGS_DIR = root;

    await assert.rejects(
      () => readStoredRecording(recordingWithPath(target)),
      /outside the configured recordings directory/i,
    );
  });
});
