import type { SessionSignalInsightItem } from "@/lib/session-signals";
import { cn } from "@/lib/utils";
import { metricPercent, metricBadgeClass } from "../model/metrics";

export function SignalInsightPanel({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: SessionSignalInsightItem[];
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    metricBadgeClass(item.score),
                  )}
                >
                  {metricPercent(item.score)}
                </span>
              </div>
              <div className="text-xs leading-6 text-muted-foreground">{item.detail}</div>
              <blockquote className="mt-2 border-l-2 border-primary/35 pl-3 text-xs leading-6 text-muted-foreground">
                {item.excerpt}
              </blockquote>
              {item.suggestedAction ? (
                <div className="mt-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-primary/90">
                  {item.suggestedAction}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="text-xs leading-6 text-muted-foreground">{emptyText}</div>
      )}
    </section>
  );
}
