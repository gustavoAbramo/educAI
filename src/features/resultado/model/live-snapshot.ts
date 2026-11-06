import { asNumber, asStringArray } from "./metrics";
import type {
  LivePreviewSegment,
  LiveAssistantSnapshotView,
  AssistantTranscriptExchange,
} from "./types";

export function livePreviewSegmentsFromMetadata(metadata?: Record<string, unknown>) {
  if (!metadata || typeof metadata !== "object") return [] as LivePreviewSegment[];
  const raw = (metadata as Record<string, unknown>).livePreview;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [] as LivePreviewSegment[];
  const segments = Array.isArray((raw as Record<string, unknown>).segments)
    ? ((raw as Record<string, unknown>).segments as unknown[])
    : [];

  return segments
    .map((segment) => {
      if (!segment || typeof segment !== "object") return undefined;
      const data = segment as Record<string, unknown>;
      const text = typeof data.text === "string" ? data.text.trim() : "";
      const speakerName =
        typeof data.speakerName === "string" && data.speakerName.trim()
          ? data.speakerName.trim()
          : "Pessoa";
      const id = typeof data.id === "string" ? data.id : "preview";

      if (!text) return undefined;

      return {
        id,
        speakerName,
        text,
        confidence: asNumber(data.confidence),
        clarity: asNumber(data.clarity),
        intonation: asNumber(data.intonation),
        conviction: asNumber(data.conviction),
        verbalQuality:
          data.verbalQuality === "adequada" || data.verbalQuality === "revisar"
            ? data.verbalQuality
            : undefined,
        technicalTerms: asStringArray(data.technicalTerms),
        createdAt: asNumber(data.createdAt),
        offsetMs: asNumber(data.offsetMs),
      };
    })
    .filter(Boolean) as LivePreviewSegment[];
}

export function liveAssistantSnapshotFromMetadata(metadata?: Record<string, unknown>) {
  if (!metadata || typeof metadata !== "object") return undefined;
  const raw = (metadata as Record<string, unknown>).liveAssistant;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const messages = Array.isArray((raw as Record<string, unknown>).messages)
    ? ((raw as Record<string, unknown>).messages as unknown[])
        .map((message) => {
          if (!message || typeof message !== "object") return undefined;
          const data = message as Record<string, unknown>;
          const content = typeof data.content === "string" ? data.content.trim() : "";
          if (!content) return undefined;
          const role = typeof data.role === "string" ? data.role : "assistant";
          return {
            id: typeof data.id === "string" ? data.id : undefined,
            role,
            content,
            createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
          };
        })
        .filter(Boolean)
    : [];

  const markers = Array.isArray((raw as Record<string, unknown>).markers)
    ? ((raw as Record<string, unknown>).markers as unknown[])
        .map((marker) => {
          if (!marker || typeof marker !== "object") return undefined;
          const data = marker as Record<string, unknown>;
          const label = typeof data.label === "string" ? data.label.trim() : "";
          const detail = typeof data.detail === "string" ? data.detail.trim() : "";
          if (!label && !detail) return undefined;
          return {
            id: typeof data.id === "string" ? data.id : undefined,
            kind: typeof data.kind === "string" ? data.kind : undefined,
            label,
            detail,
            createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
            speakerName: typeof data.speakerName === "string" ? data.speakerName : undefined,
            offsetMs: asNumber(data.offsetMs),
          };
        })
        .filter(Boolean)
    : [];

  const timeline = Array.isArray((raw as Record<string, unknown>).timeline)
    ? ((raw as Record<string, unknown>).timeline as unknown[])
        .map((item) => {
          if (!item || typeof item !== "object") return undefined;
          const data = item as Record<string, unknown>;
          const label = typeof data.label === "string" ? data.label.trim() : "";
          const detail = typeof data.detail === "string" ? data.detail.trim() : "";
          if (!label && !detail) return undefined;
          return {
            id: typeof data.id === "string" ? data.id : undefined,
            label,
            detail,
            createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
            speakerName: typeof data.speakerName === "string" ? data.speakerName : undefined,
            offsetMs: asNumber(data.offsetMs),
          };
        })
        .filter(Boolean)
    : [];

  const prompts = Array.isArray((raw as Record<string, unknown>).prompts)
    ? ((raw as Record<string, unknown>).prompts as unknown[])
        .map((prompt) => {
          if (!prompt || typeof prompt !== "object") return undefined;
          const data = prompt as Record<string, unknown>;
          const label = typeof data.label === "string" ? data.label.trim() : "";
          const promptText = typeof data.prompt === "string" ? data.prompt.trim() : "";
          const description = typeof data.description === "string" ? data.description.trim() : "";

          if (!label && !promptText && !description) return undefined;
          return { label, prompt: promptText, description };
        })
        .filter(Boolean)
    : [];

  return {
    mode:
      typeof (raw as Record<string, unknown>).mode === "string"
        ? String((raw as Record<string, unknown>).mode)
        : undefined,
    updatedAt:
      typeof (raw as Record<string, unknown>).updatedAt === "string"
        ? String((raw as Record<string, unknown>).updatedAt)
        : undefined,
    sessionTitle:
      typeof (raw as Record<string, unknown>).sessionTitle === "string"
        ? String((raw as Record<string, unknown>).sessionTitle)
        : undefined,
    contextLabel:
      typeof (raw as Record<string, unknown>).contextLabel === "string"
        ? String((raw as Record<string, unknown>).contextLabel)
        : undefined,
    activeSpeaker:
      typeof (raw as Record<string, unknown>).activeSpeaker === "string"
        ? String((raw as Record<string, unknown>).activeSpeaker)
        : undefined,
    messages: messages as LiveAssistantSnapshotView["messages"],
    prompts: prompts as LiveAssistantSnapshotView["prompts"],
    markers: markers as LiveAssistantSnapshotView["markers"],
    timeline: timeline as LiveAssistantSnapshotView["timeline"],
  } satisfies LiveAssistantSnapshotView;
}

export function assistantExchangesFromSnapshot(
  snapshot?: LiveAssistantSnapshotView,
): AssistantTranscriptExchange[] {
  const messages = snapshot?.messages ?? [];
  const exchanges: AssistantTranscriptExchange[] = [];

  messages.forEach((message, index) => {
    if (message.role !== "user") return;
    const question = message.content.trim();
    if (!question) return;

    const answer = messages
      .slice(index + 1)
      .find((candidate) => candidate.role === "assistant" && candidate.content.trim());

    exchanges.push({
      id: message.id ?? `assistant-exchange-${index}`,
      question,
      answer: answer?.content.trim() ?? "",
      createdAt: message.createdAt ?? answer?.createdAt,
    });
  });

  return exchanges;
}
