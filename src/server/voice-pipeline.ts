import type {
  CallMaterials,
  ChatResponse,
  SessionRecord,
  TranscriptSegment,
  VoiceRecording,
  VoiceSession,
  VoiceTranscript,
} from "@/lib/voice-intelligence";
import {
  answerChatWithConfiguredProvider,
  generateMaterialsWithConfiguredProvider,
} from "./generation-provider";
import {
  buildSimulatedChatResponse,
  buildSimulatedMaterials,
  buildSimulatedTranscript,
} from "./simulated-session-runtime";
import { transcribeWithConfiguredProvider } from "./transcription-provider";

export async function transcribeRecording(
  session: VoiceSession,
  recording?: VoiceRecording,
): Promise<VoiceTranscript> {
  return transcribeWithConfiguredProvider(session, recording, buildSimulatedTranscript);
}

export async function createMaterials(
  session: VoiceSession,
  transcript: VoiceTranscript,
): Promise<CallMaterials> {
  return generateMaterialsWithConfiguredProvider(session, transcript, buildSimulatedMaterials);
}

function findCitations(record: SessionRecord, message: string): TranscriptSegment[] {
  const transcript = record.transcript;
  if (!transcript) return [];

  const terms = message
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 3);

  const matches = transcript.segments.filter((segment) => {
    const text = segment.text.toLowerCase();
    return terms.some((term) => text.includes(term));
  });

  return matches.slice(0, 3);
}

export async function answerChat(record: SessionRecord, message: string): Promise<ChatResponse> {
  const citations = findCitations(record, message);
  return answerChatWithConfiguredProvider(record, message, citations, (_record, _message, refs) =>
    buildSimulatedChatResponse(record, refs),
  );
}
