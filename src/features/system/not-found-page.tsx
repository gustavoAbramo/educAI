import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, History, Home, LayoutDashboard, Mic, SearchX } from "lucide-react";
import { useEffect, useRef } from "react";

const suggestions = [
  { to: "/painel", label: "Painel", detail: "Suas aulas e atalhos", icon: LayoutDashboard },
  { to: "/nova-aula", label: "Nova aula", detail: "Comece uma gravação", icon: Mic },
  { to: "/historico", label: "Histórico", detail: "Sessões anteriores", icon: History },
] as const;

export function NotFoundPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Leva o foco ao titulo para o leitor de tela anunciar o erro logo de cara.
    headingRef.current?.focus();
  }, []);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  };

  return (
    <main
      id="conteudo"
      className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground"
    >
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground">
            <SearchX className="h-5 w-5" aria-hidden />
          </span>
          <p className="font-mono text-sm tracking-widest text-muted-foreground">Erro 404</p>
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
        >
          Esta página não existe
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          O endereço{" "}
          <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
            {pathname}
          </code>{" "}
          não leva a nenhuma tela do educAI. Ele pode ter sido digitado errado ou a tela mudou de
          lugar.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar
          </button>
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Home className="h-4 w-4" aria-hidden />
            Página inicial
          </Link>
        </div>

        <nav aria-labelledby="not-found-suggestions" className="mt-10">
          <h2 id="not-found-suggestions" className="text-sm font-semibold">
            Talvez você procure
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {suggestions.map(({ to, label, detail, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
