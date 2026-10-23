import { AudioLines, Loader2, Mic, Radio, Sparkles, Square, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AssistantVoiceState,
  LiveAssistantMode,
  LiveAssistantPrompt,
} from "@/lib/live-assistant";
import { liveAssistantModeLabel } from "@/lib/live-assistant";

export type AssistantExchange = {
  question: string;
  content: string;
  meta?: {
    source: "provider" | "local";
    domain: string;
    confidence: "high" | "medium" | "low";
    usedWebSearch: boolean;
    sourcesCount?: number;
  };
};

type Props = {
  mode: LiveAssistantMode;
  onModeChange: (mode: LiveAssistantMode) => void;
  prompts: LiveAssistantPrompt[];
  question: string;
  onQuestionChange: (value: string) => void;
  onAsk: (prompt: string) => void;
  answer: AssistantExchange | null;
  onDismissAnswer: () => void;
  topInsight?: string;
  recording: boolean;
  voiceMode: boolean;
  onVoiceModeChange: (on: boolean) => void;
  voiceState: AssistantVoiceState;
  voiceSupported: boolean;
  wakeWord: string;
  onStopSpeaking?: () => void;
  onSpeakLast?: () => void;
  className?: string;
};

const VOICE_HINT: Record<AssistantVoiceState, string> = {
  idle: "Modo voz",
  listening: "Ouvindo",
  thinking: "Pensando",
  speaking: "Falando",
};

function VoiceStateIcon({ state }: { state: AssistantVoiceState }) {
  if (state === "thinking") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (state === "speaking") return <Volume2 className="h-3.5 w-3.5" />;
  if (state === "listening") return <AudioLines className="h-3.5 w-3.5 animate-pulse" />;
  return <Mic className="h-3.5 w-3.5" />;
}

const DOMAIN_LABELS: Record<string, string> = {
  educai: "Aula",
  general: "Geral",
  technology: "Tecnologia",
  programming: "Programacao",
  ai: "IA",
  business: "Negocios",
  marketing: "Marketing",
  sales: "Vendas",
  entrepreneurship: "Empreendedorismo",
  education: "Educacao",
  study: "Estudo",
  language: "Linguagem",
  science: "Ciencias",
  history: "Historia",
  geography: "Geografia",
  mathematics: "Matematica",
  career: "Carreira",
  psychology: "Psicologia",
  health_basic: "Saude",
  legal_basic: "Juridico",
  productivity: "Produtividade",
  finance: "Financas",
  news: "Noticias",
  entertainment: "Entretenimento",
  gaming: "Games",
};

function sourceLabel(source: "provider" | "local") {
  return source === "provider" ? "IA geral" : "Base local";
}

function confidenceLabel(confidence: "high" | "medium" | "low") {
  if (confidence === "high") return "Alta confianca";
  if (confidence === "medium") return "Media confianca";
  return "Baixa confianca";
}

/** Renderiza o markdown leve das respostas (**titulo**, listas, citacao, passos). */
function AssistantAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="space-y-1">
        {bullets.map((item, index) => (
          <li key={index} className="flex gap-2 text-sm leading-6 text-foreground/90">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const titleMatch = line.match(/^\*\*(.+)\*\*$/);
    if (titleMatch) {
      flushBullets(`b-${index}`);
      blocks.push(
        <div
          key={`t-${index}`}
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {titleMatch[1]}
        </div>,
      );
      return;
    }

    if (/^[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*]\s+/, ""));
      return;
    }

    flushBullets(`b-${index}`);

    if (line.startsWith(">")) {
      blocks.push(
        <p
          key={`q-${index}`}
          className="border-l-2 border-primary/40 pl-3 text-sm font-medium leading-6 text-foreground"
        >
          {line.replace(/^>\s?/, "")}
        </p>,
      );
      return;
    }

    blocks.push(
      <p key={`p-${index}`} className="text-sm leading-6 text-foreground/90">
        {line}
      </p>,
    );
  });

  flushBullets("b-final");
  return <div className="space-y-2">{blocks}</div>;
}

