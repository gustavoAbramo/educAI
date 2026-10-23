import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

// Guarda a versao dos termos que foi aceita: ao mudar os termos, troque a data aqui
// (e em routes/termos.tsx) para o aviso voltar a aparecer para todo mundo.
export const TERMS_VERSION = "2026-10-03";
const storageKey = "educai-termos-aceitos";

// Aviso que pede o aceite dos Termos de Uso e da Politica de Privacidade. Nao bloqueia a tela:
// "Aceitar" grava a escolha neste navegador; "Agora nao" so fecha ate a proxima visita.
export function ConsentBanner() {
  // Comeca fechado para o HTML do servidor e o do navegador serem iguais.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(
        localStorage.getItem(storageKey) !== TERMS_VERSION &&
          sessionStorage.getItem(storageKey) !== "adiado",
      );
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const close = (accepted: boolean) => {
    try {
      if (accepted) localStorage.setItem(storageKey, TERMS_VERSION);
      else sessionStorage.setItem(storageKey, "adiado");
    } catch {
      // Sem acesso ao armazenamento o aviso so fecha nesta tela.
    }
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-text"
      className="fixed inset-x-3 bottom-3 z-[70] rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-card animate-fade-in sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-sm"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 id="consent-title" className="text-sm font-semibold">
          Termos e privacidade
        </h2>
      </div>

      <p id="consent-text" className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
        O educAI grava e transcreve o áudio das suas sessões e guarda suas preferências neste
        navegador. Não usamos cookies de publicidade. Para continuar, leia e aceite os{" "}
        <Link to="/termos" className="font-medium text-foreground underline underline-offset-4">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link
          to="/termos"
          hash="privacidade"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Política de Privacidade
        </Link>
        .
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => close(true)}
          className="h-9 flex-1 rounded-lg bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Aceitar
        </button>
        <button
          onClick={() => close(false)}
          className="h-9 flex-1 rounded-lg border border-border px-4 text-[13px] font-medium transition-colors hover:bg-muted"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
