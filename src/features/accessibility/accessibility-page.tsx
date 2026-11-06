import { Accessibility, Keyboard, RotateCcw } from "lucide-react";
import { useId, type ReactNode } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import {
  type AccessibilityPrefs,
  type ColorFilter,
  type LineSpacing,
  fontScales,
} from "@/lib/accessibility";
import { cn } from "@/lib/utils";
import { ReadAloudSection } from "./read-aloud-section";
import { SwitchRow } from "./switch-row";
import { useAccessibilityPrefs } from "./use-accessibility-prefs";

type TogglePref = keyof Pick<
  AccessibilityPrefs,
  | "highContrast"
  | "reduceMotion"
  | "readableFont"
  | "underlineLinks"
  | "strongFocus"
  | "bigCursor"
  | "readingGuide"
  | "libras"
>;

const visualToggles: { key: TogglePref; label: string; description: string }[] = [
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
    key: "underlineLinks",
    label: "Sublinhar links",
    description: "Deixa os links visíveis sem depender só da cor.",
  },
  {
    key: "bigCursor",
    label: "Cursor grande",
    description: "Ponteiro do mouse maior e com contorno, mais fácil de encontrar.",
  },
];

const readingToggles: { key: TogglePref; label: string; description: string }[] = [
  {
    key: "readableFont",
    label: "Fonte de leitura fácil",
    description: "Letras e palavras mais espaçadas, útil para dislexia.",
  },
  {
    key: "readingGuide",
    label: "Guia de leitura",
    description: "Uma faixa acompanha o mouse e escurece o resto da tela.",
  },
];

const navigationToggles: { key: TogglePref; label: string; description: string }[] = [
  {
    key: "strongFocus",
    label: "Foco reforçado",
    description: "Contorno grosso no elemento ativo ao navegar pelo teclado.",
  },
  {
    key: "libras",
    label: "Tradução em Libras",
    description:
      "Ativa o VLibras, do Governo Federal: um avatar traduz para Libras o texto que você selecionar.",
  },
];

const lineSpacings: { value: LineSpacing; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "relaxed", label: "Amplo" },
  { value: "loose", label: "Muito amplo" },
];

const colorFilters: { value: ColorFilter; label: string }[] = [
  { value: "none", label: "Cores originais" },
  { value: "grayscale", label: "Tons de cinza" },
  { value: "low-saturation", label: "Cores suaves" },
  { value: "high-saturation", label: "Cores vivas" },
];

const shortcuts: { keys: string[]; action: string }[] = [
  { keys: ["Tab"], action: "Ir para o próximo elemento" },
  { keys: ["Shift", "Tab"], action: "Voltar ao elemento anterior" },
  { keys: ["Ctrl", "K"], action: "Buscar telas do educAI" },
  { keys: ["Alt", "Shift", "A"], action: "Abrir o menu rápido de acessibilidade" },
  { keys: ["Esc"], action: "Fechar menus, diálogos e a busca" },
];

export function AccessibilityPage() {
  const { prefs, update, reset } = useAccessibilityPrefs();

  const restore = () => {
    reset();
    toast.success("Preferências de acessibilidade restauradas.");
  };

  const toggleRows = (items: typeof visualToggles) => (
    <ul className="mt-2 divide-y divide-border">
      {items.map((toggle) => (
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
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/painel" label="Início" />
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
            As preferências ficam salvas neste navegador e valem para todas as telas, inclusive o
            login. Você também pode abrir o menu rápido a qualquer momento com{" "}
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-xs">
              Alt + Shift + A
            </kbd>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={restore}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-soft transition hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Restaurar padrão
        </button>
      </div>

      <div className="grid gap-4">
        <Card title="Texto">
          <OptionGroup
            legend="Tamanho do texto"
            value={String(prefs.fontScale)}
            options={fontScales.map((scale) => ({ value: String(scale), label: `${scale}%` }))}
            onChange={(value) => update({ fontScale: Number(value) })}
          />
          <OptionGroup
            legend="Espaçamento entre linhas"
            value={prefs.lineSpacing}
            options={lineSpacings}
            onChange={(lineSpacing) => update({ lineSpacing })}
          />
          {toggleRows(readingToggles)}
        </Card>

        <Card title="Cores e visual">
          <OptionGroup
            legend="Filtro de cor"
            value={prefs.colorFilter}
            options={colorFilters}
            onChange={(colorFilter) => update({ colorFilter })}
          />
          {toggleRows(visualToggles)}
        </Card>

        <Card title="Navegação e Libras">{toggleRows(navigationToggles)}</Card>

        <ReadAloudSection
          rate={prefs.speechRate}
          onRateChange={(speechRate) => update({ speechRate })}
        />

        <Card title="Atalhos de teclado" icon={<Keyboard className="h-4 w-4" aria-hidden />}>
          <dl className="mt-2 divide-y divide-border">
            {shortcuts.map((shortcut) => (
              <div key={shortcut.action} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-sm">{shortcut.action}</dt>
                <dd className="flex shrink-0 gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs"
                    >
                      {key}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <h2 id={id} className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

// Grupo de opcoes com radios nativos: setas do teclado ja funcionam.
function OptionGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="mt-4">
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex h-10 min-w-16 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm transition",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                value === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
