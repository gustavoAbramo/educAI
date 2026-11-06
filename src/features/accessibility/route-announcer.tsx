import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { screenTitle } from "@/lib/route-access";

// Em apps de pagina unica o leitor de tela nao percebe a troca de tela.
// Este anunciador le o nome da nova tela e devolve o foco ao conteudo.
export function RouteAnnouncer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [message, setMessage] = useState("");
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const title = screenTitle(pathname) ?? document.title.split("|")[0]?.trim();
    setMessage(title ? `Tela: ${title}` : "Nova tela carregada");
    const main = document.getElementById("conteudo");
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
