import { cn } from "@/lib/utils";

export function DeliverableBadge({
  label,
  present,
  stale,
  updatedAt,
  onClick,
}: {
  label: string;
  present: boolean;
  stale: boolean;
  updatedAt?: string;
  onClick: () => void;
}) {
  const tone = stale
    ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : present
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-border bg-background text-muted-foreground";

  const statusLabel = stale ? "Revisar" : present ? "Gerado" : "Pendente";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[150px] flex-col rounded-xl border border-border bg-background px-3 py-3 text-left transition hover:border-primary/35 hover:bg-card"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", tone)}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {updatedAt
          ? `Atualizado em ${new Date(updatedAt).toLocaleString("pt-BR")}`
          : "Ainda nao ha dado salvo para esta entrega."}
      </div>
    </button>
  );
}
