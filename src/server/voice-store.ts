import type {
  ChatMessage,
  CreateSessionRequest,
  RecordingUploadRequest,
  SessionProcessingStatus,
  SessionRecord,
  SessionStatus,
  TranscriptSegment,
  UpdateSessionRequest,
  VoiceRecording,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import { sessionSignalSnapshotFromMetadata } from "@/lib/session-signals";
import { diarizeRemoteTranscriptWithWorker } from "./diarization-provider";
import { answerChat, createMaterials, transcribeRecording } from "./voice-pipeline";
import {
  loadVoiceSessionsFromPersistence,
  saveVoiceSessionsToPersistence,
  voicePersistenceStatus,
} from "./voice-persistence";

const sessions = new Map<string, SessionRecord>();
let loadPromise: Promise<void> | undefined;
let savePromise: Promise<void> = Promise.resolve();

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function statusFor(
  sessionId: string,
  status: SessionStatus,
  currentStep: string,
  progress: number,
  error?: string,
): SessionProcessingStatus {
  return {
    sessionId,
    status,
    currentStep,
    progress,
    error,
    updatedAt: now(),
  };
}

function metadataString(recording: VoiceRecording, key: string) {
  const value = recording.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function sourceLabel(sourceTrack: unknown) {
  return sourceTrack === "microphone"
    ? "Microfone local"
    : sourceTrack === "system"
      ? "Audio da reuniao/sistema"
      : "Fonte de audio";
}

function normalizeSpeakerMap(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [
        key.trim().toLowerCase(),
        typeof value === "string" ? value.trim() : "",
      ])
      .filter(([key, value]) => key && value),
  );
}

function speakerMapFromMetadata(session: VoiceSession, recording: VoiceRecording) {
  return {
    ...normalizeSpeakerMap(session.metadata?.speakerMap),
    ...normalizeSpeakerMap(recording.metadata?.speakerMap),
  };
}

function normalizedRemoteSpeakerLabel(args: {
  baseLabel: string;
  speakerIndex: number;
  speakerMap: Record<string, string>;
  session: VoiceSession;
  withNames: boolean;
}) {
  const canonical = `speaker_${args.speakerIndex}`;
  const normalizedBase = args.baseLabel.trim().toLowerCase();
  const mappedName =
    args.speakerMap[canonical] ??
    args.speakerMap[normalizedBase] ??
    (args.withNames ? args.session.participants[args.speakerIndex - 1]?.name?.trim() : undefined);

  return mappedName ? `${canonical} (${mappedName})` : canonical;
}

export function normalizeRemoteDiarization(
  session: VoiceSession,
  recording: VoiceRecording,
  transcript: VoiceTranscript,
): VoiceTranscript {
  if (metadataString(recording, "sourceTrack") !== "system") return transcript;

  const diarizationMode = metadataString(recording, "diarizationMode");
  if (diarizationMode !== "speaker_labels" && diarizationMode !== "speaker_labels_with_names") {
    return transcript;
  }

  const speakerIds = new Map<string, number>();
  const speakerMap = speakerMapFromMetadata(session, recording);
  const withNames = diarizationMode === "speaker_labels_with_names";

  const segments: TranscriptSegment[] = transcript.segments.map((segment) => {
    const base = segment.speaker.trim() || "speaker";
    const key = base.toLowerCase();
    if (!speakerIds.has(key)) {
      speakerIds.set(key, speakerIds.size + 1);
    }

    const speakerIndex = speakerIds.get(key) ?? 1;
    return {
      ...segment,
      speaker: normalizedRemoteSpeakerLabel({
        baseLabel: base,
        speakerIndex,
        speakerMap,
        session,
        withNames,
      }),
    };
  });

  return {
    ...transcript,
    text: segments.map((segment) => `${segment.speaker}: ${segment.text}`).join("\n"),
    segments,
    provider: `${transcript.provider}:diarized`,
  };
}

function setStatus(
  record: SessionRecord,
  status: SessionStatus,
  currentStep: string,
  progress: number,
  error?: string,
) {
  record.session.status = status;
  record.session.updatedAt = now();
  if (status === "READY") {
    record.session.completedAt = record.session.completedAt ?? record.session.updatedAt;
    record.session.failureReason = undefined;
  }
  if (status === "FAILED") {
    record.session.failureReason = error;
  }
  record.status = statusFor(record.session.id, status, currentStep, progress, error);
}

function replaceSessions(records: SessionRecord[]) {
  sessions.clear();
  for (const record of records) {
    if (!record?.session?.id) continue;
    if (!record.status) {
      record.status = statusFor(
        record.session.id,
        record.session.status,
        "restored",
        record.session.status === "READY" ? 100 : 0,
      );
    }
    sessions.set(record.session.id, record);
  }
}

