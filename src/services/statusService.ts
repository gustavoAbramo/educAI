import { apiClient } from "./apiClient";
import type { SessionStatusResponse } from "@/types/api";

export function getSessionStatus(sessionId: string) {
    return apiClient.get<SessionStatusResponse>(`/sessions/${sessionId}/status`);
}