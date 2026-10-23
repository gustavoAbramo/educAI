import { apiClient } from "./apiClient";
import type {
  OutputFormat,
  SessionTranscriptResponse,
  TranscriptSegment,
  TranscriptStatus,
} from "@/types/api";

export function transcribeSession(sessionId: string) {
  return apiClient.postJson<SessionTranscriptResponse>(`/sessions/${sessionId}/transcribe`, {});
}

export function getSessionTranscript(sessionId: string) {
  return apiClient.get<SessionTranscriptResponse>(`/sessions/${sessionId}/transcript`);
}

export function updateSessionTranscript(
  sessionId: string,
  payload: {
    text: string;
    segments: TranscriptSegment[];
    status: TranscriptStatus;
    format: OutputFormat;
  },
) {
  return apiClient.patchJson<SessionTranscriptResponse>(
    `/sessions/${sessionId}/transcript`,
    payload,
  );
}
