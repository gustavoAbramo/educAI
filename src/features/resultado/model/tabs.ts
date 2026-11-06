import { generatedMaterialLabel, type GeneratedMaterialType } from "@/lib/material-definitions";
import { repairTextArtifacts } from "@/lib/text-repair";
import {
  FileText,
  Sparkles,
  ListTree,
  Network,
  MessageSquare,
  FileQuestion,
  ListChecks,
  ClipboardList,
  Layers3,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Tab } from "./types";

export const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "resumo", label: "Resumo", icon: Sparkles },
  { id: "relatorio", label: "Relatorio", icon: ClipboardList },
  { id: "diagnostico", label: "Diagnostico", icon: Layers3 },
  { id: "handoff", label: "Handoff", icon: ClipboardList },
  { id: "respostas", label: "Respostas", icon: MessageSquare },
  { id: "comercial", label: "Comercial", icon: Users },
  { id: "topicos", label: "Topicos", icon: ListTree },
  { id: "mapa", label: "Mapa mental", icon: Network },
  { id: "perguntas", label: "Perguntas", icon: FileQuestion },
  { id: "acoes", label: "Acoes", icon: ListChecks },
  { id: "transcricao", label: "Transcricao", icon: FileText },
  { id: "chat", label: "Chat", icon: MessageSquare },
];

for (const tab of tabs) {
  tab.label = repairTextArtifacts(tab.label);
}

export const resultDeliverables: Array<{ type: GeneratedMaterialType; label: string; tab: Tab }> = [
  { type: "SUMMARY", label: generatedMaterialLabel("SUMMARY"), tab: "resumo" },
  { type: "INSIGHTS", label: generatedMaterialLabel("INSIGHTS"), tab: "relatorio" },
  {
    type: "LESSON_DIAGNOSIS",
    label: generatedMaterialLabel("LESSON_DIAGNOSIS"),
    tab: "diagnostico",
  },
  { type: "TOPICS", label: generatedMaterialLabel("TOPICS"), tab: "topicos" },
  { type: "MIND_MAP", label: generatedMaterialLabel("MIND_MAP"), tab: "mapa" },
  { type: "QUESTIONS", label: generatedMaterialLabel("QUESTIONS"), tab: "perguntas" },
  { type: "ACTION_ITEMS", label: generatedMaterialLabel("ACTION_ITEMS"), tab: "acoes" },
  { type: "EXECUTIVE_HANDOFF", label: generatedMaterialLabel("EXECUTIVE_HANDOFF"), tab: "handoff" },
  {
    type: "SUGGESTED_RESPONSES",
    label: generatedMaterialLabel("SUGGESTED_RESPONSES"),
    tab: "respostas",
  },
  { type: "COMMERCIAL_BRIEF", label: generatedMaterialLabel("COMMERCIAL_BRIEF"), tab: "comercial" },
];
