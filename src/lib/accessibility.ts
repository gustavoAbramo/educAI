// Preferencias de acessibilidade do usuario. Ficam no localStorage e sao
// aplicadas como classes no <html>, para valerem em todas as telas.

export type AccessibilityPrefs = {
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  readableFont: boolean;
  underlineLinks: boolean;
  strongFocus: boolean;
  speechRate: number;
};

export const defaultAccessibilityPrefs: AccessibilityPrefs = {
  fontScale: 100,
  highContrast: false,
  reduceMotion: false,
  readableFont: false,
  underlineLinks: false,
  strongFocus: false,
  speechRate: 1,
};

const storageKey = "educai-accessibility";

const classByPref: Partial<Record<keyof AccessibilityPrefs, string>> = {
  highContrast: "a11y-high-contrast",
  reduceMotion: "a11y-reduce-motion",
  readableFont: "a11y-readable-font",
  underlineLinks: "a11y-underline-links",
  strongFocus: "a11y-strong-focus",
};

export function loadAccessibilityPrefs(): AccessibilityPrefs {
  if (typeof window === "undefined") return defaultAccessibilityPrefs;
  try {
    const saved = localStorage.getItem(storageKey);
    return saved
      ? { ...defaultAccessibilityPrefs, ...JSON.parse(saved) }
      : defaultAccessibilityPrefs;
  } catch {
    return defaultAccessibilityPrefs;
  }
}

export function saveAccessibilityPrefs(prefs: AccessibilityPrefs) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // Sem storage (aba privada, por exemplo): as preferencias valem so nesta sessao.
  }
}

export function applyAccessibilityPrefs(prefs: AccessibilityPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = prefs.fontScale === 100 ? "" : `${prefs.fontScale}%`;
  for (const [pref, className] of Object.entries(classByPref)) {
    root.classList.toggle(className, Boolean(prefs[pref as keyof AccessibilityPrefs]));
  }
}
