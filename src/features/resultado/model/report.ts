import type { TranscriptSegment } from "@/types/api";
import { stripMarkdownMarker, markdownSections } from "./materials";
import { compactText } from "./mind-map";
import { formatSegmentTime } from "./transcript";
import type { ReportEvidence, ReportSectionViewModel } from "./types";

export function reportSectionsFromDocument(content: string): ReportSectionViewModel[] {
  if (!content.trim()) return [];

  const sections: ReportSectionViewModel[] = [];
  let current: ReportSectionViewModel | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#{2,}\s+/.test(line)) {
      current = { title: line.replace(/^#+\s*/, ""), paragraphs: [], bullets: [] };
      sections.push(current);
      continue;
    }

    if (/^#\s+/.test(line)) continue;
    if (!current) continue;

    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      current.bullets.push(stripMarkdownMarker(line));
      continue;
    }

    current.paragraphs.push(line);
  }

  return sections.filter((section) => section.title);
}

export function reportSectionTone(title: string) {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("resumo")) return "Resumo";
  if (normalized.includes("ponto") && normalized.includes("importante")) return "Conteudo";
  if (normalized.includes("comunicacao")) return "Leitura";
  if (normalized.includes("linguagem") || normalized.includes("informal")) return "Linguagem";
  if (normalized.includes("melhor")) return "Melhoria";
  if (normalized.includes("positivo")) return "Forca";
  return "Analise";
}

export function reportSectionVisual(title: string, index: number) {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const fallback = [
    {
      section: "border-zinc-500/15",
      header: "border-zinc-500/15 bg-zinc-500/10",
      badge: "border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
      dot: "bg-zinc-500",
      bullet: "bg-zinc-500/10 border-zinc-500/15",
    },
    {
      section: "border-violet-500/15",
      header: "border-violet-500/15 bg-violet-500/10",
      badge: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      dot: "bg-violet-500",
      bullet: "bg-violet-500/10 border-violet-500/15",
    },
  ];

  if (normalized.includes("resumo")) {
    return {
      section: "border-zinc-500/15",
      header: "border-zinc-500/15 bg-zinc-500/10",
      badge: "border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
      dot: "bg-zinc-500",
      bullet: "bg-zinc-500/10 border-zinc-500/15",
    };
  }
  if (normalized.includes("comunicacao")) {
    return {
      section: "border-amber-500/15",
      header: "border-amber-500/15 bg-amber-500/10",
      badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
      bullet: "bg-amber-500/10 border-amber-500/15",
    };
  }
  if (normalized.includes("linguagem") || normalized.includes("informal")) {
    return {
      section: "border-rose-500/15",
      header: "border-rose-500/15 bg-rose-500/10",
      badge: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      dot: "bg-rose-500",
      bullet: "bg-rose-500/10 border-rose-500/15",
    };
  }
  if (normalized.includes("melhor")) {
    return {
      section: "border-orange-500/15",
      header: "border-orange-500/15 bg-orange-500/10",
      badge: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      dot: "bg-orange-500",
      bullet: "bg-orange-500/10 border-orange-500/15",
    };
  }
  if (normalized.includes("positivo")) {
    return {
      section: "border-emerald-500/15",
      header: "border-emerald-500/15 bg-emerald-500/10",
      badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
      bullet: "bg-emerald-500/10 border-emerald-500/15",
    };
  }

  return fallback[index % fallback.length] ?? fallback[0]!;
}

export function reportSectionIntro(title: string, paragraphs: string[]) {
  const lead = paragraphs[0] ?? "";
  if (!lead) return "";

  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("resumo")) return lead;
  if (normalized.includes("importante")) return lead;
  if (normalized.includes("comunicacao")) return lead;
  if (normalized.includes("linguagem")) return lead;
  if (normalized.includes("melhor")) return lead;
  if (normalized.includes("positivo")) return lead;
  return lead;
}

export const evidenceStopWords = new Set([
  "aula",
  "conversa",
  "pessoa",
  "sobre",
  "como",
  "para",
  "pela",
  "pelo",
  "porque",
  "quando",
  "onde",
  "mais",
  "menos",
  "muito",
  "pouco",
  "forma",
  "ponto",
  "pontos",
  "geral",
  "analise",
  "comunicacao",
  "melhorar",
  "positivo",
  "positivos",
  "importante",
  "importantes",
]);

export function evidenceKeywords(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !evidenceStopWords.has(word))
    .slice(0, 14);
}

export function reportEvidenceFromTranscript(
  reportText: string,
  segments: TranscriptSegment[],
): ReportEvidence[] {
  if (!reportText.trim() || !segments.length) return [];

  const sections = markdownSections(reportText).filter((section) => section.items.length > 0);
  const candidates = sections.flatMap((section) =>
    section.items.slice(0, 4).map((item) => ({
      section: section.title,
      claim: compactText(item, 130),
      keywords: evidenceKeywords(`${section.title} ${item}`),
    })),
  );
  const evidences: ReportEvidence[] = [];
  const usedSegments = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.keywords.length < 2) continue;

    const ranked = segments
      .map((segment) => {
        const text = segment.text
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        const matches = candidate.keywords.filter((keyword) => text.includes(keyword));
        return { segment, score: matches.length / candidate.keywords.length };
      })
      .filter((item) => item.score >= 0.16)
      .sort((a, b) => b.score - a.score);
    const best = ranked.find((item) => !usedSegments.has(item.segment.id)) ?? ranked[0];
    if (!best) continue;

    usedSegments.add(best.segment.id);
    evidences.push({
      section: candidate.section,
      claim: candidate.claim,
      speaker: best.segment.speaker || "Pessoa",
      time: `${formatSegmentTime(best.segment.startMs)} - ${formatSegmentTime(best.segment.endMs)}`,
      excerpt: compactText(best.segment.text, 170),
      score: best.score,
    });

    if (evidences.length >= 6) break;
  }

  return evidences.sort((a, b) => b.score - a.score);
}
