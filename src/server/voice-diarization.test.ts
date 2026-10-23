import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VoiceRecording, VoiceSession, VoiceTranscript } from "@/lib/voice-intelligence";
import { normalizeRemoteDiarization } from "./voice-store";

const session: VoiceSession = {
  id: "ses_test",
  type: "MEETING",
  title: "Reuniao de teste",
  language: "pt-BR",
  status: "AUDIO_UPLOADED",
  participants: [{ name: "Ana" }, { name: "Bruno" }],
  metadata: {},
  createdAt: "2026-06-16T00:00:00.000Z",
  updatedAt: "2026-06-16T00:00:00.000Z",
};

const recording: VoiceRecording = {
  id: "aud_test",
  sessionId: "ses_test",
  fileName: "meeting.webm",
  mimeType: "audio/webm",
  sizeBytes: 10,
  source: "DESKTOP",
  status: "UPLOADED",
  metadata: {
    sourceTrack: "system",
    diarizationMode: "speaker_labels_with_names",
  },
  createdAt: "2026-06-16T00:00:00.000Z",
};

const transcript: VoiceTranscript = {
  id: "trn_test",
  sessionId: "ses_test",
  language: "pt-BR",
  status: "COMPLETED",
  text: "Speaker 1: Oi.\nSpeaker 2: Tudo bem?",
  segments: [
    {
      id: "seg_1",
      speaker: "Speaker 1",
      startMs: 0,
      endMs: 1000,
      text: "Oi.",
    },
    {
      id: "seg_2",
      speaker: "Speaker 2",
      startMs: 1000,
      endMs: 2000,
      text: "Tudo bem?",
    },
  ],
  format: "TEXT",
  createdAt: "2026-06-16T00:00:00.000Z",
  updatedAt: "2026-06-16T00:00:00.000Z",
  provider: "test",
};

describe("remote audio diarization", () => {
  it("normalizes remote speakers and associates names when configured", () => {
    const normalized = normalizeRemoteDiarization(session, recording, transcript);

    assert.deepEqual(
      normalized.segments.map((segment) => segment.speaker),
      ["speaker_1 (Ana)", "speaker_2 (Bruno)"],
    );
    assert.match(normalized.text, /speaker_1 \(Ana\): Oi\./);
    assert.match(normalized.provider, /diarized/);
  });

  it("keeps remote transcript unchanged when diarization is disabled", () => {
    const normalized = normalizeRemoteDiarization(
      session,
      { ...recording, metadata: { sourceTrack: "system", diarizationMode: "off" } },
      transcript,
    );

    assert.equal(normalized, transcript);
  });

  it("uses the session speaker map when the recording has no explicit map", () => {
    const normalized = normalizeRemoteDiarization(
      {
        ...session,
        metadata: {
          speakerMap: {
            speaker_1: "Cliente",
            speaker_2: "Consultor",
          },
        },
      },
      recording,
      transcript,
    );

    assert.deepEqual(
      normalized.segments.map((segment) => segment.speaker),
      ["speaker_1 (Cliente)", "speaker_2 (Consultor)"],
    );
  });
});
