import { apiClient } from "./apiClient";
import type { AssistantRespondRequest, AssistantRespondResponse } from "@/types/api";

export function askAssistant(body: AssistantRespondRequest) {
  return apiClient.postJson<AssistantRespondResponse>("/assistant/respond", body);
}
