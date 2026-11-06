import type { TranscriptSegment } from "@/types/api";
import { groupedStudyQuestions } from "./study-questions";
import { formatSegmentTime } from "./transcript";
import type { TopicCard, MindMapView, ReportEvidence } from "./types";

export function markdownHeading(level: 1 | 2 | 3, title: string) {
  return `${"#".repeat(level)} ${title}`;
}

export function markdownBulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function markdownEscape(value: string) {
  return value.replace(/\r?\n/g, " ").trim();
}

export function mindMapToMarkdown(mindMap: MindMapView) {
  if (!mindMap.branches.length) return "";

  const lines = [markdownHeading(1, mindMap.central)];

  for (const branch of mindMap.branches) {
    lines.push("", markdownHeading(2, branch.title));
    for (const child of branch.children) {
      lines.push(markdownHeading(3, child.title));
      if (child.children.length) {
        lines.push(markdownBulletList(child.children));
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

export function questionsToMarkdown(groups: ReturnType<typeof groupedStudyQuestions>) {
  if (!groups.length) return "";

  const lines = [markdownHeading(1, "Perguntas e respostas")];
  for (const group of groups) {
    lines.push("", markdownHeading(2, group.difficulty));
    for (const item of group.questions) {
      lines.push(markdownHeading(3, item.question));
      if (item.answer) lines.push(`Resposta: ${markdownEscape(item.answer)}`);
      if (item.focus) lines.push(`Foco: ${item.focus}`);
      if (item.reviewTip) lines.push(`Como revisar: ${item.reviewTip}`);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

export function actionItemsToMarkdown(items: string[]) {
  if (!items.length) return "";
  return [markdownHeading(1, "Acoes"), markdownBulletList(items)].join("\n\n").trim();
}

export function transcriptToMarkdown(segments: TranscriptSegment[]) {
  if (!segments.length) return "";

  const lines = [markdownHeading(1, "Transcricao")];
  for (const segment of segments) {
    lines.push(
      "",
      markdownHeading(
        2,
        `${segment.speaker || "Pessoa"} (${formatSegmentTime(segment.startMs)} - ${formatSegmentTime(segment.endMs)})`,
      ),
      markdownEscape(segment.text),
    );
  }
  return lines.join("\n").trim();
}

export function reportEvidenceToMarkdown(items: ReportEvidence[]) {
  if (!items.length) return "";

  const lines = [markdownHeading(1, "Evidencias na transcricao")];
  for (const item of items) {
    lines.push(
      "",
      markdownHeading(2, item.section),
      `Ponto: ${item.claim}`,
      `Trecho: ${item.speaker} | ${item.time}`,
      markdownEscape(item.excerpt),
    );
  }
  return lines.join("\n").trim();
}

export function buildMarkdownExport(args: {
  title: string;
  meta: string[];
  summaryText: string;
  reportText: string;
  diagnosisText: string;
  reportEvidence: ReportEvidence[];
  topicCards: TopicCard[];
  mindMap: MindMapView;
  studyQuestionGroups: ReturnType<typeof groupedStudyQuestions>;
  actionItems: string[];
  transcriptSegments: TranscriptSegment[];
}) {
  const topicLines = args.topicCards.length
    ? [
        markdownHeading(1, "Topicos"),
        ...args.topicCards.flatMap((topic) => [
          "",
          markdownHeading(2, topic.title),
          ...(topic.items.length ? [markdownBulletList(topic.items)] : []),
        ]),
      ].join("\n")
    : "";

  const sections = [
    markdownHeading(1, args.title),
    args.meta.length ? args.meta.map((line) => `- ${line}`).join("\n") : "",
    args.summaryText ? [markdownHeading(1, "Resumo"), args.summaryText].join("\n\n") : "",
    args.reportText ? [markdownHeading(1, "Relatorio"), args.reportText].join("\n\n") : "",
    args.diagnosisText
      ? [markdownHeading(1, "Diagnostico da aula"), args.diagnosisText].join("\n\n")
      : "",
    reportEvidenceToMarkdown(args.reportEvidence),
    topicLines,
    mindMapToMarkdown(args.mindMap),
    questionsToMarkdown(args.studyQuestionGroups),
    actionItemsToMarkdown(args.actionItems),
    transcriptToMarkdown(args.transcriptSegments),
  ]
    .filter((section) => section.trim().length > 0)
    .join("\n\n");

  return `${sections}\n`;
}
