import { useNavigate, getRouteApi } from "@tanstack/react-router";
import {
  Check,
  Loader2,
  FileText,
  ListTree,
  Network,
  Sparkles,
  MessageSquare,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/apiClient";
import { generateSessionMaterials } from "@/services/materialService";
import { getSessionById, getSessionOverview } from "@/services/sessionService";
import { getSessionStatus } from "@/services/statusService";
import { transcribeSession } from "@/services/transcriptService";
import type { Session, SessionProcessingStatus, SessionStatus } from "@/types/api";

const stages = [
  { icon: FileText, label: "Transcrevendo áudio" },
  { icon: ListTree, label: "Organizando os principais tópicos" },
  { icon: Sparkles, label: "Gerando resumo" },
  { icon: Network, label: "Montando mapa mental" },
  { icon: MessageSquare, label: "Preparando assistente da aula" },
];

// A etapa vem do status real, nao da porcentagem: antes, 45% durante a
// transcricao aparecia como "Gerando resumo". Todos os materiais saem de uma
// chamada so, entao a fase de materiais fica na primeira etapa dela.
function stageForStatus(status: SessionStatus) {
  if (status === "READY") return stages.length;
  if (status === "TRANSCRIBED" || status === "GENERATING_MATERIALS") return 1;
  return 0;
}

function errorCause(error: unknown) {
  if (!(error instanceof ApiClientError)) return undefined;
  if (!error.details || typeof error.details !== "object" || Array.isArray(error.details)) {
    return undefined;
  }

  const cause = (error.details as Record<string, unknown>).cause;
  return typeof cause === "string" && cause.trim() ? cause.trim() : undefined;
}

function providerLabel(message: string) {
  if (/openai/i.test(message)) return "OpenAI";
  if (/gemini/i.test(message)) return "Gemini";
  return "A IA";
}

function readableTranscriptionError(message: string) {
  const provider = providerLabel(message);

  if (/high demand|unavailable|503/i.test(message)) {
    return [
      `${provider} esta temporariamente indisponivel ou com alta demanda (503).`,
      "Tente novamente em alguns minutos ou troque para outro modelo com cota disponivel.",
    ].join(" ");
  }

  if (/quota|429/i.test(message)) {
    return [
      `A cota da sua chave do ${provider} acabou (429).`,
      "No plano gratuito ela volta no dia seguinte. Para continuar agora, troque o modelo",
      "(por exemplo, um Flash-Lite) ou a chave em Configurações e tente novamente.",
    ].join(" ");
  }

  return message;
}

const routeApi = getRouteApi("/processando");

export function Processando() {
  const navigate = useNavigate();
  const { sessionId } = routeApi.useSearch();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [status, setStatus] = useState<SessionProcessingStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [transcribeError, setTranscribeError] = useState("");
  const [materialsError, setMaterialsError] = useState("");
  const [processingAttempt, setProcessingAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const hasNavigated = useRef(false);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcribeRequested = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    const load = async () => {
      setSessionError("");

      try {
        const response = await getSessionById(sessionId);
        if (!active) return;
        setSession(response.data);
      } catch (error) {
        if (!active) return;
        setSessionError(
          error instanceof Error
            ? error.message
            : "API local indisponível. Inicie com npm run dev:api.",
        );
        setSession(null);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [sessionId, processingAttempt]);

  useEffect(() => {
    if (!sessionId) return;
    const requestKey = `${sessionId}:${processingAttempt}`;
    if (transcribeRequested.current === requestKey) return;

    transcribeRequested.current = requestKey;
    setTranscribeError("");
    setMaterialsError("");

    const start = async () => {
      try {
        const current = await getSessionOverview(sessionId);
        if (current.data.status.status === "READY") {
          setSession(current.data.session);
          setStatus(current.data.status);
          return;
        }

        // Se a transcricao ja existe (ex.: falhou so a geracao de materiais),
        // nao transcreve de novo: isso gastaria cota do provedor a toa.
        if (!current.data.transcriptId) {
          await transcribeSession(sessionId);
        }

        await generateSessionMaterials(sessionId);
        const overview = await getSessionOverview(sessionId);
        setSession(overview.data.session);
        setStatus(overview.data.status);
      } catch (error) {
        const message = errorCause(error) ?? (error instanceof Error ? error.message : "");
        const readable = readableTranscriptionError(message || "Falha ao processar a sessao.");

        if (error instanceof ApiClientError && error.code === "MATERIAL_GENERATION_FAILED") {
          setMaterialsError(readable);
          return;
        }

        setTranscribeError(readable);
      }
    };

    void start();
  }, [sessionId, processingAttempt]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const response = await getSessionStatus(sessionId);
        if (!active) return;
        setStatus(response.data);
        setStatusError("");

        if (["READY", "FAILED"].includes(response.data.status)) {
          if (timer) clearInterval(timer);
        }
      } catch (error) {
        if (!active) return;
        setStatusError(
          error instanceof Error
            ? error.message
            : "API local indisponível. Inicie com npm run dev:api.",
        );
      }
    };

    void poll();
    timer = setInterval(poll, 2000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [sessionId, processingAttempt]);

  useEffect(() => {
    if (!sessionId) return;
    if (status) return;
    if (step >= stages.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1100);
    return () => clearTimeout(t);
  }, [sessionId, step, status]);

  useEffect(() => {
    if (!status) return;
    if (hasNavigated.current) return;
    if (navigationTimer.current) return;
    if (status.status === "FAILED") return;
    if (!sessionId) return;

    if (status.status === "READY") {
      navigationTimer.current = setTimeout(() => {
        hasNavigated.current = true;
        navigationTimer.current = null;
        navigate({ to: "/resultado", search: { sessionId } as never });
      }, 600);
    }
  }, [status, navigate, sessionId]);

  useEffect(() => {
    return () => {
      if (navigationTimer.current) {
        clearTimeout(navigationTimer.current);
        navigationTimer.current = null;
      }
    };
  }, []);

  const rawProgress = status?.progress ?? Math.min(95, (step / stages.length) * 100);
  const progress = status?.status === "READY" ? 100 : Math.min(98, rawProgress);
  const statusFailure = status?.status === "FAILED" && status.error ? status.error : "";
  const displayTranscriptionError =
    transcribeError ||
    materialsError ||
    (statusFailure ? readableTranscriptionError(statusFailure) : "");
  // Quando falha, a etapa que falhou para de girar: a transcricao e a
  // primeira etapa; qualquer outra falha vem da geracao de materiais.
  const failed = Boolean(displayTranscriptionError) || status?.status === "FAILED";
  const failedAtTranscription =
    Boolean(transcribeError) || (!materialsError && /transcri/i.test(status?.currentStep ?? ""));
  const effectiveStep = failed
    ? failedAtTranscription
      ? 0
      : 1
    : status
      ? stageForStatus(status.status)
      : step;
  const statusMessage =
    status?.status === "READY"
      ? "Sessão pronta"
      : status?.status === "TRANSCRIBED"
        ? "Transcrição pronta"
        : undefined;

  const retryProcessing = () => {
    if (navigationTimer.current) {
      clearTimeout(navigationTimer.current);
      navigationTimer.current = null;
    }
    hasNavigated.current = false;
    transcribeRequested.current = null;
    setStep(0);
    setStatus(null);
    setTranscribeError("");
    setMaterialsError("");
    setProcessingAttempt((attempt) => attempt + 1);
  };

  const sessionTitle = session?.title ?? "Sessão em processamento";

  if (!sessionId) {
    return (
      <div className="min-h-full grid place-items-center px-4 py-10 animate-fade-in">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Nenhuma sessao selecionada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha uma sessao no historico ou crie uma nova gravacao para iniciar o processamento.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => navigate({ to: "/historico" })}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted"
            >
              Ver historico
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/nova-aula" })}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-95"
            >
              Criar sessao
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full grid place-items-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-gradient-brand grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Processando aula
            </div>
            <div className="text-lg font-semibold">{sessionTitle}</div>
          </div>
        </div>
        {sessionError ? <div className="mb-4 text-xs text-destructive">{sessionError}</div> : null}
        {statusError ? <div className="mb-4 text-xs text-destructive">{statusError}</div> : null}
        {displayTranscriptionError ? (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <div>{displayTranscriptionError}</div>
            <button
              type="button"
              onClick={retryProcessing}
              className="mt-2 rounded-lg border border-destructive/25 px-2.5 py-1 text-[11px] font-medium hover:bg-destructive/10 transition"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {/* Barra de progresso */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-1">
          <div
            className="h-full bg-gradient-brand rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-[10px] text-muted-foreground text-right mb-5 tabular-nums">
          {Math.round(progress)}%
        </div>
        {status ? (
          <div className="mb-4 text-[10px] text-muted-foreground">
            {statusMessage ? `${statusMessage} · ` : null}
            Status: {status.status} · {status.currentStep}
          </div>
        ) : null}

        {/* Estágios */}
        <ul className="space-y-2">
          {stages.map((s, i) => {
            const Icon = s.icon;
            const done = i < effectiveStep;
            const active = i === effectiveStep;
            return (
              <li
                key={s.label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                  active && "bg-primary/5 border border-primary/20",
                  done && "opacity-70",
                  !active && !done && "opacity-40",
                )}
              >
                <div className="h-7 w-7 grid place-items-center rounded-md bg-muted shrink-0">
                  {done ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : active && failed ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className={cn(active && "font-medium text-foreground")}>{s.label}</span>
                {done && (
                  <span className="ml-auto text-[10px] text-primary font-medium">Concluído</span>
                )}
                {active && failed && (
                  <span className="ml-auto text-[10px] text-destructive font-medium">Falhou</span>
                )}
                {active && !failed && (
                  <span className="ml-auto text-[10px] text-muted-foreground">em andamento…</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Áudio salvo localmente · processamento seguro
        </div>
      </div>
    </div>
  );
}
