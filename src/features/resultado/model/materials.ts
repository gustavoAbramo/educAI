import type {
  MaterialType,
  SessionMaterial,
  SessionOverviewResponse,
  SessionTranscript,
} from "@/types/api";
import { compactText } from "./mind-map";
import type { TopicCard } from "./types";

export function materialByType(materials: SessionMaterial[], type: MaterialType) {
  return materials.find((item) => item.type === type);
}

export function materialTimestamp(material?: SessionMaterial) {
  const raw = material?.updatedAt || material?.createdAt;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isTranscriptNewerThanMaterial(
  transcript: SessionTranscript | null,
  material?: SessionMaterial,
) {
  if (!transcript || !material) return false;
  const transcriptTime = Date.parse(transcript.updatedAt || transcript.createdAt);
  const materialTime = materialTimestamp(material);
  return (
    Number.isFinite(transcriptTime) && materialTime !== undefined && transcriptTime > materialTime
  );
}

export function stripMarkdownMarker(line: string) {
  return line
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[.)]\s+/, "");
}

export function markdownListItems(content: string) {
  return content
    .split(/\r?\n/)
    .map(stripMarkdownMarker)
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
}

export function markdownSections(content: string) {
  const sections: TopicCard[] = [];
  let current: TopicCard | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#{2,}\s+/.test(line)) {
      current = { title: line.replace(/^#+\s*/, ""), items: [] };
      sections.push(current);
      continue;
    }

    if (/^#\s+/.test(line)) continue;

    if (current) {
      current.items.push(stripMarkdownMarker(line));
    }
  }

  return sections
    .map((section) => ({
      title: section.title,
      items: section.items.filter(Boolean),
    }))
    .filter((section) => section.title || section.items.length);
}

export function topicCardsFromMaterial(material?: SessionMaterial): TopicCard[] {
  if (!material?.content.trim()) return [];

  const sections = markdownSections(material.content);
  if (sections.length) return sections;

  const items = markdownListItems(material.content);
  const source = items.length ? items : [material.content.trim()];

  return source.map((item) => {
    const [title, ...rest] = item.split(":");
    return {
      title: title.trim(),
      items: rest.length ? [rest.join(":").trim()].filter(Boolean) : [],
    };
  });
}

export function linesFromMarkdownPreview(content: string, limit = 5) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .map(stripMarkdownMarker)
    .filter(Boolean);

  return (lines.length ? lines : [content.trim()].filter(Boolean))
    .map((line) => compactText(line, 170))
    .slice(0, limit);
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function providerLabel(provider?: string) {
  if (!provider) return "Provider nao informado";
  if (/openai/i.test(provider)) return provider.replace(/^openai:/i, "OpenAI - ");
  if (/gemini/i.test(provider)) return provider.replace(/^gemini:/i, "Gemini - ");
  return provider;
}

export function materialProviderLabel(model?: string) {
  if (!model) return "Modelo de materiais nao informado";
  if (/openai/i.test(model)) return model.replace(/^openai:/i, "OpenAI · ");
  if (/gemini/i.test(model)) return model.replace(/^gemini:/i, "Gemini · ");
  if (/ollama/i.test(model)) {
    return model.replace(/^ollama:/i, "Ollama · ").replace(/:json-repaired$/i, " · JSON reparado");
  }
  return model;
}

export function wasMaterialJsonRepaired(overview: SessionOverviewResponse["data"] | null) {
  return Boolean(
    overview?.materialsJsonRepaired || /json-repaired/i.test(overview?.materialsModel ?? ""),
  );
}

export function latestMaterialUpdatedAt(materials: SessionMaterial[]) {
  return materials
    .map((material) => Date.parse(material.updatedAt || material.createdAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];
}

export function isTranscriptNewerThanMaterials(
  transcript: SessionTranscript | null,
  materials: SessionMaterial[],
) {
  if (!transcript || materials.length === 0) return false;
  const transcriptTime = Date.parse(transcript.updatedAt || transcript.createdAt);
  const materialTime = latestMaterialUpdatedAt(materials);
  return (
    Number.isFinite(transcriptTime) &&
    Number.isFinite(materialTime) &&
    transcriptTime > materialTime
  );
}

export function executiveHighlights(
  summaryText: string,
  topicCards: TopicCard[],
  actionItems: string[],
) {
  const summaryItems = linesFromMarkdownPreview(summaryText, 3);
  const topicItems = topicCards
    .slice(0, 3)
    .map((topic) => (topic.items[0] ? `${topic.title}: ${topic.items[0]}` : topic.title));
  const nextAction = actionItems[0] ? [`Proximo passo: ${actionItems[0]}`] : [];

  return [...summaryItems, ...topicItems, ...nextAction]
    .map((item) => compactText(item, 150))
    .filter(Boolean)
    .slice(0, 5);
}
