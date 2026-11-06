import { extractTechnicalTerms } from "@/lib/technical-terms";
import { clamp01 } from "./audio-metrics";
import type { LiveTranscriptSegment } from "./types";

export function metricPercent(value: number) {
  return `${Math.round(clamp01(value) * 100)}%`;
}

export function metricBadgeClass(value: number) {
  const score = clamp01(value);
  if (score >= 0.75) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (score >= 0.55) {
    return "border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  }
  if (score >= 0.4) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function uniqueCompactValues(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

export function detectInformalLanguage(text: string) {
  const patterns: Array<[RegExp, string]> = [
    [/\bmano\b/gi, "Uso de 'mano', que pode soar informal demais."],
    [/\btipo assim\b/gi, "Uso de 'tipo assim', possivel vicio de linguagem."],
    [/\bne\b|\bné\b/gi, "Uso repetido de 'ne', que pode reduzir objetividade."],
    [/\btá\s+ligado\b|\bta\s+ligado\b/gi, "Uso de 'ta ligado', expressao informal."],
    [/\bentendeu\b/gi, "Uso de 'entendeu', que pode indicar checagem repetitiva."],
    [/\bmeio que\b/gi, "Uso de 'meio que', que pode enfraquecer seguranca na fala."],
    [/\bBasicamente\b/gi, "Uso de 'basicamente', acompanhar repeticao."],
  ];

  return patterns.filter(([pattern]) => pattern.test(text)).map(([, message]) => message);
}

export function repeatedWordIssues(text: string) {
  const matches = text.match(/\b(\p{L}{3,})(?:\s+\1\b){1,}/giu) ?? [];
  return matches.map((match) => `Possivel repeticao: "${match}".`);
}

export function importantPreviewPoints(segments: LiveTranscriptSegment[], interim: string) {
  const text = [...segments.map((segment) => segment.text), interim].join(" ");
  const sentences = text
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return uniqueCompactValues(
    sentences.filter((sentence) =>
      /\b(api|endpoint|webhook|frontend|front-end|backend|back-end|full\s*stack|objetivo|importante|precisa|exemplo|conceito|problema|solucao|melhorar|integracao|autenticacao|dados|plataforma|usuario|servidor|banco)\b/i.test(
        sentence,
      ),
    ),
    4,
  );
}

export function livePreviewInsights(segments: LiveTranscriptSegment[], interim: string) {
  const allText = [...segments.map((segment) => segment.text), interim].join(" ");
  const terms = uniqueCompactValues(
    [
      ...segments.flatMap((segment) => segment.technicalTerms ?? []),
      ...extractTechnicalTerms(interim),
    ],
    8,
  );
  const lowConfidenceCount = segments.filter(
    (segment) => typeof segment.confidence === "number" && segment.confidence < 0.65,
  ).length;
  const transcriptionIssues = uniqueCompactValues(
    [
      lowConfidenceCount
        ? `${lowConfidenceCount} trecho(s) com confianca baixa; vale revisar a transcricao final.`
        : "",
      interim.length > 140
        ? "Trecho atual ainda esta em captura; algumas palavras podem mudar ao finalizar."
        : "",
      ...repeatedWordIssues(allText),
    ],
    4,
  );
  const languageIssues = uniqueCompactValues(detectInformalLanguage(allText), 4);

  return {
    terms,
    transcriptionIssues,
    importantPoints: importantPreviewPoints(segments, interim),
    languageIssues,
  };
}
