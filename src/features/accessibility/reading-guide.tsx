import { useEffect, useRef } from "react";

// Faixa horizontal que acompanha o ponteiro e escurece o resto da tela,
// ajudando a manter o foco na linha que esta sendo lida.
export function ReadingGuide() {
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      guideRef.current?.style.setProperty("--guide-y", `${event.clientY}px`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return <div ref={guideRef} className="a11y-reading-guide" aria-hidden="true" />;
}