export function ContextualAssistant({
  mode,
  onModeChange,
  prompts,
  question,
  onQuestionChange,
  onAsk,
  answer,
  onDismissAnswer,
  topInsight,
  recording,
  voiceMode,
  onVoiceModeChange,
  voiceState,
  voiceSupported,
  wakeWord,
  onStopSpeaking,
  onSpeakLast,
  className,
}: Props) {
  const questionTrimmed = question.trim();
  const submitQuestion = () => {
    if (!questionTrimmed) return;
    onAsk(questionTrimmed);
  };

  return (
    <section
      className={cn(
        "rounded-[1.8rem] border border-border/75 bg-card/72 p-3 shadow-card backdrop-blur-xl sm:p-4",
        className,
      )}
    >
      {/* Cabecalho: rotulo + modo + voz */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-[11px] font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Assistente
        </div>

        <div className="ml-1 inline-flex rounded-full border border-border/70 bg-background/75 p-0.5 shadow-soft">
          {(["student", "mentor"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] transition",
                mode === item
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {liveAssistantModeLabel(item)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {voiceState === "speaking" && onStopSpeaking ? (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 text-[11px] text-destructive transition hover:bg-destructive/20"
            >
              <Square className="h-3 w-3" fill="currentColor" />
              Parar
            </button>
          ) : null}
          <button
            type="button"
            role="switch"
            aria-checked={voiceMode}
            disabled={!voiceSupported}
            title={voiceSupported ? "Alternar modo voz" : "Modo voz indisponivel neste navegador"}
            onClick={() => onVoiceModeChange(!voiceMode)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-40",
              voiceMode
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
            aria-label="Alternar modo voz"
          >
            <VoiceStateIcon state={voiceMode ? voiceState : "idle"} />
            {voiceMode ? VOICE_HINT[voiceState] : "Modo voz"}
          </button>
        </div>
      </div>

      {/* Dica do modo voz */}
      {voiceMode ? (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          {recording ? (
            <>
              Mãos livres: diga{" "}
              <span className="font-medium text-foreground/90">“{wakeWord}, sua pergunta”</span> que
              eu respondo em voz alta.
            </>
          ) : (
            <>A ativação por voz (“{wakeWord}, …”) funciona durante a gravação.</>
          )}
        </p>
      ) : null}

      <form
        className="mt-3 rounded-xl border border-border bg-background p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submitQuestion();
        }}
      >
        <label
          htmlFor="assistant-question"
          className="text-[11px] font-medium text-muted-foreground"
        >
          Pergunta livre
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            id="assistant-question"
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              submitQuestion();
            }}
            rows={2}
            placeholder="Digite uma pergunta, por exemplo: explique backend de forma simples"
            className="min-h-16 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="submit"
            disabled={!questionTrimmed}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </form>

      {/* Resposta atual (transitoria) */}
      {answer ? (
        <div className="mt-3 rounded-[1.3rem] border border-border/75 bg-background/85 p-3 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] italic text-muted-foreground">“{answer.question}”</div>
            <div className="flex shrink-0 items-center gap-1">
              {voiceSupported && onSpeakLast ? (
                <button
                  type="button"
                  onClick={onSpeakLast}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Ouvir resposta"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onDismissAnswer}
                className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Dispensar resposta"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {answer.meta ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {sourceLabel(answer.meta.source)}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {DOMAIN_LABELS[answer.meta.domain] ?? answer.meta.domain}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {confidenceLabel(answer.meta.confidence)}
              </span>
              {answer.meta.usedWebSearch ? (
                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Busca web
                </span>
              ) : null}
              {answer.meta.sourcesCount ? (
                <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {answer.meta.sourcesCount} fonte{answer.meta.sourcesCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3">
            <AssistantAnswer text={answer.content} />
          </div>
        </div>
      ) : topInsight ? (
        <div className="mt-3 flex items-start gap-2 rounded-[1.2rem] border border-dashed border-border/80 bg-background/65 px-3 py-2 text-[12px] leading-5 text-muted-foreground">
          <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{topInsight}</span>
        </div>
      ) : null}

      {/* Sugestoes rapidas (botoes) */}
      {prompts.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => onAsk(prompt.prompt)}
              title={prompt.description}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/75 bg-background/85 px-3 py-1.5 text-[11px] text-foreground/80 shadow-soft transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              {prompt.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
