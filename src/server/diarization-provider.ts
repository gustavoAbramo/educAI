import type {
  TranscriptSegment,
  VoiceRecording,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import { readStoredRecording } from "./local-recordings";
import { requestProviderJson } from "./provider-http";
import { getProviderRuntimeConfig } from "./provider-runtime";

type DiarizationJson = Record<string, unknown>;

function resolveFasterWhisperSettings() {
  const { settings } = getProviderRuntimeConfig();
  return {
    baseUrl: settings.fasterWhisperBaseUrl.replace(/\/+$/, ""),
    model: settings.fasterWhisperModel.trim(),
  };
}

function metadataString(recording: VoiceRecording, key: string) {
  const value = recording.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function sourceTrack(recording: VoiceRecording) {
  return metadataString(recording, "sourceTrack");
}

function diarizationMode(recording: VoiceRecording) {
  return metadataString(recording, "diarizationMode");
}

function readSpeakerMap(session: VoiceSession, recording: VoiceRecording) {
  const merged = {
    ...(session.metadata?.speakerMap && typeof session.metadata.speakerMap === "object"
      ? (session.metadata.speakerMap as Record<string, unknown>)
      : {}),
    ...(recording.metadata?.speakerMap && typeof recording.metadata.speakerMap === "object"
      ? (recording.metadata.speakerMap as Record<string, unknown>)
      : {}),
  };

  return Object.fromEntries(
    Object.entries(merged)
      .map(([key, value]) => [key, typeof value === "string" ? value : ""])
      .filter(([key, value]) => /^speaker_\d+$/i.test(key) && value.trim()),
  );
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDiarizationSegments(payload: DiarizationJson) {
  const raw = Array.isArray(payload.segments) ? payload.segments : [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return undefined;
      const segment = item as Record<string, unknown>;
      const speaker = textValue(segment.speaker) || `speaker_${index + 1}`;
      const startMs =
        numberValue(segment.startMs) ??
        numberValue(segment.start_ms) ??
        (numberValue(segment.start) ?? 0) * 1000;
      const endMs =
        numberValue(segment.endMs) ??
        numberValue(segment.end_ms) ??
        (numberValue(segment.end) ?? 0) * 1000;

      return {
        speaker: speaker.toLowerCase().replace(/\s+/g, "_"),
        startMs: Math.max(0, Math.round(startMs)),
        endMs: Math.max(Math.round(endMs), Math.round(startMs) + 1),
      };
    })
    .filter((item): item is { speaker: string; startMs: number; endMs: number } => Boolean(item));
}

function overlapMs(
  a: Pick<TranscriptSegment, "startMs" | "endMs">,
  b: { startMs: number; endMs: number },
) {
  return Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
}

function applyDiarization(
  transcript: VoiceTranscript,
  diarizationSegments: Array<{ speaker: string; startMs: number; endMs: number }>,
  provider: string,
) {
  if (!diarizationSegments.length) return transcript;

  const segments = transcript.segments.map((segment, index) => {
    const best =
      diarizationSegments
        .map((candidate) => ({
          candidate,
          overlap: overlapMs(segment, candidate),
        }))
        .sort((a, b) => b.overlap - a.overlap)[0]?.candidate ??
      diarizationSegments[index % diarizationSegments.length];

    return {
      ...segment,
      speaker: best.speaker,
    };
  });

  return {
    ...transcript,
    text: segments.map((segment) => `${segment.speaker}: ${segment.text}`).join("\n"),
    segments,
    provider: `${transcript.provider}:diarized:${provider}`,
  };
}

export async function diarizeRemoteTranscriptWithWorker(
  session: VoiceSession,
  recording: VoiceRecording,
  transcript: VoiceTranscript,
) {
  if (sourceTrack(recording) !== "system") return transcript;
  const mode = diarizationMode(recording);
  if (mode !== "speaker_labels" && mode !== "speaker_labels_with_names") return transcript;

  const stored = await readStoredRecording(recording);
  if (!stored) return transcript;

  try {
    const { baseUrl, model } = resolveFasterWhisperSettings();
    const form = new FormData();
    form.append(
      "file",
      new File([stored.bytes as BlobPart], stored.fileName, { type: stored.mimeType }),
    );
    form.append("model", model);
    form.append("language", session.language);
    form.append("segments", JSON.stringify(transcript.segments));
    form.append("speakerMap", JSON.stringify(readSpeakerMap(session, recording)));

    const result = await requestProviderJson<DiarizationJson>({
      provider: "Faster-Whisper diarization",
      url: `${baseUrl}/diarize`,
      init: {
        method: "POST",
        body: form,
      },
    });

    const provider = textValue(result.provider) || "worker";
    return applyDiarization(transcript, parseDiarizationSegments(result), provider);
  } catch (error) {
    console.warn(
      `[educAI] diarization worker unavailable; falling back to transcript labels: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return transcript;
  }
}
