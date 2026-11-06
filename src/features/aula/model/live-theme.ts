export const liveThemeStopWords = new Set([
  "a",
  "o",
  "de",
  "da",
  "do",
  "e",
  "para",
  "com",
  "sem",
  "que",
  "isso",
  "essa",
  "esse",
  "agora",
  "depois",
  "aula",
  "sessao",
  "reuniao",
]);

export function inferLiveThemeLabel(text: string, technicalTerms: string[] = []) {
  const normalizedTerms = technicalTerms.map((term) => term.trim()).filter(Boolean);
  if (normalizedTerms.length >= 2) return `${normalizedTerms[0]} - ${normalizedTerms[1]}`;
  if (normalizedTerms[0]) return normalizedTerms[0];

  const tokens = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !liveThemeStopWords.has(token));

  if (tokens.length >= 2) {
    return `${tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1)} - ${tokens[1]}`;
  }
  if (tokens[0]) return tokens[0].charAt(0).toUpperCase() + tokens[0].slice(1);
  return "Tema em aberto";
}
