import { sessionSignalSnapshotFromMetadata, sessionSignalsContextLines } from "@/lib/session-signals";
import type { VoiceSession } from "@/lib/voice-intelligence";

const metadataLabels: Array<[string, string]> = [
  ["theme", "Main theme"],
  ["discipline", "Area or discipline"],
  ["context", "Context to consider"],
  ["audience", "Audience"],
  ["level", "Audience level"],
  ["objectives", "Session objectives"],
  ["aiInstructions", "AI instructions"],
  ["outputsRequested", "Requested outputs"],
  ["outputs", "Requested outputs"],
  ["summaryStyle", "Summary style"],
  ["tone", "Tone"],
  ["avoidTopics", "Topics to avoid"],
  ["expectedDuration", "Expected duration"],
  ["sessionFormat", "Session format"],
  ["previousTasks", "Previous tasks or agreements"],
];

function valueText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(valueText).filter(Boolean).join(", ");
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function sessionContextLines(session: VoiceSession) {
  const lines = [
    `Session title: ${session.title}`,
    `Session type: ${session.type}`,
    `Language: ${session.language}`,
    `Participants: ${session.participants.map((participant) => participant.name).join(", ") || "Unknown"}`,
  ];

  const summaryTemplate = valueText(session.summaryTemplate);
  if (summaryTemplate) {
    lines.push(`Summary template: ${summaryTemplate}`);
  }

  for (const [key, label] of metadataLabels) {
    const text = valueText(session.metadata?.[key]);
    if (text) {
      lines.push(`${label}: ${text}`);
    }
  }

  const signalSnapshot = sessionSignalSnapshotFromMetadata(session.metadata);
  for (const line of sessionSignalsContextLines(signalSnapshot)) {
    lines.push(line);
  }

  return lines;
}

export function sessionContextText(session: VoiceSession) {
  return sessionContextLines(session).join("\n");
}

export function sessionContextInstruction(session: VoiceSession) {
  return [
    "Use the session context below as authoritative guidance.",
    "Avoid generic output when theme, audience, objectives, or AI instructions are provided.",
    "Prioritize the transcript as the source of truth, but tailor the structure, tone, examples, and follow-up to the context.",
    sessionContextText(session),
  ].join("\n");
}

