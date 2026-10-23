import { cn } from "@/lib/utils";

type Variant = "recording" | "paused" | "processing" | "done" | "failed" | "draft" | "neutral";

const styles: Record<Variant, { dot: string; pill: string; label: string }> = {
  recording: {
    dot: "bg-recording animate-pulse-rec",
    pill: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Gravando",
  },
  paused: {
    dot: "bg-yellow-500",
    pill: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    label: "Pausada",
  },
  processing: {
    dot: "bg-secondary animate-pulse",
    pill: "bg-secondary/10 text-secondary border-secondary/20",
    label: "Processando",
  },
  done: {
    dot: "bg-primary",
    pill: "bg-primary/10 text-primary border-primary/20",
    label: "Concluída",
  },
  failed: {
    dot: "bg-destructive",
    pill: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Falhou",
  },
  draft: {
    dot: "bg-muted-foreground/60",
    pill: "bg-muted text-muted-foreground border-border",
    label: "Rascunho",
  },
  neutral: {
    dot: "bg-muted-foreground/60",
    pill: "bg-muted text-muted-foreground border-border",
    label: "",
  },
};

export function StatusBadge({
  variant,
  label,
  className,
  withDot = true,
}: {
  variant: Variant;
  label?: string;
  className?: string;
  withDot?: boolean;
}) {
  const s = styles[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        s.pill,
        className,
      )}
    >
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {label ?? s.label}
    </span>
  );
}
