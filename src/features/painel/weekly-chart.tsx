import { useState } from "react";
import type { WeekBucket } from "@/lib/session-stats";

// Grafico de uma serie so (aulas por semana): sem legenda, o titulo ja diz o
// que e. Cada barra tem tooltip no hover/foco e ha uma tabela para leitor de tela.
export function WeeklyChart({ buckets }: { buckets: WeekBucket[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const height = 120;
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <figure className="m-0">
      <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
        {/* Linha de base e meio, bem discretas. */}
        <div className="absolute inset-x-0 bottom-0 border-t border-border" aria-hidden />
        <div
          className="absolute inset-x-0 border-t border-dashed border-border/50"
          style={{ bottom: height / 2 }}
          aria-hidden
        />
        <div className="absolute inset-0 flex items-end gap-[2px]" aria-hidden>
          {buckets.map((bucket, index) => {
            const barHeight = bucket.count ? Math.max(4, (bucket.count / max) * (height - 8)) : 0;
            const isActive = active === index;
            return (
              <div
                key={bucket.label}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setActive(index)}
              >
                <div
                  className="w-full max-w-7 rounded-t-[4px] bg-primary transition-opacity"
                  style={{ height: barHeight, opacity: active === null || isActive ? 1 : 0.45 }}
                />
                {isActive ? (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-soft">
                    <span className="font-medium">
                      {bucket.count} {bucket.count === 1 ? "aula" : "aulas"}
                    </span>{" "}
                    <span className="text-muted-foreground">semana de {bucket.label}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] text-[10px] text-muted-foreground" aria-hidden>
        {buckets.map((bucket, index) => (
          <div key={bucket.label} className="flex-1 text-center">
            {/* Rotulo em semanas alternadas, sempre incluindo a atual. */}
            {(buckets.length - 1 - index) % 2 === 0 ? bucket.label : ""}
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        Aulas criadas por semana nas últimas {buckets.length} semanas, total de {total}.
      </figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Semana que começa em</th>
            <th scope="col">Aulas</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.label}>
              <td>{bucket.label}</td>
              <td>{bucket.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
