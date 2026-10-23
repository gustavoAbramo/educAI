export type GeneratedMaterialType =
  | "SUMMARY"
  | "TOPICS"
  | "MIND_MAP"
  | "INSIGHTS"
  | "LESSON_DIAGNOSIS"
  | "ACTION_ITEMS"
  | "QUESTIONS"
  | "EXECUTIVE_HANDOFF"
  | "SUGGESTED_RESPONSES"
  | "COMMERCIAL_BRIEF";

export type GeneratedMaterialDefinition = {
  type: GeneratedMaterialType;
  shortLabel: string;
  title: string;
  requestedOutputAliases: string[];
};

export const generatedMaterialDefinitions: GeneratedMaterialDefinition[] = [
  {
    type: "SUMMARY",
    shortLabel: "Resumo",
    title: "Resumo",
    requestedOutputAliases: ["resumo", "summary"],
  },
  {
    type: "TOPICS",
    shortLabel: "Topicos",
    title: "Topicos",
    requestedOutputAliases: ["topicos", "topicos-chave", "topic", "topics"],
  },
  {
    type: "INSIGHTS",
    shortLabel: "Relatorio",
    title: "Relatorio tecnico",
    requestedOutputAliases: [
      "insights",
      "relatorio",
      "relatorio tecnico",
      "tecnico",
      "technical",
      "report",
    ],
  },
  {
    type: "LESSON_DIAGNOSIS",
    shortLabel: "Diagnostico",
    title: "Diagnostico da aula",
    requestedOutputAliases: [
      "diagnostico",
      "diagnostico da aula",
      "lesson diagnosis",
      "pain points",
      "objections",
      "opportunities",
      "action summary",
    ],
  },
  {
    type: "ACTION_ITEMS",
    shortLabel: "Acoes",
    title: "Acoes",
    requestedOutputAliases: [
      "acao",
      "acoes",
      "atividade",
      "atividades",
      "proximo",
      "proximos passos",
      "action",
      "actions",
      "next step",
      "next steps",
    ],
  },
  {
    type: "QUESTIONS",
    shortLabel: "Perguntas",
    title: "Perguntas",
    requestedOutputAliases: [
      "pergunta",
      "perguntas",
      "resposta",
      "respostas",
      "question",
      "questions",
      "q&a",
    ],
  },
  {
    type: "EXECUTIVE_HANDOFF",
    shortLabel: "Handoff",
    title: "Handoff executivo",
    requestedOutputAliases: [
      "handoff",
      "executive handoff",
      "resumo executivo",
      "executive summary",
      "passagem",
      "passagem executiva",
      "handoff pos aula",
    ],
  },
  {
    type: "SUGGESTED_RESPONSES",
    shortLabel: "Respostas",
    title: "Respostas sugeridas",
    requestedOutputAliases: [
      "respostas sugeridas",
      "suggested responses",
      "guia de respostas",
      "response playbook",
      "resposta comercial",
      "respostas comerciais",
      "respostas prontas",
    ],
  },
  {
    type: "COMMERCIAL_BRIEF",
    shortLabel: "Comercial",
    title: "Brief comercial",
    requestedOutputAliases: [
      "insights comerciais",
      "brief comercial",
      "commercial brief",
      "crm brief",
      "oportunidades comerciais",
      "comercial",
      "oportunidade no crm",
    ],
  },
  {
    type: "MIND_MAP",
    shortLabel: "Mapa mental",
    title: "Mapa mental",
    requestedOutputAliases: ["mapa", "mind map", "mindmap"],
  },
];

export const generatedMaterialTypeOrder = generatedMaterialDefinitions.map((item) => item.type);

function normalizeOutputLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function generatedMaterialDefinitionFor(type: GeneratedMaterialType) {
  return generatedMaterialDefinitions.find((item) => item.type === type);
}

export function generatedMaterialLabel(type: GeneratedMaterialType) {
  return generatedMaterialDefinitionFor(type)?.shortLabel ?? type;
}

export function generatedMaterialTitle(type: GeneratedMaterialType) {
  return generatedMaterialDefinitionFor(type)?.title ?? type;
}

export function resolveGeneratedMaterialTypeFromOutput(output: string) {
  const normalized = normalizeOutputLabel(output);
  if (!normalized) return undefined;

  const matches = generatedMaterialDefinitions.flatMap((item) =>
    item.requestedOutputAliases
      .map((alias) => normalizeOutputLabel(alias))
      .filter((alias) => normalized === alias || normalized.includes(alias))
      .map((alias) => ({ type: item.type, alias })),
  );

  return matches.sort((a, b) => b.alias.length - a.alias.length)[0]?.type;
}
