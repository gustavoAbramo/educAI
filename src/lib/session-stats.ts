import type { Session } from "@/types/api";

// Favoritas ficam no metadata da propria sessao, entao valem em qualquer navegador.
export function isPinned(session: Pick<Session, "metadata">) {
  return session.metadata?.pinned === true;
}

// Data local no formato AAAA-MM-DD (sem passar por UTC, para nao trocar o dia).
export function localDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Semana comecando na segunda-feira.
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return seconds ? `${seconds}s` : "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

export type WeekBucket = { start: Date; label: string; count: number };

export function sessionsPerWeek(sessions: Session[], weeks: number, now = new Date()) {
  const current = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(current);
    start.setDate(start.getDate() - index * 7);
    buckets.push({
      start,
      label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      count: 0,
    });
  }
  const byWeek = new Map(buckets.map((bucket) => [localDayKey(bucket.start), bucket]));
  for (const session of sessions) {
    const bucket = byWeek.get(localDayKey(startOfWeek(new Date(session.createdAt))));
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

export function sessionStats(sessions: Session[], now = new Date()) {
  const weekStart = startOfWeek(now).getTime();
  return {
    total: sessions.length,
    ready: sessions.filter((session) => session.status === "READY").length,
    recordedSeconds: sessions.reduce((total, session) => total + (session.durationSeconds ?? 0), 0),
    thisWeek: sessions.filter((session) => new Date(session.createdAt).getTime() >= weekStart)
      .length,
  };
}
