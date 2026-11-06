// Preferencias de acessibilidade do usuario. Ficam no localStorage e sao
// aplicadas como classes/atributos no <html>, para valerem em todas as telas
// (inclusive login, cadastro e pagina inicial).

export type LineSpacing = "normal" | "relaxed" | "loose";
export type ColorFilter = "none" | "grayscale" | "low-saturation" | "high-saturation";

export type AccessibilityPrefs = {
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
  readableFont: boolean;
  underlineLinks: boolean;
  strongFocus: boolean;
  bigCursor: boolean;
  readingGuide: boolean;
  libras: boolean;
  lineSpacing: LineSpacing;
  colorFilter: ColorFilter;
  speechRate: number;
};

export const defaultAccessibilityPrefs: AccessibilityPrefs = {
  fontScale: 100,
  highContrast: false,
  reduceMotion: false,
  readableFont: false,
  underlineLinks: false,
  strongFocus: false,
  bigCursor: false,
  readingGuide: false,
  libras: false,
  lineSpacing: "normal",
  colorFilter: "none",
  speechRate: 1,
};

export const fontScales = [100, 112, 125, 150, 175];

export const storageKey = "educai-accessibility";
export const accessibilityChangeEvent = "educai-accessibility-change";

const classByPref: Partial<Record<keyof AccessibilityPrefs, string>> = {
  highContrast: "a11y-high-contrast",
  reduceMotion: "a11y-reduce-motion",
  readableFont: "a11y-readable-font",
  underlineLinks: "a11y-underline-links",
  strongFocus: "a11y-strong-focus",
  bigCursor: "a11y-big-cursor",
};

function sanitize(saved: Partial<AccessibilityPrefs>): AccessibilityPrefs {
  const prefs = { ...defaultAccessibilityPrefs, ...saved };
  if (!fontScales.includes(prefs.fontScale)) prefs.fontScale = 100;
  if (!["normal", "relaxed", "loose"].includes(prefs.lineSpacing)) prefs.lineSpacing = "normal";
  if (!["none", "grayscale", "low-saturation", "high-saturation"].includes(prefs.colorFilter)) {
    prefs.colorFilter = "none";
  }
  return prefs;
}

export function loadAccessibilityPrefs(): AccessibilityPrefs {
  if (typeof window === "undefined") return defaultAccessibilityPrefs;
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? sanitize(JSON.parse(saved)) : defaultAccessibilityPrefs;
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
  window.dispatchEvent(new CustomEvent(accessibilityChangeEvent, { detail: prefs }));
}

export function applyAccessibilityPrefs(prefs: AccessibilityPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = prefs.fontScale === 100 ? "" : `${prefs.fontScale}%`;
  for (const [pref, className] of Object.entries(classByPref)) {
    root.classList.toggle(className, Boolean(prefs[pref as keyof AccessibilityPrefs]));
  }
  setDataAttribute(root, "a11yLineSpacing", prefs.lineSpacing, "normal");
  setDataAttribute(root, "a11yColorFilter", prefs.colorFilter, "none");
}

function setDataAttribute(root: HTMLElement, key: string, value: string, fallback: string) {
  if (value === fallback) delete root.dataset[key];
  else root.dataset[key] = value;
}

// Script que roda no <head> antes da pintura, para o tema e as preferencias
// valerem desde o primeiro quadro (sem "piscar" no tamanho de fonte ou contraste).
export const accessibilityBootScript = `(() => {
  try {
    var root = document.documentElement;
    if (localStorage.getItem("educai-theme") === "light") root.classList.remove("dark");
    var prefs = JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)}) || "{}");
    if (prefs.fontScale && prefs.fontScale !== 100) root.style.fontSize = prefs.fontScale + "%";
    var classes = ${JSON.stringify(classByPref)};
    for (var key in classes) if (prefs[key]) root.classList.add(classes[key]);
    if (prefs.lineSpacing && prefs.lineSpacing !== "normal") root.dataset.a11yLineSpacing = prefs.lineSpacing;
    if (prefs.colorFilter && prefs.colorFilter !== "none") root.dataset.a11yColorFilter = prefs.colorFilter;
  } catch (error) {}
})();`;
