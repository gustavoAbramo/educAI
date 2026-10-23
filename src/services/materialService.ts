import { apiClient } from "./apiClient";
import type { SessionMaterialsResponse } from "@/types/api";

export function generateSessionMaterials(sessionId: string) {
  return apiClient.postJson<SessionMaterialsResponse>(
    `/sessions/${sessionId}/materials/generate`,
    {},
  );
}

export function getSessionMaterials(sessionId: string) {
  return apiClient.get<SessionMaterialsResponse>(`/sessions/${sessionId}/materials`);
}
