import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { BackButton } from "@/components/back-button";

export const Route = createFileRoute("/assistente")({ component: Assistente });

const bullets = [
  "Resumo do que já foi capturado pela transcrição viva.",
  "Perguntas rápidas com base nos trechos recentes.",
  "Leitura de termos técnicos, pontos importantes e linguagem.",
  "Modo aluno e modo mentor para mudar o tipo de análise.",
  "Modo voz mãos livres: diga “assistente, …” e ouça a resposta em voz alta.",
];

function Assistente() {
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/" label="Início" />
      </div>

      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          Assistente ao vivo
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          O painel agora vive dentro da aula
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A V2 trouxe o assistente lateral para acompanhar a transcrição em tempo real. Abra uma
          sessão de aula para usar o painel com contexto, prompts rápidos, histórico e o modo voz
          mãos livres.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Wand2 className="h-3.5 w-3.5 text-primary" />O que o painel faz
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {bullets.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-border bg-background p-4 text-sm text-foreground/90"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Onde usar</div>
          <div className="mt-2 text-lg font-semibold tracking-tight">Tela de aula</div>
          <p className="mt-2 text-sm text-muted-foreground">
            O assistente aparece ao lado da transcrição viva e reaproveita os trechos capturados
            para responder sem inventar conteúdo.
          </p>
          <div className="mt-4 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            Abra uma aula em andamento para ver o painel lateral com prompts, conversa, sinais
            rápidos e o modo voz.
          </div>
          <Link
            to="/nova-aula"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-4 h-10 text-sm font-medium text-white shadow-soft transition hover:opacity-95"
          >
            Criar sessao
            <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
