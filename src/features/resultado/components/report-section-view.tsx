import type { LucideIcon } from "lucide-react";
import type { TopicCard } from "../model/types";

export function ReportSectionView({
  title,
  eyebrow,
  cards,
  emptyText,
  icon: Icon,
}: {
  title: string;
  eyebrow: string;
  cards: TopicCard[];
  emptyText: string;
  icon: LucideIcon;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
      </div>

      {cards.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <article
              key={card.title}
              className="rounded-xl border border-border bg-card p-4 shadow-soft transition hover:border-primary/30 hover:shadow-card"
            >
              <div className="mb-3 text-sm font-semibold">{card.title}</div>
              {card.items.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {card.items.slice(0, 6).map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">Sem detalhes adicionais.</div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
    </section>
  );
}
