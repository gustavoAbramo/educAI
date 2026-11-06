import type { ProviderCatalogItem } from "@/lib/voice-intelligence";

export function StatusBadge({ item }: { item: ProviderCatalogItem }) {
  if (item.availability === "ready") {
    return (
      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        Pronto
      </span>
    );
  }

  if (item.availability === "development_only") {
    return (
      <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
        Desenvolvimento
      </span>
    );
  }

  if (item.availability === "coming_soon") {
    return (
      <span className="rounded-full border border-zinc-500/25 bg-zinc-500/10 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
        Planejado
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
      Falta configurar
    </span>
  );
}
