import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";

export function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground"
    >
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-4 text-xl font-semibold tracking-tight outline-none"
        >
          Algo deu errado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente recarregar a tela. Se o problema continuar, volte para o início e abra a tela de
          novo.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </button>
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            <Home className="h-4 w-4" aria-hidden />
            Início
          </Link>
        </div>
      </div>
    </main>
  );
}
