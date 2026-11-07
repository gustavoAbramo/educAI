import { apiClient } from "./apiClient";
import type {
  CreateSessionRequest,
  Session,
  SessionListResponse,
  SessionOverviewResponse,
  UpdateSessionRequest,
} from "@/types/api";

export function createSession(payload: CreateSessionRequest) {
  return apiClient.postJson<{ data: Session }>("/sessions", payload);
}

export function getSessions() {
  return apiClient.get<SessionListResponse>("/sessions");
}

export function getSessionById(sessionId: string) {
  return apiClient.get<{ data: Session }>(`/sessions/${sessionId}`);
}

export function updateSession(sessionId: string, payload: UpdateSessionRequest) {
  return apiClient.patchJson<{ data: Session }>(`/sessions/${sessionId}`, payload);
}

export function deleteSession(sessionId: string) {
  return apiClient.delete<{ data: { id: string; deleted: boolean } }>(`/sessions/${sessionId}`);
}

export function getSessionOverview(sessionId: string) {
  return apiClient.get<SessionOverviewResponse>(`/sessions/${sessionId}/overview`);
}
