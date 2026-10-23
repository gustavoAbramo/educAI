import { apiClient } from "./apiClient";
import type { SessionChatMessagesResponse } from "@/types/api";

export function getSessionChatMessages(sessionId: string) {
  return apiClient.get<SessionChatMessagesResponse>(`/sessions/${sessionId}/chat/messages`);
}
