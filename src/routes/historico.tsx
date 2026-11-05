import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Layers3,
  Loader2,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  formatSessionDate,
  formatSessionUpdatedLabel,
  getSessionTypeLabel,
} from "@/lib/session-format";
import { BackButton } from "@/components/back-button";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { getSessionMaterials } from "@/services/materialService";
import { getSessions } from "@/services/sessionService";
import type { Session, SessionMaterial } from "@/types/api";

export const Route = createFileRoute("/historico")({ component: Historico });

const filters = [
  { id: "todas", label: "Todas" },
  { id: "prontas", label: "Prontas" },
  { id: "transcritas", label: "Transcritas" },
  { id: "falhas", label: "Falhas" },
  { id: "processando", label: "Processando" },
] as const;

type FilterId = (typeof filters)[number]["id"];

function statusLabel(session: Session) {
  const failure = session.failureReason ?? "";

  if (session.status === "READY") return "Sessão pronta";
  if (session.status === "TRANSCRIBED") return "Transcrição pronta";
  if (session.status === "FAILED" && /429|quota/i.test(failure)) return "Cota excedida";
  if (session.status === "FAILED" && /503|unavailable|high demand/i.test(failure)) {
    return "Alta demanda";
  }
  if (session.status === "FAILED") return "Falhou";
  if (session.status === "CREATED") return "Rascunho";
  return "Processando";
}

function statusVariant(session: Session): "done" | "failed" | "draft" | "processing" {
  if (session.status === "READY") return "done";
  if (session.status === "FAILED") return "failed";
  if (session.status === "CREATED") return "draft";
  return "processing";
}

function canRetry(session: Session) {
  return (
    session.status === "FAILED" ||
    session.status === "TRANSCRIBED" ||
    session.status === "AUDIO_UPLOADED"
  );
}

function sessionTarget(session: Session) {
  if (session.status === "READY" || session.hasMaterials) return "/resultado";
  if (canRetry(session)) return "/processando";
  return "/aula";
}

function isProcessing(session: Pick<Session, "status">) {
  return (
    session.status !== "READY" &&
    session.status !== "FAILED" &&
    session.status !== "TRANSCRIBED" &&
    session.status !== "CREATED"
  );
}

function metadataText(session: Session) {
  const metadata = session.metadata ?? {};
  const values = [
    metadata.theme,
    metadata.audience,
    metadata.level,
    metadata.objectives,
    metadata.context,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  return values.slice(0, 3).join(" · ");
}

function previewFromMaterials(materials: SessionMaterial[]) {
  const summary = materials.find((material) => material.type === "SUMMARY")?.content ?? "";
  const source = summary || materials.find((material) => material.content.trim())?.content || "";

  return source
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, "")
        .replace(/^#+\s*/, ""),
    )
    .filter(Boolean)
    .find((line) => line.length > 12)
    ?.slice(0, 180);
}

