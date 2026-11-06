import { cn } from "@/lib/utils";
import {
  reportSectionsFromDocument,
  reportSectionTone,
  reportSectionVisual,
  reportSectionIntro,
} from "../model/report";

export function ReportDocumentView({ content, emptyText }: { content: string; emptyText: string }) {
  const sections = reportSectionsFromDocument(content);
  const leadingText = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#{1,6}\s+/.test(line) && !/^[-*]\s+/.test(line));

  if (!sections.length && !leadingText.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7">
      <div className="mx-auto max-w-4xl space-y-5">
        {leadingText.length ? (
          <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-3">
            {leadingText.slice(0, 3).map((text, index) => (
              <div
                key={`${text}-${index}`}
                className="rounded-xl border border-border/70 bg-card p-4"
              >
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {index === 0 ? "Panorama" : index === 1 ? "Sintese" : "Leitura"}
                </div>
                <p className="text-sm leading-6 text-foreground/90">{text}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4">
          {sections.map((section, index) => {
            const intro = reportSectionIntro(section.title, section.paragraphs);
            const tone = reportSectionTone(section.title);
            const visual = reportSectionVisual(section.title, index);
            const remainingParagraphs = section.paragraphs.slice(intro ? 1 : 0);
            return (
              <section
                key={`${section.title}-${index}`}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-background shadow-[0_1px_0_rgba(0,0,0,0.02)]",
                  visual.section,
                )}
              >
                <div
                  className={cn(
                    "flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5",
                    visual.header,
                  )}
                >
                  <div>
                    <div
                      className={cn(
                        "mb-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        visual.badge,
                      )}
                    >
                      {tone}
                    </div>
                    <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                      {section.title}
                    </h2>
                  </div>
                  <div className={cn("h-2 w-2 shrink-0 rounded-full", visual.dot)} />
                </div>

                <div className="space-y-4 px-4 py-4 sm:px-5">
                  {intro ? (
                    <p className="max-w-3xl text-[15px] leading-7 text-foreground/90">{intro}</p>
                  ) : null}

                  {remainingParagraphs.map((paragraph, paragraphIndex) => (
                    <p
                      key={`${section.title}-p-${paragraphIndex}`}
                      className="max-w-3xl text-[15px] leading-7 text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}

                  {section.bullets.length ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {section.bullets.map((bullet, bulletIndex) => (
                        <div
                          key={`${section.title}-b-${bulletIndex}`}
                          className={cn("flex gap-3 rounded-xl border px-3 py-3", visual.bullet)}
                        >
                          <span
                            className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", visual.dot)}
                          />
                          <span className="text-sm leading-6 text-foreground/90">{bullet}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </article>
  );
}
