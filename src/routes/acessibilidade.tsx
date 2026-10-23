import { createFileRoute } from "@tanstack/react-router";
import { Accessibility, Loader2, RotateCcw, Sparkles, Square, Volume2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import {
  type AccessibilityPrefs,
  applyAccessibilityPrefs,
  defaultAccessibilityPrefs,
  loadAccessibilityPrefs,
  saveAccessibilityPrefs,
} from "@/lib/accessibility";
import { cancelSpeak, isSpeechSynthesisSupported, speak, toSpeech } from "@/lib/speech";
import { askAssistant } from "@/services/assistantService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acessibilidade")({ component: Acessibilidade });

type TogglePref =
  | "highContrast"
  | "reduceMotion"
  | "readableFont"
  | "underlineLinks"
  | "strongFocus";

const toggles: { key: TogglePref; label: string; description: string }[] = [
  {
    key: "highContrast",
    label: "Alto contraste",
    description: "Cores mais fortes para textos, bordas e botões.",
  },
  {
    key: "reduceMotion",
    label: "Reduzir animações",
    description: "Desliga transições e efeitos de movimento.",
  },
  {
    key: "readableFont",
    label: "Fonte de leitura fácil",
    description: "Letras e linhas mais espaçadas, útil para dislexia.",
  },
  {
    key: "underlineLinks",
    label: "Sublinhar links",
    description: "Deixa os links visíveis sem depender só da cor.",
  },
  {
    key: "strongFocus",
    label: "Foco reforçado",
    description: "Contorno grosso no elemento ativo ao navegar pelo teclado.",
  },
];

const fontScales = [100, 112, 125, 150];

function Acessibilidade() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(defaultAccessibilityPrefs);

  useEffect(() => setPrefs(loadAccessibilityPrefs()), []);

  const update = (patch: Partial<AccessibilityPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      applyAccessibilityPrefs(next);
      saveAccessibilityPrefs(next);
      return next;
    });
  };

  const reset = () => {
    update(defaultAccessibilityPrefs);
    toast.success("Preferências de acessibilidade restauradas.");
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/" label="Início" />
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <Accessibility className="h-3 w-3 text-primary" aria-hidden />
            Acessibilidade
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Ajuste o educAI do seu jeito
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            As preferências ficam salvas neste navegador e valem para todas as telas.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Restaurar padrão
        </button>
      </div>

      <div className="grid gap-4">
        <section
          aria-labelledby="a11y-text"
          className="rounded-2xl border border-border bg-card p-5 shadow-soft"
        >
          <h2 id="a11y-text" className="text-sm font-semibold">
            Tamanho do texto
          </h2>
          <div role="radiogroup" aria-labelledby="a11y-text" className="mt-3 flex flex-wrap gap-2">
            {fontScales.map((scale) => (
              <button
                key={scale}
                role="radio"
                aria-checked={prefs.fontScale === scale}
                onClick={() => update({ fontScale: scale })}
                className={cn(
                  "h-10 min-w-16 rounded-lg border px-3 text-sm transition",
                  prefs.fontScale === scale
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {scale}%
              </button>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="a11y-visual"
          className="rounded-2xl border border-border bg-card p-5 shadow-soft"
        >
          <h2 id="a11y-visual" className="text-sm font-semibold">
            Visual e navegação
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {toggles.map((toggle) => (
              <li key={toggle.key}>
                <SwitchRow
                  label={toggle.label}
                  description={toggle.description}
                  checked={prefs[toggle.key]}
                  onChange={(checked) => update({ [toggle.key]: checked })}
                />
              </li>
            ))}
          </ul>
        </section>

        <ReadAloudSection
          rate={prefs.speechRate}
          onRateChange={(speechRate) => update({ speechRate })}
        />
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div id={id} className="text-sm font-medium">
          {label}
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition",
          checked ? "border-primary bg-primary" : "border-input bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function ReadAloudSection({
  rate,
  onRateChange,
}: {
  rate: number;
  onRateChange: (rate: number) => void;
}) {
  const [text, setText] = useState(
    "A fotossíntese é o processo pelo qual organismos clorofilados convertem energia luminosa em energia química, sintetizando glicose a partir de dióxido de carbono e água.",
  );
  const [simplified, setSimplified] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const ttsSupported = isSpeechSynthesisSupported();

  useEffect(() => cancelSpeak, []);

  const readAloud = (content: string) => {
    if (speaking) {
      cancelSpeak();
      setSpeaking(false);
      return;
    }
    speak(toSpeech(content), {
      rate,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  };

  // Exemplo minimo de IA: reaproveita o assistente que o app ja tem
  // (POST /api/v1/assistant/respond), que usa o provedor configurado.
  const simplify = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const response = await askAssistant({
        message: `Simplifique o texto abaixo para linguagem simples, com frases curtas e sem termos difíceis. Responda só com o texto simplificado.\n\n${text}`,
      });
      setSimplified(response.data.content);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível falar com a IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="a11y-reading"
      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <h2 id="a11y-reading" className="text-sm font-semibold">
        Leitura e linguagem simples
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cole um trecho da aula para ouvir em voz alta ou pedir à IA uma versão mais simples.
      </p>

      <label htmlFor="a11y-input" className="sr-only">
        Texto para ler ou simplificar
      </label>
      <textarea
        id="a11y-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        className="mt-3 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => readAloud(text)}
          disabled={!ttsSupported}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm transition hover:bg-muted disabled:opacity-50"
        >
          {speaking ? (
            <Square className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
          {speaking ? "Parar leitura" : "Ler em voz alta"}
        </button>
        <button
          onClick={simplify}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
          Simplificar com IA
        </button>

        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Velocidade da voz
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            value={rate}
            onChange={(event) => onRateChange(Number(event.target.value))}
            className="accent-[var(--primary)]"
          />
          <span className="w-8 tabular-nums">{rate.toFixed(1)}x</span>
        </label>
      </div>
      {!ttsSupported ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Este navegador não suporta leitura em voz alta.
        </p>
      ) : null}

      <div aria-live="polite">
        {simplified ? (
          <div className="mt-4 rounded-xl border border-primary/30 bg-accent/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
                Versão simplificada
              </h3>
              <button
                onClick={() => readAloud(simplified)}
                disabled={!ttsSupported}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Volume2 className="h-3.5 w-3.5" aria-hidden />
                Ouvir
              </button>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{simplified}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
