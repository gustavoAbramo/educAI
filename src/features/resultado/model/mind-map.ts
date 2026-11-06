import type { SessionMaterial } from "@/types/api";
import { stripMarkdownMarker, markdownListItems } from "./materials";
import type { MindMapView } from "./types";

export const mindMapColors = ["#2563eb", "#f59e0b", "#16a34a", "#db2777", "#7c3aed", "#dc2626"];
export const mindMapTextLimit = 110;
export function compactText(text: string, limit = mindMapTextLimit) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;

  const sentence = normalized.match(/^.{24,}?[.!?](?=\s|$)/)?.[0]?.trim();
  const candidate = sentence && sentence.length <= limit ? sentence : normalized.slice(0, limit);
  return `${candidate.replace(/\s+\S*$/, "").trim()}...`;
}

export function splitDetailText(text: string, limit = 3) {
  return text
    .split(/(?<=[.!?])\s+|;\s+|\s+\|\s+/)
    .map((item) => compactText(stripMarkdownMarker(item), mindMapTextLimit))
    .filter(Boolean)
    .slice(0, limit);
}

export function splitTitleAndDetail(text: string) {
  const value = stripMarkdownMarker(text).replace(/\s+/g, " ").trim();
  if (!value) return { title: "", details: [] };

  const colon = value.match(/^(.{3,70}?):\s+(.+)$/);
  if (colon) {
    return {
      title: compactText(colon[1], 64),
      details: splitDetailText(colon[2]),
    };
  }

  const spacedDash = value.match(/^(.{3,70}?)\s[-\u2013\u2014]\s(.+)$/);
  if (spacedDash) {
    return {
      title: compactText(spacedDash[1], 64),
      details: splitDetailText(spacedDash[2]),
    };
  }

  if (value.length > 78) {
    const [firstSentence = value, ...rest] = value.split(/(?<=[.!?])\s+/);
    const title = firstSentence.length <= 78 ? firstSentence : value.slice(0, 64);
    const remaining = firstSentence.length <= 78 ? rest.join(" ") : value.slice(64);
    return {
      title: compactText(title, 64),
      details: splitDetailText(remaining || value),
    };
  }

  return { title: value, details: [] };
}

export function mindMapBranchFromText(
  text: string,
  index: number,
): MindMapView["branches"][number] {
  const parsed = splitTitleAndDetail(text);
  return {
    title: parsed.title || `Conceito ${index + 1}`,
    children: parsed.details.length ? [{ title: "Ideia-chave", children: parsed.details }] : [],
  };
}

export function normalizeMindMapBranch(
  branch: MindMapView["branches"][number],
  index: number,
): MindMapView["branches"][number] {
  const parsedBranch = splitTitleAndDetail(branch.title);
  const children = branch.children
    .map((child) => {
      const parsedChild = splitTitleAndDetail(child.title);
      const leaves = [
        ...parsedChild.details,
        ...child.children.flatMap((leaf) => splitDetailText(leaf, 1)),
      ].filter(Boolean);

      return {
        title: parsedChild.title || "Detalhe",
        children: leaves.slice(0, 3),
      };
    })
    .filter((child) => child.title || child.children.length)
    .slice(0, 4);

  if (parsedBranch.details.length) {
    children.unshift({ title: "Ideia-chave", children: parsedBranch.details.slice(0, 3) });
  }

  return {
    title: parsedBranch.title || `Conceito ${index + 1}`,
    children,
  };
}

export function looseMindMapItems(content: string) {
  const normalizedContent = content
    .replace(/^tema\s+central\s*:\s*/gim, "# ")
    .replace(/^ramifica[cç][oõ]es\s*:\s*/gim, "");
  const baseItems = markdownListItems(normalizedContent);
  const source = baseItems.length ? baseItems : [content.trim()].filter(Boolean);

  if (source.length !== 1 || source[0].length < 220) return source;

  return source[0]
    .split(
      /(?:^|\s)(?:bloco\s*\d+|conceito\s*\d+|ramo\s*\d+|conceito\s+de|exemplos?\s+citados?|pontos?\s+importantes?|pontos?\s+a\s+melhorar|linguagem\s+utilizada|\d+[.)])\s*[:.-]\s*/i,
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mindMapFromMaterial(title: string, material?: SessionMaterial): MindMapView {
  const content = material?.content.trim() ?? "";
  if (!content) {
    return {
      central: compactText(title, 72),
      branches: [],
    };
  }

  const lines = content.split(/\r?\n/);
  const heading = lines
    .map((line) => line.trim())
    .find((line) => line.startsWith("#"))
    ?.replace(/^#+\s*/, "");
  const branches: MindMapView["branches"] = [];
  let currentBranch: MindMapView["branches"][number] | null = null;
  let currentChild: MindMapView["branches"][number]["children"][number] | null = null;
  let listBranchesMode = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^#{2,}\s+/.test(line)) {
      currentBranch = { title: line.replace(/^#+\s*/, ""), children: [] };
      branches.push(currentBranch);
      currentChild = null;
      listBranchesMode = false;
      continue;
    }

    if (/^#\s+/.test(line)) continue;

    const listText = stripMarkdownMarker(line);
    if (/^\s{2,}[-*]\s+/.test(rawLine) && currentChild) {
      currentChild.children.push(listText);
      continue;
    }

    if (/^\s{2,}[-*]\s+/.test(rawLine) && currentBranch) {
      currentChild = { title: listText, children: [] };
      currentBranch.children.push(currentChild);
      continue;
    }

    if (/^[-*]\s+/.test(line) && !currentBranch) {
      currentBranch = { title: listText, children: [] };
      branches.push(currentBranch);
      currentChild = null;
      listBranchesMode = true;
      continue;
    }

    if (/^[-*]\s+/.test(line) && currentBranch && listBranchesMode) {
      currentBranch = { title: listText, children: [] };
      branches.push(currentBranch);
      currentChild = null;
      continue;
    }

    if (/^[-*]\s+/.test(line) && currentBranch) {
      currentChild = { title: listText, children: [] };
      currentBranch.children.push(currentChild);
    }
  }

  const fallbackBranches =
    branches.length > 0
      ? branches
      : looseMindMapItems(content).map((item, index) => mindMapBranchFromText(item, index));
  const normalizedBranches = fallbackBranches
    .map((branch, index) => normalizeMindMapBranch(branch, index))
    .filter((branch) => branch.title)
    .slice(0, 8);

  return {
    central: compactText(heading || title, 72),
    branches: normalizedBranches
      .map((branch, index) => normalizeMindMapBranch(branch, index))
      .filter((branch) => branch.title)
      .slice(0, 8),
  };
}
