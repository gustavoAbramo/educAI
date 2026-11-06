import type { SessionMaterial } from "@/types/api";
import { stripMarkdownMarker, markdownListItems } from "./materials";
import type { StudyQuestion } from "./types";

export function normalizeStudyDifficulty(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    normalized.includes("advanced") ||
    normalized.includes("avanc") ||
    normalized.includes("reflex")
  ) {
    return "Reflexiva";
  }
  if (normalized.includes("intermediate") || normalized.includes("medi")) return "Media";
  return "Facil";
}

export function parseInlineQuestion(
  text: string,
  fallbackDifficulty: string,
): StudyQuestion | undefined {
  const value = stripMarkdownMarker(text).trim();
  if (!value) return undefined;

  const match = value.match(
    /^(?:Pergunta:\s*)?(.+?)\s+Resposta:\s+(.+?)(?:\s+N[ií]vel:\s+(.+?))?(?:\s+Foco:\s+(.+))?$/i,
  );

  if (!match) {
    return {
      question: value,
      answer: "",
      difficulty: normalizeStudyDifficulty(fallbackDifficulty),
    };
  }

  return {
    question: match[1].trim(),
    answer: match[2].trim(),
    difficulty: normalizeStudyDifficulty(match[3] || fallbackDifficulty),
    focus: match[4]?.trim(),
  };
}

export function studyQuestionsFromMaterial(material?: SessionMaterial): StudyQuestion[] {
  const content = material?.content ?? "";
  if (!content.trim()) return [];

  const questions: StudyQuestion[] = [];
  let currentDifficulty = "Facil";
  let current: Partial<StudyQuestion> | null = null;

  const flush = () => {
    if (!current?.question) return;
    questions.push({
      question: current.question,
      answer: current.answer ?? "",
      difficulty: normalizeStudyDifficulty(current.difficulty ?? currentDifficulty),
      focus: current.focus,
      reviewTip: current.reviewTip,
    });
    current = null;
  };

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const group = line.match(/^##\s+(.+)$/);
    if (group) {
      flush();
      currentDifficulty = normalizeStudyDifficulty(group[1]);
      continue;
    }

    const headingQuestion = line.match(/^###\s+(?:\d+[.)]\s*)?(.+)$/);
    if (headingQuestion) {
      flush();
      current = {
        question: stripMarkdownMarker(headingQuestion[1]).trim(),
        difficulty: currentDifficulty,
      };
      continue;
    }

    const questionLine = line.match(/^Pergunta:\s*(.+)$/i);
    if (questionLine) {
      flush();
      current = { question: questionLine[1].trim(), difficulty: currentDifficulty };
      continue;
    }

    const answerLine = line.match(/^Resposta:\s*(.+)$/i);
    if (answerLine) {
      current ??= { question: "", difficulty: currentDifficulty };
      current.answer = [current.answer, answerLine[1].trim()].filter(Boolean).join(" ");
      continue;
    }

    const focusLine = line.match(/^Foco:\s*(.+)$/i);
    if (focusLine) {
      current ??= { question: "", difficulty: currentDifficulty };
      current.focus = focusLine[1].trim();
      continue;
    }

    const reviewTipLine = line.match(/^Como revisar:\s*(.+)$/i);
    if (reviewTipLine) {
      current ??= { question: "", difficulty: currentDifficulty };
      current.reviewTip = [current.reviewTip, reviewTipLine[1].trim()].filter(Boolean).join(" ");
      continue;
    }

    const levelLine = line.match(/^N[ií]vel:\s*(.+)$/i);
    if (levelLine) {
      current ??= { question: "", difficulty: currentDifficulty };
      current.difficulty = normalizeStudyDifficulty(levelLine[1]);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const parsed = parseInlineQuestion(line, currentDifficulty);
      if (parsed?.answer) {
        flush();
        questions.push(parsed);
      }
    }
  }

  flush();

  if (questions.length) return questions;

  return markdownListItems(content)
    .map((item) => parseInlineQuestion(item, currentDifficulty))
    .filter((item): item is StudyQuestion => Boolean(item?.question));
}

export function groupedStudyQuestions(questions: StudyQuestion[]) {
  const order = ["Facil", "Media", "Reflexiva"];
  return order
    .map((difficulty) => ({
      difficulty,
      questions: questions.filter((question) => question.difficulty === difficulty),
    }))
    .filter((group) => group.questions.length > 0);
}

export function studyQuestionVisual(difficulty: string, index: number) {
  const normalized = difficulty
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const fallback = [
    {
      section: "border-zinc-500/15 bg-zinc-500/5",
      dot: "bg-zinc-500",
      badge: "border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
      card: "border-zinc-500/15 bg-card hover:border-zinc-500/30",
      counter: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
      answer: "border-zinc-500/15 bg-zinc-500/5",
    },
    {
      section: "border-violet-500/15 bg-violet-500/5",
      dot: "bg-violet-500",
      badge: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      card: "border-violet-500/15 bg-card hover:border-violet-500/30",
      counter: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
      answer: "border-violet-500/15 bg-violet-500/5",
    },
  ];

  if (normalized.includes("fac")) {
    return {
      section: "border-emerald-500/15 bg-emerald-500/5",
      dot: "bg-emerald-500",
      badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      card: "border-emerald-500/15 bg-card hover:border-emerald-500/30",
      counter: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      answer: "border-emerald-500/15 bg-emerald-500/5",
    };
  }
  if (normalized.includes("medi")) {
    return {
      section: "border-amber-500/15 bg-amber-500/5",
      dot: "bg-amber-500",
      badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      card: "border-amber-500/15 bg-card hover:border-amber-500/30",
      counter: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      answer: "border-amber-500/15 bg-amber-500/5",
    };
  }
  if (normalized.includes("reflex")) {
    return {
      section: "border-violet-500/15 bg-violet-500/5",
      dot: "bg-violet-500",
      badge: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
      card: "border-violet-500/15 bg-card hover:border-violet-500/30",
      counter: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
      answer: "border-violet-500/15 bg-violet-500/5",
    };
  }

  return fallback[index % fallback.length] ?? fallback[0]!;
}
