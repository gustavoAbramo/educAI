import { Link } from "@tanstack/react-router";
import { Accessibility, AArrowDown, AArrowUp, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fontScales, type AccessibilityPrefs } from "@/lib/accessibility";
import { useAccessibilityPrefs } from "./use-accessibility-prefs";

type QuickToggle = keyof Pick<
  AccessibilityPrefs,
  "highContrast" | "reduceMotion" | "readableFont" | "readingGuide" | "bigCursor" | "libras"
>;

const quickToggles: { key: QuickToggle; label: string }[] = [
  { key: "highContrast", label: "Alto contraste" },
  { key: "reduceMotion", label: "Reduzir animações" },
  { key: "readableFont", label: "Fonte de leitura fácil" },
  { key: "readingGuide", label: "Guia de leitura" },
  { key: "bigCursor", label: "Cursor grande" },
  { key: "libras", label: "Tradução em Libras (VLibras)" },
];

// Botao flutuante presente em todas as telas (inclusive login e pagina
// inicial). Atalho: Alt + Shift + A.
export function AccessibilityQuickMenu({ showFullPageLink }: { showFullPageLink: boolean }) {
  const { prefs, update, reset } = useAccessibilityPrefs();
  const [open, setOpen] = useState(false);
  const scaleIndex = Math.max(0, fontScales.indexOf(prefs.fontScale));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === "KeyA") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="fixed right-4 bottom-4 z-[65] grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label="Abrir opções de acessibilidade (Alt + Shift + A)"
        title="Acessibilidade (Alt + Shift + A)"
      >
        <Accessibility className="h-5 w-5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="z-[9999] w-80 rounded-2xl p-0"
        aria-label="Opções rápidas de acessibilidade"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Acessibilidade</h2>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Restaurar
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span id="quick-font-label" className="text-sm">
              Tamanho do texto
            </span>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-labelledby="quick-font-label"
            >
              <button
                type="button"
                onClick={() => update({ fontScale: fontScales[scaleIndex - 1] })}
                disabled={scaleIndex === 0}
                aria-label="Diminuir texto"
                className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
              >
                <AArrowDown className="h-4 w-4" aria-hidden />
              </button>
              <output className="w-12 text-center text-sm tabular-nums" aria-live="polite">
                {prefs.fontScale}%
              </output>
              <button
                type="button"
                onClick={() => update({ fontScale: fontScales[scaleIndex + 1] })}
                disabled={scaleIndex === fontScales.length - 1}
                aria-label="Aumentar texto"
                className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
              >
                <AArrowUp className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <ul className="mt-2">
            {quickToggles.map(({ key, label }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm">
                  {label}
                  <input
                    type="checkbox"
                    role="switch"
                    checked={prefs[key]}
                    onChange={(event) => update({ [key]: event.target.checked })}
                    className="a11y-switch"
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>

        {showFullPageLink ? (
          <div className="border-t border-border px-4 py-3">
            <Link
              to="/acessibilidade"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Mais opções de acessibilidade
            </Link>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
