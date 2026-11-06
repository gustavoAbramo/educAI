import type { SessionAudio, SessionTranscript, TranscriptSegment } from "@/types/api";

export function formatSegmentTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function transcriptSegmentsForDisplay(
  transcript: SessionTranscript | null,
): TranscriptSegment[] {
  if (!transcript) return [];
  if (transcript.segments.length) return transcript.segments;

  let cursor = 0;
  return transcript.text
    .split(/\n{2,}|\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => {
      const duration = Math.max(3000, text.length * 55);
      const startMs = cursor;
      const endMs = cursor + duration;
      cursor = endMs;

      return {
        id: `local_seg_${index}`,
        speaker: `Pessoa ${index + 1}`,
        startMs,
        endMs,
        text,
      };
    });
}

export function transcriptTextFromSegments(segments: TranscriptSegment[]) {
  return segments
    .map((segment) => `${segment.speaker.trim() || "Pessoa"}: ${segment.text.trim()}`)
    .filter((line) => line.replace(/^.+:\s*/, "").trim().length > 0)
    .join("\n\n");
}

export function uniqueSpeakers(...groups: (string | undefined)[][]) {
  const seen = new Set<string>();
  const speakers: string[] = [];

  for (const group of groups) {
    for (const speaker of group) {
      const value = speaker?.trim();
      if (!value) continue;
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      speakers.push(value);
    }
  }

  return speakers;
}

export function canonicalSpeakerKey(speaker: string) {
  return speaker
    .trim()
    .toLowerCase()
    .match(/\b(speaker_\d+)\b/)?.[1];
}

export function speakerNameFromMappedLabel(speaker: string) {
  return speaker.match(/\bspeaker_\d+\s*\((?<name>[^)]+)\)/i)?.groups?.name?.trim();
}

export function speakerMapFromMetadata(metadata?: Record<string, unknown>) {
  const raw = metadata?.speakerMap;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {} as Record<string, string>;

  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [
        key.trim().toLowerCase(),
        typeof value === "string" ? value.trim() : "",
      ])
      .filter(([key, value]) => /^speaker_\d+$/i.test(key) && value),
  );
}

export function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function meetingAudioCaptureFromRecording(recording: SessionAudio) {
  const raw = recording.metadata?.meetingAudioCapture;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const capture = raw as Record<string, unknown>;

  return {
    status: metadataString(capture, "status"),
    message: metadataString(capture, "message"),
    trackCount:
      typeof capture.trackCount === "number" && Number.isFinite(capture.trackCount)
        ? capture.trackCount
        : 0,
    trackLabel: metadataString(capture, "trackLabel"),
    updatedAt: metadataString(capture, "updatedAt"),
  };
}

export function audioSourceLabel(recording: SessionAudio) {
  const sourceTrack = metadataString(recording.metadata, "sourceTrack");
  if (sourceTrack === "microphone") return "Microfone";
  if (sourceTrack === "system") return "Reuniao/sistema";
  return recording.source === "DESKTOP" ? "Reuniao/sistema" : "Audio";
}

export function formatAudioSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "tamanho indisponivel";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function applySpeakerMapToSegments(
  segments: TranscriptSegment[],
  speakerMap: Record<string, string>,
) {
  return segments.map((segment) => {
    const key = canonicalSpeakerKey(segment.speaker);
    if (!key) return segment;
    const mapped = speakerMap[key]?.trim();
    return {
      ...segment,
      speaker: mapped ? `${key} (${mapped})` : key,
    };
  });
}