async function persistVoiceSessions() {
  const records = Array.from(sessions.values());
  savePromise = savePromise
    .catch(() => undefined)
    .then(() => saveVoiceSessionsToPersistence(records));
  await savePromise;
}

export async function ensureVoiceStoreLoaded() {
  loadPromise ??= (async () => {
    const persistedRecords = await loadVoiceSessionsFromPersistence();
    if (persistedRecords && persistedRecords.length > 0) {
      replaceSessions(persistedRecords);
    }
  })();

  await loadPromise;
}

function createVoiceSessionRecord(input: CreateSessionRequest, ownerId?: string): SessionRecord {
  const timestamp = now();
  const session: VoiceSession = {
    id: id("ses"),
    type: input.type,
    externalId: input.externalId,
    title: input.title.trim(),
    language: input.language.trim(),
    status: "CREATED",
    participants: input.participants ?? [],
    summaryTemplate: input.summaryTemplate,
    metadata: input.metadata ?? {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const record: SessionRecord = {
    ownerId,
    session,
    recordings: [],
    messages: [],
    status: statusFor(session.id, "CREATED", "session_created", 0),
  };

  sessions.set(session.id, record);
  return record;
}

export async function createVoiceSession(
  input: CreateSessionRequest,
  ownerId?: string,
): Promise<SessionRecord> {
  const record = createVoiceSessionRecord(input, ownerId);
  await persistVoiceSessions();
  return record;
}

export async function updateVoiceSession(sessionId: string, patch: UpdateSessionRequest) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (title) record.session.title = title;
  }

  if (patch.participants !== undefined) {
    record.session.participants = patch.participants;
  }

  if (patch.metadata !== undefined) {
    record.session.metadata = {
      ...record.session.metadata,
      ...patch.metadata,
    };
  }

  record.session.updatedAt = now();
  await persistVoiceSessions();
  return record.session;
}

export function listVoiceSessions(ownerId?: string) {
  return Array.from(sessions.values())
    .filter((record) => record.ownerId === ownerId)
    .sort((a, b) => b.session.createdAt.localeCompare(a.session.createdAt));
}

export function getVoiceSession(sessionId: string, ownerId?: string) {
  const record = sessions.get(sessionId);
  return record?.ownerId === ownerId ? record : undefined;
}

export async function addRecording(
  sessionId: string,
  input: RecordingUploadRequest,
): Promise<VoiceRecording> {
  const record = sessions.get(sessionId);
  if (!record) {
    throw new Error("SESSION_NOT_FOUND");
  }

  setStatus(record, "UPLOADING_AUDIO", "uploading_audio", 15);

  const recording: VoiceRecording = {
    id: id("rec"),
    sessionId,
    fileName: input.fileName?.trim() || "recording.webm",
    mimeType: input.mimeType?.trim() || "audio/webm",
    sizeBytes: input.sizeBytes ?? 0,
    source: input.source,
    status: input.status ?? "UPLOADED",
    durationSeconds: input.durationSeconds,
    storage: input.storage,
    metadata: input.metadata ?? {},
    createdAt: now(),
    updatedAt: now(),
  };

  record.recordings.push(recording);

  const signalSnapshot = sessionSignalSnapshotFromMetadata(input.metadata);
  if (signalSnapshot) {
    record.session.metadata = {
      ...record.session.metadata,
      sessionSignals: signalSnapshot,
    };
  }

  setStatus(record, "AUDIO_UPLOADED", "audio_uploaded", 30);
  await persistVoiceSessions();
  return recording;
}

export function listRecordings(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return record.recordings;
}

export function getRecording(sessionId: string, recordingId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return record.recordings.find((item) => item.id === recordingId);
}

export function getSessionStatus(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return record.status;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  currentStep?: string,
  progress?: number,
  error?: string,
) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");

  setStatus(
    record,
    status,
    currentStep ?? "manual_update",
    progress ?? record.status.progress,
    error,
  );
  await persistVoiceSessions();
  return record.status;
}

