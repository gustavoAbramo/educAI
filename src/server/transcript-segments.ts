import type { TranscriptSegment, VoiceSession } from "@/lib/voice-intelligence";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function participantName(session: VoiceSession, index: number) {
  return session.participants[index]?.name?.trim();
}

function fallbackSpeaker(session: VoiceSession, index: number) {
  return participantName(session, index) ?? `Pessoa ${index + 1}`;
}

function speakerFromLabel(session: VoiceSession, label: string) {
  const cleanLabel = label.trim().replace(/\s+/g, " ");
  const numeric = cleanLabel.match(/\b(\d{1,2})\b/)?.[1];
  if (numeric) {
    const participant = participantName(session, Number(numeric) - 1);
    if (participant) return participant;
  }

  const matchingParticipant = session.participants.find((participant) => {
    const name = participant.name.trim();
    return name && name.localeCompare(cleanLabel, undefined, { sensitivity: "base" }) === 0;
  });

  return matchingParticipant?.name ?? cleanLabel;
}

function speakerLine(line: string) {
  const match = line.match(
    /^(?:[-*]\s*)?(?:\[(?<bracket>[^\]]{1,40})\]|(?<label>[\p{L}\p{N} ._-]{1,40}))\s*:\s*(?<text>.+)$/u,
  );
  if (!match?.groups?.text) return undefined;

  const label = (match.groups.bracket ?? match.groups.label ?? "").trim();
  if (!label) return undefined;

  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const looksLikeSpeaker =
    /\b(speaker|pessoa|person|professor|teacher|aluno|student|participante|participant|host|convidado)\b/.test(
      normalized,
    ) || /\d/.test(normalized);

  return looksLikeSpeaker ? { speaker: label, text: match.groups.text.trim() } : undefined;
}

export function transcriptSegmentsFromText(
  session: VoiceSession,
  text: string,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let cursor = 0;
  let currentSpeaker = fallbackSpeaker(session, 0);
  let currentText: string[] = [];
  let fallbackIndex = 0;

  const pushSegment = () => {
    const segmentText = currentText.join(" ").replace(/\s+/g, " ").trim();
    if (!segmentText) return;

    const duration = Math.max(3000, segmentText.length * 55);
    const startMs = cursor;
    const endMs = cursor + duration;
    cursor = endMs;

    segments.push({
      id: id("seg"),
      speaker: currentSpeaker,
      startMs,
      endMs,
      text: segmentText,
    });
    currentText = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      pushSegment();
      fallbackIndex += 1;
      currentSpeaker = fallbackSpeaker(
        session,
        fallbackIndex % Math.max(1, session.participants.length || 2),
      );
      continue;
    }

    const labeled = speakerLine(line);
    if (labeled) {
      pushSegment();
      currentSpeaker = speakerFromLabel(session, labeled.speaker);
      currentText = [labeled.text];
      continue;
    }

    currentText.push(line);
  }

  pushSegment();

  if (segments.length) return segments;

  return [
    {
      id: id("seg"),
      speaker: fallbackSpeaker(session, 0),
      startMs: 0,
      endMs: Math.max(3000, text.length * 55),
      text,
    },
  ];
}
