import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/back-button";
import { getSessionTypeLabel } from "@/lib/session-format";
import { formatDuration, isPinned, localDayKey } from "@/lib/session-stats";
import { cn } from "@/lib/utils";
import { getSessions } from "@/services/sessionService";
import type { Session } from "@/types/api";

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Dias que aparecem na grade: completa a primeira e a ultima semana com
// dias dos meses vizinhos (semana comecando na segunda).
function monthGrid(month: Date) {
  const first = monthStart(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((offset + lastDay) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function sessionTarget(session: Session) {
  if (session.status === "READY" || session.hasMaterials) return "/resultado";
  if (session.status === "CREATED") return "/aula";
  return "/processando";
}

export function CalendarioPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(() => localDayKey(new Date()));

  useEffect(() => {
    let active = true;
    getSessions()
      .then((response) => {
        if (active) setSessions(response.data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "API indisponível.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      const key = localDayKey(session.createdAt);
      map.set(key, [...(map.get(key) ?? []), session]);
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return map;
  }, [sessions]);

  const days = useMemo(() => monthGrid(month), [month]);
  const todayKey = localDayKey(new Date());
  const monthLabel = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const monthSessions = useMemo(
    () =>
      sessions
        .filter((session) => {
          const created = new Date(session.createdAt);
          return (
            created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth()
          );
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [month, sessions],
  );
  const monthSeconds = monthSessions.reduce((total, s) => total + (s.durationSeconds ?? 0), 0);

  const listed = selectedDay ? (byDay.get(selectedDay) ?? []) : monthSessions;
  const listTitle = selectedDay
    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : `Todas de ${monthLabel}`;

  const shiftMonth = (delta: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    setSelectedDay(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/painel" label="Início" />
      </div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Calendário</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Veja em que dias você gravou aulas. Clique num dia para listar as aulas dele.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {monthSessions.length} {monthSessions.length === 1 ? "aula" : "aulas"} no mês
          {monthSeconds > 0 ? ` · ${formatDuration(monthSeconds)} gravadas` : ""}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mês anterior"
              className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold first-letter:uppercase" aria-live="polite">
                {monthLabel}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setMonth(monthStart(new Date()));
                  setSelectedDay(todayKey);
                }}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Hoje
              </button>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Próximo mês"
              className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {weekdays.map((weekday) => (
              <div key={weekday} className="py-1">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = localDayKey(day);
              const count = byDay.get(key)?.length ?? 0;
              const outside = day.getMonth() !== month.getMonth();
              const selected = key === selectedDay;
              const label = day.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(selected ? null : key)}
                  aria-pressed={selected}
                  aria-label={`${label}: ${count ? `${count} ${count === 1 ? "aula" : "aulas"}` : "nenhuma aula"}`}
                  className={cn(
                    "flex aspect-square min-h-11 flex-col items-center justify-start gap-1 rounded-lg border p-1 pt-1.5 text-sm transition sm:aspect-[4/3]",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent hover:border-border hover:bg-muted/60",
                    outside && !selected && "text-muted-foreground/50",
                    key === todayKey && !selected && "border-border font-semibold",
                  )}
                >
                  <span className="tabular-nums">{day.getDate()}</span>
                  {count ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-medium tabular-nums",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold first-letter:uppercase">{listTitle}</h2>
            {selectedDay ? (
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ver o mês todo
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando aulas...
            </div>
          ) : listed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma aula {selectedDay ? "neste dia" : "neste mês"}.
              <div className="mt-3">
                <Link to="/nova-aula" className="text-primary hover:underline">
                  Criar nova aula
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {listed.map((session) => (
                <li key={session.id}>
                  <Link
                    to={sessionTarget(session)}
                    search={{ sessionId: session.id } as never}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3 transition hover:border-primary/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium group-hover:text-primary">
                        {isPinned(session) ? (
                          <Star
                            className="h-3.5 w-3.5 shrink-0 fill-current text-amber-500"
                            aria-label="Favorita"
                          />
                        ) : null}
                        <span className="truncate">{session.title}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {selectedDay
                          ? new Date(session.createdAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : new Date(session.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                        {" · "}
                        {getSessionTypeLabel(session.type)}
                        {session.durationSeconds
                          ? ` · ${formatDuration(session.durationSeconds)}`
                          : ""}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
