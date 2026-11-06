import type { SessionMaterial } from "@/types/api";
import { stripMarkdownMarker } from "./materials";
import { compactText } from "./mind-map";
import type { ActionItemView } from "./types";

export function normalizeActionPriority(value?: string) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized.includes("HIGH")) return "Alta";
  if (normalized.includes("MEDIUM")) return "Media";
  if (normalized.includes("LOW")) return "Baixa";
  return value?.trim();
}

export function normalizeActionCategory(value?: string) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized.includes("CONTENT_REVIEW")) return "Revisao de conteudo";
  if (normalized.includes("COMMUNICATION")) return "Comunicacao";
  if (normalized.includes("EXERCISE")) return "Exercicio";
  if (normalized.includes("TECHNICAL_CORRECTION")) return "Ajuste tecnico";
  if (normalized.includes("NEXT_CLASS")) return "Proxima aula";
  return value?.trim();
}

export function parseActionItems(material?: SessionMaterial): ActionItemView[] {
  const content = material?.content ?? "";
  if (!content.trim()) return [];

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line, index) => {
      const body = stripMarkdownMarker(line);
      const match = body.match(
        /^(?:\[(?<tags>[^\]]+)\]\s*)?(?:(?<order>\d+)\.\s*)?(?<title>[^|]+?)(?:\s*\|\s*Responsavel:\s*(?<owner>[^|]+))?(?:\s*\|\s*Por que:\s*(?<reason>[^|]+))?(?:\s*\|\s*Criterio:\s*(?<criterion>.+))?$/i,
      );

      if (!match?.groups) {
        return {
          title: compactText(body, 120),
          raw: body,
          order: index + 1,
        };
      }

      const tags = (match.groups.tags ?? "")
        .split(/\s*\|\s*/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      const priority = normalizeActionPriority(tags.find((tag) => /HIGH|MEDIUM|LOW/i.test(tag)));
      const category = normalizeActionCategory(
        tags.find((tag) =>
          /CONTENT_REVIEW|COMMUNICATION|EXERCISE|TECHNICAL_CORRECTION|NEXT_CLASS/i.test(tag),
        ),
      );

      return {
        title: compactText((match.groups.title ?? body).replace(/^\d+\.\s*/, "").trim(), 120),
        priority,
        category,
        owner: compactText(match.groups.owner ?? "", 64) || undefined,
        reason: compactText(match.groups.reason ?? "", 140) || undefined,
        criterion: compactText(match.groups.criterion ?? "", 120) || undefined,
        order: Number(match.groups.order ?? index + 1),
        raw: body,
      };
    });
}

export function actionPriorityVisual(priority?: string) {
  if (priority === "Alta") {
    return {
      strip: "bg-rose-500",
      shell: "hover:border-rose-500/30",
      badge: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    };
  }
  if (priority === "Media") {
    return {
      strip: "bg-amber-500",
      shell: "hover:border-amber-500/30",
      badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }
  if (priority === "Baixa") {
    return {
      strip: "bg-emerald-500",
      shell: "hover:border-emerald-500/30",
      badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }

  return {
    strip: "bg-primary",
    shell: "hover:border-primary/40",
    badge: "border-primary/20 bg-primary/10 text-primary",
  };
}

export function actionItemsFromMaterial(material?: SessionMaterial): ActionItemView[] {
  const content = material?.content ?? "";
  if (!content.trim()) return [];

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line, index) => {
      const body = stripMarkdownMarker(line);
      const match = body.match(
        /^(?:\[(?<tags>[^\]]+)\]\s*)?(?:(?<order>\d+)\.\s*)?(?<title>[^|]+?)(?:\s*\|\s*Responsavel:\s*(?<owner>[^|]+))?(?:\s*\|\s*Por que:\s*(?<reason>[^|]+))?(?:\s*\|\s*Criterio:\s*(?<criterion>.+))?$/i,
      );

      if (!match?.groups) {
        return {
          title: compactText(body, 120),
          raw: body,
          order: index + 1,
        };
      }

      const tags = (match.groups.tags ?? "")
        .split(/\s*\|\s*/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      const priority = normalizeActionPriority(tags.find((tag) => /HIGH|MEDIUM|LOW/i.test(tag)));
      const category = normalizeActionCategory(
        tags.find((tag) =>
          /CONTENT_REVIEW|COMMUNICATION|EXERCISE|TECHNICAL_CORRECTION|NEXT_CLASS/i.test(tag),
        ),
      );

      return {
        title: compactText((match.groups.title ?? body).replace(/^\d+\.\s*/, "").trim(), 120),
        priority,
        category,
        owner: compactText(match.groups.owner ?? "", 64) || undefined,
        reason: compactText(match.groups.reason ?? "", 140) || undefined,
        criterion: compactText(match.groups.criterion ?? "", 120) || undefined,
        order: Number(match.groups.order ?? index + 1),
        raw: body,
      };
    });
}
