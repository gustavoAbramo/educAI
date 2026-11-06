import { useEffect } from "react";

// Widget oficial do governo federal (VLibras) que traduz o texto da tela para
// Libras com um avatar. So e carregado quando a pessoa ativa a opcao.
const scriptSrc = "https://vlibras.gov.br/app/vlibras-plugin.js";

declare global {
  interface Window {
    VLibras?: { Widget: new (url: string) => unknown };
    educaiVLibrasStarted?: boolean;
  }
}

export function VLibrasWidget() {
  useEffect(() => {
    const start = () => {
      if (!window.VLibras || window.educaiVLibrasStarted) return;
      new window.VLibras.Widget("https://vlibras.gov.br/app");
      window.educaiVLibrasStarted = true;
      // O plugin se inicializa no "load"; quando o script chega depois disso,
      // repetimos o evento para ele montar o avatar.
      if (document.readyState === "complete") window.dispatchEvent(new Event("load"));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    if (existing) {
      start();
      return () => {
        window.educaiVLibrasStarted = false;
      };
    }
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = start;
    document.body.appendChild(script);
    return () => {
      // Permite montar o avatar de novo se a pessoa reativar a opcao.
      window.educaiVLibrasStarted = false;
    };
  }, []);

  return (
    <div {...{ vw: "" }} className="enabled">
      <div {...{ "vw-access-button": "" }} className="active" />
      <div {...{ "vw-plugin-wrapper": "" }}>
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  );
}
