import { Link } from "@tanstack/react-router";
import { Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BackButton } from "@/components/back-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqSections, type FaqEntry } from "./faq";

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function matches(entry: FaqEntry, query: string) {
  return normalize(`${entry.question} ${entry.answer.join(" ")} ${entry.keywords ?? ""}`).includes(
    query,
  );
}

export function AjudaPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query.trim());

  const sections = useMemo(
    () =>
      faqSections
        .map((section) => ({
          ...section,
          entries: normalizedQuery
            ? section.entries.filter((entry) => matches(entry, normalizedQuery))
            : section.entries,
        }))
        .filter((section) => section.entries.length > 0),
    [normalizedQuery],
  );
  const resultCount = sections.reduce((total, section) => total + section.entries.length, 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/painel" label="Início" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ajuda</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Como gravar, configurar a IA e tirar o melhor do educAI.
      </p>

      <div className="mt-6 flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar na ajuda (ex.: microfone, PDF, senha)"
          aria-label="Buscar na ajuda"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
            className="grid h-6 w-6 place-items-center rounded-md hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {normalizedQuery ? (
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
          {resultCount
            ? `${resultCount} ${resultCount === 1 ? "resposta encontrada" : "respostas encontradas"}`
            : "Nada encontrado."}
        </p>
      ) : null}

      <div className="mt-6 space-y-6">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`faq-${section.id}`}>
            <h2
              id={`faq-${section.id}`}
              className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              {section.title}
            </h2>
            <Accordion
              type="multiple"
              // Com busca ativa, ja abre as respostas encontradas.
              key={normalizedQuery ? "busca" : "normal"}
              defaultValue={
                normalizedQuery ? section.entries.map((entry) => entry.question) : undefined
              }
              className="rounded-xl border border-border/60 bg-card px-4"
            >
              {section.entries.map((entry) => (
                <AccordionItem key={entry.question} value={entry.question}>
                  <AccordionTrigger className="text-left text-sm">
                    {entry.question}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {entry.answer.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {entry.link ? (
                        <Link
                          to={entry.link.to}
                          className="inline-block text-primary hover:underline"
                        >
                          {entry.link.label} →
                        </Link>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>

      <section className="mt-8 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Não achou o que procurava?</div>
          <p className="mt-1 text-sm text-muted-foreground">
            O assistente responde dúvidas sobre o educAI e sobre termos das suas aulas.
          </p>
        </div>
        <Link
          to="/assistente"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95"
        >
          <Sparkles className="h-4 w-4" />
          Perguntar ao assistente
        </Link>
      </section>
    </div>
  );
}