function Historico() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterId>("todas");
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [materialPreviews, setMaterialPreviews] = useState<Record<string, string>>({});
  const [previewsLoading, setPreviewsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
            : "API local indisponível. Inicie com npm run dev:api.",
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

  useEffect(() => {
    const sessionsWithMaterials = sessions.filter((session) => session.hasMaterials);
    if (!sessionsWithMaterials.length) {
      setMaterialPreviews({});
      setPreviewsLoading(false);
      return;
    }

    let active = true;

    const loadPreviews = async () => {
      setPreviewsLoading(true);
      const entries = await Promise.all(
        sessionsWithMaterials.map(async (session) => {
          try {
            const response = await getSessionMaterials(session.id);
            return [session.id, previewFromMaterials(response.data) ?? ""] as const;
          } catch {
            return [session.id, ""] as const;
          }
        }),
      );

      if (!active) return;
      setMaterialPreviews(Object.fromEntries(entries.filter(([, preview]) => preview)));
      setPreviewsLoading(false);
    };

    void loadPreviews();
    return () => {
      active = false;
    };
  }, [sessions]);

  const stats = useMemo(
    () => ({
      total: sessions.length,
      ready: sessions.filter((session) => session.status === "READY").length,
      failed: sessions.filter((session) => session.status === "FAILED").length,
      actionNeeded: sessions.filter(canRetry).length,
    }),
    [sessions],
  );

  const filterCounts = useMemo(
    () => ({
      todas: sessions.length,
      prontas: sessions.filter((session) => session.status === "READY").length,
      transcritas: sessions.filter((session) => session.status === "TRANSCRIBED").length,
      falhas: sessions.filter((session) => session.status === "FAILED").length,
      processando: sessions.filter(isProcessing).length,
    }),
    [sessions],
  );

  const list = useMemo(() => {
    const mapped = sessions.map((session) => {
      const meta = metadataText(session);
      const preview = materialPreviews[session.id] || "";
      const subject = getSessionTypeLabel(session.type);

      return {
        id: session.id,
        title: session.title,
        subject,
        className: session.language,
        date: formatSessionDate(session.createdAt),
        duration: formatSessionUpdatedLabel(session.updatedAt),
        status: session.status,
        label: statusLabel(session),
        variant: statusVariant(session),
        retry: canRetry(session),
        target: sessionTarget(session),
        materials: Boolean(session.hasMaterials),
        hasTranscript: Boolean(session.hasTranscript),
        audioCount: session.audioCount ?? 0,
        failureReason: session.failureReason,
        meta,
        preview,
        searchText: [
          session.title,
          subject,
          session.language,
          session.status,
          session.failureReason,
          meta,
          preview,
        ]
          .filter(Boolean)
          .join(" "),
      };
    });

    let arr = [...mapped];
    if (filter === "prontas") arr = arr.filter((item) => item.status === "READY");
    if (filter === "transcritas") arr = arr.filter((item) => item.status === "TRANSCRIBED");
    if (filter === "falhas") arr = arr.filter((item) => item.status === "FAILED");
    if (filter === "processando") arr = arr.filter((item) => isProcessing(item));

    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter((item) => item.searchText.toLowerCase().includes(q));
    }

    return arr;
  }, [filter, materialPreviews, query, sessions]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/painel" label="Início" />
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Biblioteca
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Histórico de sessões
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Encontre aulas, mentorias e reuniões por status, tema, participante ou conteúdo gerado.
          </p>
        </div>
        <Link
          to="/nova-aula"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-xl bg-gradient-brand px-4 text-sm font-medium text-white shadow-glow transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> Nova aula
        </Link>
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Total
            </span>
            <Layers3 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-semibold">{stats.total}</div>
          <div className="mt-1 text-xs text-muted-foreground">sessões na biblioteca</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Prontas
            </span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-semibold">{stats.ready}</div>
          <div className="mt-1 text-xs text-muted-foreground">com materiais gerados</div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Atenção
            </span>
            <Clock3 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-semibold">{stats.actionNeeded}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            podem continuar ou tentar novamente
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Falhas
            </span>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-2xl font-semibold">{stats.failed}</div>
          <div className="mt-1 text-xs text-muted-foreground">com erro de transcrição ou IA</div>
        </article>
      </section>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition focus-within:ring-2 focus-within:ring-ring/40">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, tema, status, conteúdo..."
            className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {filters.map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "inline-flex h-10 items-center rounded-xl border px-3 text-xs whitespace-nowrap transition",
                  active
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span className="ml-1 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px]">
                  {filterCounts[item.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sessões...
        </div>
      ) : null}

      {!loading && previewsLoading ? (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Buscando prévias dos materiais...
        </div>
      ) : null}

      {!loading && list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">Nenhuma sessão encontrada</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Ajuste busca/filtros ou comece uma nova aula.
          </div>
        </div>
      ) : null}

      {!loading && list.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((item) => (
            <article
              key={item.id}
              className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <Link
                  to={item.target}
                  search={{ sessionId: item.id } as never}
                  className="min-w-0 flex-1"
                >
                  <div className="truncate text-base font-semibold transition group-hover:text-primary">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.subject} · {item.date} · {item.duration}
                  </div>
                </Link>
                <StatusBadge variant={item.variant} label={item.label} />
              </div>

              <Link to={item.target} search={{ sessionId: item.id } as never} className="block">
                <p className="min-h-10 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                  {item.preview ||
                    item.meta ||
                    (item.failureReason
                      ? "Esta sessão precisa de atenção antes de gerar materiais."
                      : "Sem resumo gerado ainda. Continue o processamento para criar materiais.")}
                </p>
              </Link>

              {item.failureReason ? (
                <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] text-destructive line-clamp-2">
                  {item.failureReason}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {item.className}
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {item.audioCount} áudio(s)
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {item.hasTranscript ? "Transcrição" : "Sem transcrição"}
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5">
                  {item.materials ? "Materiais" : "Sem materiais"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                {item.retry ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: "/processando", search: { sessionId: item.id } as never })
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {item.status === "CREATED"
                      ? "Rascunho"
                      : item.materials
                        ? "Pronta para consulta"
                        : "Acompanhar sessão"}
                  </span>
                )}
                <Link
                  to={item.target}
                  search={{ sessionId: item.id } as never}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-95"
                >
                  Abrir
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