export async function transcribeSession(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");

  if (record.recordings.length === 0) throw new Error("AUDIO_NOT_FOUND");

  try {
    setStatus(record, "TRANSCRIBING", "transcribing", 45);
    const recordingsToTranscribe =
      record.recordings.length > 1
        ? record.recordings.filter((recording) => {
            const sourceTrack = recording.metadata?.sourceTrack;
            return sourceTrack === "microphone" || sourceTrack === "system";
          })
        : record.recordings;
    const sourceRecordings = recordingsToTranscribe.length
      ? recordingsToTranscribe
      : record.recordings;
    const transcripts: Array<{ recording: VoiceRecording; transcript: VoiceTranscript }> = [];

    for (const recording of sourceRecordings) {
      const transcript = await transcribeRecording(record.session, recording);
      transcripts.push({
        recording,
        transcript: normalizeRemoteDiarization(
          record.session,
          recording,
          await diarizeRemoteTranscriptWithWorker(record.session, recording, transcript),
        ),
      });
    }

    if (transcripts.length === 1) {
      record.transcript = transcripts[0].transcript;
      record.transcript.status = "COMPLETED";
      record.transcript.updatedAt = now();
    } else {
      const createdAt = now();

      record.transcript = {
        id: `trn_${crypto.randomUUID()}`,
        sessionId: record.session.id,
        language: record.session.language,
        status: "COMPLETED",
        text: transcripts
          .map(({ recording, transcript }) =>
            [`[${sourceLabel(recording.metadata?.sourceTrack)}]`, transcript.text].join("\n"),
          )
          .join("\n\n"),
        segments: transcripts.flatMap(({ recording, transcript }, recordingIndex) =>
          transcript.segments.map((segment) => ({
            ...segment,
            id: `${segment.id}_${recordingIndex}`,
            speaker:
              recording.metadata?.sourceTrack === "system"
                ? segment.speaker
                : `${sourceLabel(recording.metadata?.sourceTrack)} - ${segment.speaker}`,
          })),
        ),
        format: "TEXT",
        createdAt,
        updatedAt: createdAt,
        provider: transcripts.map(({ transcript }) => transcript.provider).join(" + "),
      };
    }
    setStatus(record, "TRANSCRIBED", "transcribed", 65);
    await persistVoiceSessions();
    return record.transcript;
  } catch (error) {
    setStatus(
      record,
      "FAILED",
      "transcription_failed",
      65,
      error instanceof Error ? error.message : "Unknown transcription error",
    );
    await persistVoiceSessions();
    throw error;
  }
}

export function getTranscript(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return record.transcript;
}

export async function updateTranscript(
  sessionId: string,
  payload: Pick<
    NonNullable<SessionRecord["transcript"]>,
    "text" | "segments" | "status" | "format"
  >,
) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  if (!record.transcript) throw new Error("TRANSCRIPT_NOT_FOUND");

  record.transcript.text = payload.text;
  record.transcript.segments = payload.segments;
  record.transcript.status = payload.status;
  record.transcript.format = payload.format;
  record.transcript.updatedAt = now();
  await persistVoiceSessions();
  return record.transcript;
}

export async function generateSessionMaterials(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  if (!record.transcript) throw new Error("TRANSCRIPT_NOT_FOUND");

  try {
    setStatus(record, "GENERATING_MATERIALS", "generating_materials", 80);
    record.materials = await createMaterials(record.session, record.transcript);
    setStatus(record, "READY", "ready", 100);
    await persistVoiceSessions();
    return record.materials;
  } catch (error) {
    setStatus(
      record,
      "FAILED",
      "materials_generation_failed",
      80,
      error instanceof Error ? error.message : "Unknown material generation error",
    );
    await persistVoiceSessions();
    throw error;
  }
}

export function listMaterials(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return record.materials?.items ?? [];
}

export function getMaterial(sessionId: string, materialId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return record.materials?.items.find((item) => item.id === materialId);
}

export async function addUserMessage(sessionId: string, content: string): Promise<ChatMessage> {
  const record = sessions.get(sessionId);
  if (!record) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const message: ChatMessage = {
    id: id("msg"),
    sessionId,
    role: "USER",
    content,
    createdAt: now(),
  };

  record.messages.push(message);
  record.session.updatedAt = now();
  await persistVoiceSessions();
  return message;
}

export async function answerSessionChat(sessionId: string, content: string) {
  const record = sessions.get(sessionId);
  if (!record) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const response = await answerChat(record, content);
  record.messages.push(response.message);
  record.session.updatedAt = now();
  await persistVoiceSessions();
  return response;
}

export function listChatMessages(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");
  return record.messages;
}

export function getSessionOverview(sessionId: string) {
  const record = sessions.get(sessionId);
  if (!record) throw new Error("SESSION_NOT_FOUND");

  return {
    session: record.session,
    status: record.status,
    audioCount: record.recordings.length,
    transcriptId: record.transcript?.id,
    materialsCount: record.materials?.items.length ?? 0,
    materialsModel: record.materials?.model,
    materialsGeneratedAt: record.materials?.generatedAt,
    materialsJsonRepaired: Boolean(record.materials?.model.includes("json-repaired")),
    persistence: voicePersistenceStatus(),
    chatMessages: record.messages.length,
    updatedAt: record.session.updatedAt,
  };
}
