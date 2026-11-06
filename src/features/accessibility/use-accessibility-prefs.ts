import { useCallback, useEffect, useState } from "react";
import {
  type AccessibilityPrefs,
  accessibilityChangeEvent,
  applyAccessibilityPrefs,
  defaultAccessibilityPrefs,
  loadAccessibilityPrefs,
  saveAccessibilityPrefs,
  storageKey,
} from "@/lib/accessibility";

// Estado compartilhado das preferencias: a tela de Acessibilidade, o menu
// rapido e os recursos globais (guia de leitura, Libras) ficam sincronizados,
// inclusive entre abas.
export function useAccessibilityPrefs() {
  const [prefs, setPrefs] = useState<AccessibilityPrefs>(defaultAccessibilityPrefs);

  useEffect(() => {
    setPrefs(loadAccessibilityPrefs());
    const onChange = (event: Event) => setPrefs((event as CustomEvent<AccessibilityPrefs>).detail);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      const next = loadAccessibilityPrefs();
      applyAccessibilityPrefs(next);
      setPrefs(next);
    };
    window.addEventListener(accessibilityChangeEvent, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(accessibilityChangeEvent, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<AccessibilityPrefs>) => {
    const next = { ...loadAccessibilityPrefs(), ...patch };
    applyAccessibilityPrefs(next);
    saveAccessibilityPrefs(next);
  }, []);

  const reset = useCallback(() => update(defaultAccessibilityPrefs), [update]);

  return { prefs, update, reset };
}
