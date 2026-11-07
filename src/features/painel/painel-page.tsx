import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Loader2,
  Mic,
  Radar,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatSessionDate, getSessionTypeLabel } from "@/lib/session-format";
import { formatDuration, isPinned, sessionStats, sessionsPerWeek } from "@/lib/session-stats";
import { getSessions } from "@/services/sessionService";
import type { Session } from "@/types/api";
import { WeeklyChart } from "./weekly-chart";

const highlights = [
  {
    icon: Radar,
    title: "Captura ao vivo",
    text: "Transcricao, sinais de clareza e contexto fluem em tempo real durante a aula.",
  },
  {
    icon: BrainCircuit,
    title: "Assistente contextual",
    text: "A IA combina contexto da aula, base local e busca web quando realmente precisa.",
  },
  {
    icon: Sparkles,
    title: "Materiais acionaveis",
    text: "Resumo, perguntas, mapas e proximos passos surgem com cara de produto final.",
  },
];

export function Painel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const stats = useMemo(() => sessionStats(sessions), [sessions]);
  const weeks = useMemo(() => sessionsPerWeek(sessions, 8), [sessions]);
  const pinned = useMemo(() => sessions.filter(isPinned), [sessions]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getSessions();
        if (!active) return;
        setSessions(response.data);
      } catch (caughtError) {
        if (!active) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "API local indisponivel. Inicie com npm run dev:api.",
        );
        setSessions([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div className="pointer-events-none absolute inset-x-8 top-8 h-56 rounded-[3rem] bg-gradient-brand-soft blur-3xl opacity-90" />

      <section className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/75 px-6 py-8 shadow-card backdrop-blur-xl sm:px-10 sm:py-12">
        <div className="absolute inset-0 bg-surface-atmosphere opacity-70" />
        <div className="absolute -right-16 top-8 h-48 w-48 rounded-full bg-[color:color-mix(in_oklab,var(--color-brand-coral)_18%,transparent)] blur-3xl" />
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-brand" />

        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse-rec" />
              educAI studio
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
              Transforme aulas em{" "}
              <span className="text-gradient-brand">inteligencia acionavel</span>.
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
              Grave, transcreva, organize e converse com a aula como se o sistema fosse uma mesa de
              comando editorial feita para conhecimento ao vivo.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/nova-aula"
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-brand px-5 text-sm font-medium text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95 active:scale-[0.98]"
              >
                <Mic className="h-4 w-4" />
                Iniciar nova aula
              </Link>

              <Link
                to="/historico"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-border/80 bg-background/75 px-5 text-sm font-medium text-foreground shadow-soft transition hover:border-primary/30 hover:bg-card"
              >
                Ver historico
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/75 bg-background/75 p-4 shadow-soft"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-brand-soft text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-4 text-sm font-semibold">{item.title}</div>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.1fr]" aria-label="Estatísticas">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Aulas", value: String(stats.total), hint: "no total" },
            {
              label: "Horas gravadas",
              value: formatDuration(stats.recordedSeconds),
              hint: "somando todos os áudios",
            },
            { label: "Esta semana", value: String(stats.thisWeek), hint: "aulas desde segunda" },
            { label: "Prontas", value: String(stats.ready), hint: "com materiais gerados" },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-[1.6rem] border border-border/75 bg-card/70 p-5 shadow-soft"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {tile.label}
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {loading ? "–" : tile.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[1.6rem] border border-border/75 bg-card/70 p-5 shadow-soft">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Aulas por semana</h2>
            <span className="text-xs text-muted-foreground">últimas 8 semanas</span>
          </div>
          <WeeklyChart buckets={weeks} />
        </div>
      </section>

      {pinned.length > 0 ? (
        <section className="mt-10" aria-labelledby="favoritas-titulo">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2
                id="favoritas-titulo"
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
              >
                <Star className="h-3.5 w-3.5 fill-current text-amber-500" aria-hidden />
                Favoritas
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Marque com a estrela no Histórico para fixar aqui.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pinned.map((session) => (
              <Link
                key={session.id}
                to="/resultado"
                search={{ sessionId: session.id } as never}
                className="group rounded-2xl border border-border/80 bg-card/75 p-4 shadow-soft transition hover:border-primary/30"
              >
                <div className="truncate text-sm font-semibold group-hover:text-primary">
                  {session.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {getSessionTypeLabel(session.type)} · {formatSessionDate(session.createdAt)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Aulas recentes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Retome rapidamente o que acabou de ser capturado e processado.
            </p>
          </div>
          <Link
            to="/historico"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Ver tudo <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {error ? (
          <div className="mb-4 rounded-[1.6rem] border border-dashed border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-[1.8rem] border border-border/75 bg-card/70 p-8 text-center text-sm text-muted-foreground shadow-soft">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando sessoes...
          </div>
        ) : null}

        {!loading && sessions.length === 0 ? (
          <div className="rounded-[1.8rem] border border-dashed border-border/80 bg-card/70 p-10 text-center shadow-soft">
            <div className="text-base font-semibold">Nenhuma sessao criada ainda</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Quando houver dados reais salvos, as sessoes recentes aparecerao aqui com mais
              contexto visual.
            </div>
            <Link
              to="/nova-aula"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl border border-border/80 bg-background/80 px-4 text-sm font-medium text-foreground shadow-soft transition hover:border-primary/40 hover:bg-card"
            >
              <Mic className="h-4 w-4" />
              Criar primeira sessao
            </Link>
          </div>
        ) : null}

        {!loading && sessions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.slice(0, 4).map((session, index) => (
              <Link
                key={session.id}
                to="/resultado"
                search={{ sessionId: session.id } as never}
                className="group relative overflow-hidden rounded-[1.8rem] border border-border/80 bg-card/75 p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand opacity-70" />
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-brand-soft text-sm font-semibold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-foreground" />
                </div>
                <div className="mt-6 text-lg font-semibold tracking-tight">{session.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {getSessionTypeLabel(session.type)}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-muted-foreground">
                  <span>{formatSessionDate(session.createdAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    Abrir sessao
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
