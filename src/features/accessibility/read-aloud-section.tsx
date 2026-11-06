import { Loader2, Sparkles, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cancelSpeak, isSpeechSynthesisSupported, speak, toSpeech } from "@/lib/speech";
import { askAssistant } from "@/services/assistantService";

export function ReadAloudSection({
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
  // Detectado so no navegador: no servidor nao existe speechSynthesis e o
  // HTML renderizado precisa bater com o primeiro render do cliente.
  const [ttsSupported, setTtsSupported] = useState(true);

  useEffect(() => {
    setTtsSupported(isSpeechSynthesisSupported());
    return cancelSpeak;
  }, []);

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
