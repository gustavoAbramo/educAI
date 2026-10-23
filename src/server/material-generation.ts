import type { CallMaterials, MaterialItem, VoiceSession } from "@/lib/voice-intelligence";
import {
  generatedMaterialTitle,
  generatedMaterialTypeOrder,
  resolveGeneratedMaterialTypeFromOutput,
  type GeneratedMaterialType,
} from "@/lib/material-definitions";
import {
  buildSessionSignalIntelligence,
  sessionSignalSnapshotFromMetadata,
} from "@/lib/session-signals";
import { repairTextArtifacts } from "@/lib/text-repair";

type JsonObject = Record<string, unknown>;

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? repairTextArtifacts(value).trim() : "";
}

function arrayValues(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function objectText(value: unknown, fields: string[]) {
  const object = asObject(value);
  if (!object) return "";

  return fields.map((field) => cleanText(object[field])).find(Boolean) ?? "";
}

function textArray(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^[-*]\s+/, ""))
      .filter(Boolean);
  }

  return arrayValues(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();

      const title = objectText(item, ["title", "task", "question", "name"]);
      const detail = objectText(item, ["detail", "explanation", "answer", "reason", "summary"]);
      return [title, detail].filter(Boolean).join(": ");
    })
    .filter(Boolean);
}

function bulletList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function commaList(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function sentenceList(items: string[]) {
  const values = items.map((item) => item.trim()).filter(Boolean);
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

function isPortugueseLanguage(language: string) {
  return /^pt(?:[-_].+)?$/i.test(language.trim());
}

function polishPortugueseText(value: string) {
  let text = repairTextArtifacts(value).replace(/\s+/g, " ").trim();
  if (!text) return "";

  const replacements: Array<[RegExp, string]> = [
    [/\boque\b/gi, "o que"],
    [/\btambem\b/gi, "também"],
    [/\brelatorio\b/gi, "relatório"],
    [/\bvoce\b/gi, "você"],
    [/\bvoce(s)?\b/gi, "você$1"],
    [/\banalise\b/gi, "análise"],
    [/\bnivel\b/gi, "nível"],
    [/\btecnico\b/gi, "técnico"],
    [/\btecnica\b/gi, "técnica"],
    [/\bintegracao\b/gi, "integração"],
    [/\bautenticacao\b/gi, "autenticação"],
    [/\bconexao\b/gi, "conexão"],
    [/\brapido\b/gi, "rápido"],
    [/\brapida\b/gi, "rápida"],
    [/\bfacil\b/gi, "fácil"],
    [/\bgeralmente\b/gi, "geralmente"],
    [/\bfront\s*end\b/gi, "front-end"],
    [/\bback\s*end\b/gi, "back-end"],
    [/\bbanco\s+de\s+dados\b/gi, "banco de dados"],
    [/\bapis\b/gi, "APIs"],
    [/\bapi\b/gi, "API"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/([,.;:!?])(\S)/g, "$1 $2");
  text = text.replace(/\.(?=\p{L})/gu, ". ");
  text = text.replace(/\s{2,}/g, " ");

  text = repairTextArtifacts(text);
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function polishMarkdownLine(line: string, shouldPolish: boolean) {
  if (!shouldPolish || !line.trim()) return line;

  const trimmed = line.trim();
  if (/^#{1,6}\s+/.test(trimmed)) {
    const [marker, ...rest] = trimmed.split(/\s+/);
    return `${marker} ${polishPortugueseText(rest.join(" "))}`;
  }

  const bullet = line.match(/^(\s*)([-*]\s+|\d+[.)]\s+)(.+)$/);
  if (bullet) {
    return `${bullet[1]}${bullet[2]}${polishPortugueseText(bullet[3])}`;
  }

  return polishPortugueseText(trimmed);
}

function polishMarkdownText(text: string, shouldPolish: boolean) {
  if (!shouldPolish) return text;

  return text
    .split(/\r?\n/)
    .map((line) => polishMarkdownLine(line, shouldPolish))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function proseSection(title: string, body: string) {
  return [`## ${title}`, body.trim()].filter(Boolean).join("\n\n");
}

function proseParagraphs(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join("\n\n");
}

function requestedOutputs(session: VoiceSession) {
  const raw = session.metadata.outputsRequested ?? session.metadata.outputs;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function requestedMaterialTypes(session: VoiceSession) {
  const selected = new Set<GeneratedMaterialType>();

  for (const output of requestedOutputs(session)) {
    const type = resolveGeneratedMaterialTypeFromOutput(output);
    if (type) selected.add(type);
  }

  return selected.size > 0 ? selected : undefined;
}

function requestedOutputsText(session: VoiceSession) {
  const outputs = requestedOutputs(session);
  return outputs.length ? outputs.join(", ") : "not specified";
}

export function materialsPromptGuidelines(session: VoiceSession) {
  return [
    `Use this language for the final materials: ${session.language}.`,
    `Requested outputs: ${requestedOutputsText(session)}.`,
    "Ground every point in the transcript and the session context.",
    "Each generated material must have a distinct job and distinct content. Do not rewrite the same points under different labels.",
    "Summary is an executive synthesis; topics are conceptual organization; technicalReport is a professional analytical report; lessonDiagnosis turns the conversation into pain points, doubts, objections, opportunities, decisions, tasks, and response guidance; questions evaluate learning; actionItems are operational next steps; mindMap is visual hierarchy.",
    "Avoid generic classroom or meeting filler. Prefer concrete names, examples, decisions, doubts, definitions, language choices, terms, and follow-ups from the transcript.",
    "Use the audience, level, objectives, tone, and AI instructions to decide depth and wording.",
    "For technicalReport, write connected analytical prose. It must feel like a professional review of the lesson or conversation, not a generic automatic summary.",
    "For technicalReport, include these exact jobs: general understanding of the content, important points, communication analysis, language/informality issues, improvement points, and positive points.",
    "For technicalReport, explicitly identify slang, fillers, informal words, unclear phrases, and repeated expressions when they appear in the transcript. Examples: mano, tipo assim, ne, ta ligado, basicamente, entendeu. Explain whether each issue hurts the communication.",
    "For technicalReport, analyze clarity, organization of ideas, confidence, formality, correct use of terms, technical precision, and audience fit.",
    "For lessonDiagnosis, identify only signals clearly supported by the transcript: pains, recurring doubts, objections, opportunities, attention points, tasks, decisions, actionable summary, practical recommendations, and response guidance.",
    "For lessonDiagnosis, if the evidence is weak, say that the signal is insufficient instead of inventing pain points, opportunities, or sales intent.",
    "For lessonDiagnosis.responseGuidance, suggest practical replies grounded only in real transcript signals. Include recommendedResponse, reason, relatedSignal, confidence, tone, and nextQuestion when useful.",
    "For actionItems, create practical next steps after the recorded lesson. Include content review tasks, communication improvements, exercises/materials to create, and technical corrections when relevant. Every action must be concrete, observable, and useful for the next class or study session.",
    "For questions, create useful study questions directly tied to the lesson. Avoid obvious, repetitive, or generic questions. Include at least two BASIC comprehension questions, two INTERMEDIATE application questions, and two ADVANCED reflective/analytical questions when the transcript has enough material. Each answer must teach the concept, not merely confirm it.",
    "For questions, include questions about content and, when useful, communication quality: clarity, formal language, examples, terms, and organization of the explanation.",
    "For mindMap, create a real mind-map hierarchy, not a single block: one central theme, 5 to 7 separate main branches, 2 to 4 subtopics per branch, and short leaf details. Include content branches and communication branches when relevant.",
    "For mindMap, separate different concepts into different branches. Useful branch examples: Concept, Examples, Important points, Improvements, Language used, Tools, Decisions, Next steps.",
    "If the transcript does not contain enough evidence for a claim, say that the point needs confirmation instead of inventing details.",
    "Fill every JSON field. Keep requested outputs especially complete because the API may keep only those material types.",
  ].join("\n");
}

export function materialsJsonShape() {
  return {
    summary: {
      coreMessage: "one-sentence core message",
      overview: "short grounded executive synthesis",
      keyTakeaways: ["important takeaway grounded in transcript"],
      boundaries: "what the transcript did not prove or what needs confirmation",
    },
    topics: [
      {
        title: "topic title",
        explanation: "conceptual explanation",
        transcriptEvidence: "specific transcript detail or context used",
        whyItMatters: "why this topic matters",
        examples: ["related example or application"],
      },
    ],
    technicalReport: {
      generalSummary:
        "connected prose explaining what the AI understood from the lesson or conversation",
      importantPoints: ["main concept, idea, example, decision, or relevant subject mentioned"],
      communicationAnalysis:
        "connected prose evaluating clarity, organization, confidence, formality, and correct use of terms",
      languageAndInformalityIssues: [
        {
          expression: "slang, filler, informal expression, unclear phrase, or repeated expression",
          analysis: "why it matters and whether it harms communication",
        },
      ],
      improvementPoints: ["specific improvement for the next recording or lesson"],
      positivePoints: ["what was well done in content, explanation, examples, or delivery"],
    },
    lessonDiagnosis: {
      summary: "short actionable synthesis of what the AI understood from the conversation",
      painPoints: [
        {
          title: "pain or friction clearly mentioned",
          evidence: "specific transcript evidence",
          impact: "why it matters operationally or pedagogically",
        },
      ],
      recurringQuestions: [
        {
          question: "question or doubt that appeared more than once or stayed unresolved",
          evidence: "supporting excerpt or context",
          whyItMatters: "why this recurring doubt matters",
        },
      ],
      objections: [
        {
          objection: "real objection, hesitation, or resistance signal",
          evidence: "supporting transcript detail",
          implication: "what this objection may block",
        },
      ],
      opportunities: [
        {
          title: "practical opportunity observed in the conversation",
          evidence: "transcript signal",
          whyItMatters: "why this is an opportunity",
          nextStep: "best next step if evidence is strong enough",
        },
      ],
      attentionPoints: [
        {
          point: "risk, ambiguity, or fragile area that deserves follow-up",
          evidence: "supporting transcript detail",
          reason: "why the point deserves attention",
        },
      ],
      decisionsAndTasks: [
        {
          type: "DECISION | TASK",
          item: "decision or task statement",
          ownerOrAudience: "owner or affected audience",
          urgency: "HIGH | MEDIUM | LOW",
          evidence: "supporting transcript evidence",
        },
      ],
      actionableSummary: ["short action-oriented takeaway"],
      practicalRecommendations: ["practical recommendation grounded in the conversation"],
      responseGuidance: [
        {
          scenario: "pain | doubt | objection | opportunity | trust-building",
          relatedSignal: "the real signal behind the suggestion",
          recommendedResponse: "best reply the operator can use",
          reason: "why this response fits the context",
          confidence: "HIGH | MEDIUM | LOW",
          tone: "CONSULTIVO | DIRETO | ACOLHEDOR | TECNICO | COMERCIAL",
          nextQuestion: "best next question if useful",
        },
      ],
    },
    actionItems: [
      {
        task: "concrete follow-up",
        category: "CONTENT_REVIEW | COMMUNICATION | EXERCISE | TECHNICAL_CORRECTION | NEXT_CLASS",
        ownerOrAudience: "who should do it",
        priority: "HIGH | MEDIUM | LOW",
        reason: "why this task follows from the transcript",
        successCriterion: "how to know it was completed well",
      },
    ],
    questions: [
      {
        question: "specific study question grounded in the lesson",
        expectedAnswer: "clear complete answer, concise enough for review",
        difficulty: "BASIC | INTERMEDIATE | ADVANCED",
        skillTarget: "conceptual | practical | reflective skill or concept being evaluated",
        reviewTip: "how the learner should use this question to review or improve",
      },
    ],
    mindMap: {
      centralTheme: "short central theme",
      branches: [
        {
          title: "main branch title",
          children: [
            {
              title: "sub-branch title",
              children: ["leaf detail"],
            },
          ],
        },
      ],
    },
  };
}

export function materialsJsonSchema() {
  const stringArray = {
    type: "array",
    items: { type: "string" },
  };
  const objectSchema = (properties: JsonObject) => ({
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  });
  const arrayOfObjects = (properties: JsonObject) => ({
    type: "array",
    items: objectSchema(properties),
  });

  return objectSchema({
    summary: objectSchema({
      coreMessage: { type: "string" },
      overview: { type: "string" },
      keyTakeaways: stringArray,
      boundaries: { type: "string" },
    }),
    topics: arrayOfObjects({
      title: { type: "string" },
      explanation: { type: "string" },
      transcriptEvidence: { type: "string" },
      whyItMatters: { type: "string" },
      examples: stringArray,
    }),
    technicalReport: objectSchema({
      generalSummary: { type: "string" },
      importantPoints: stringArray,
      communicationAnalysis: { type: "string" },
      languageAndInformalityIssues: arrayOfObjects({
        expression: { type: "string" },
        analysis: { type: "string" },
      }),
      improvementPoints: stringArray,
      positivePoints: stringArray,
    }),
    lessonDiagnosis: objectSchema({
      summary: { type: "string" },
      painPoints: arrayOfObjects({
        title: { type: "string" },
        evidence: { type: "string" },
        impact: { type: "string" },
      }),
      recurringQuestions: arrayOfObjects({
        question: { type: "string" },
        evidence: { type: "string" },
        whyItMatters: { type: "string" },
      }),
      objections: arrayOfObjects({
        objection: { type: "string" },
        evidence: { type: "string" },
        implication: { type: "string" },
      }),
      opportunities: arrayOfObjects({
        title: { type: "string" },
        evidence: { type: "string" },
        whyItMatters: { type: "string" },
        nextStep: { type: "string" },
      }),
      attentionPoints: arrayOfObjects({
        point: { type: "string" },
        evidence: { type: "string" },
        reason: { type: "string" },
      }),
      decisionsAndTasks: arrayOfObjects({
        type: { type: "string", enum: ["DECISION", "TASK"] },
        item: { type: "string" },
        ownerOrAudience: { type: "string" },
        urgency: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        evidence: { type: "string" },
      }),
      actionableSummary: stringArray,
      practicalRecommendations: stringArray,
      responseGuidance: arrayOfObjects({
        scenario: { type: "string" },
        relatedSignal: { type: "string" },
        recommendedResponse: { type: "string" },
        reason: { type: "string" },
        confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
        tone: {
          type: "string",
          enum: ["CONSULTIVO", "DIRETO", "ACOLHEDOR", "TECNICO", "COMERCIAL"],
        },
        nextQuestion: { type: "string" },
      }),
    }),
    actionItems: arrayOfObjects({
      task: { type: "string" },
      category: {
        type: "string",
        enum: ["CONTENT_REVIEW", "COMMUNICATION", "EXERCISE", "TECHNICAL_CORRECTION", "NEXT_CLASS"],
      },
      ownerOrAudience: { type: "string" },
      priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
      reason: { type: "string" },
      successCriterion: { type: "string" },
    }),
    questions: arrayOfObjects({
      question: { type: "string" },
      expectedAnswer: { type: "string" },
      difficulty: { type: "string", enum: ["BASIC", "INTERMEDIATE", "ADVANCED"] },
      skillTarget: { type: "string" },
      reviewTip: { type: "string" },
    }),
    mindMap: objectSchema({
      centralTheme: { type: "string" },
      branches: arrayOfObjects({
        title: { type: "string" },
        children: arrayOfObjects({
          title: { type: "string" },
          children: stringArray,
        }),
      }),
    }),
  });
}

function formatSummary(value: unknown, shouldPolish: boolean) {
  if (typeof value === "string") return value.trim();

  const object = asObject(value);
  if (!object) return "";

  const sections = [
    cleanText(object.coreMessage),
    cleanText(object.overview),
    textArray(object.keyTakeaways).length
      ? ["### Pontos-chave", bulletList(textArray(object.keyTakeaways))].join("\n")
      : "",
    cleanText(object.boundaries)
      ? ["### Limites e confirmacoes", cleanText(object.boundaries)].join("\n")
      : "",
  ];

  return polishMarkdownText(sections.filter(Boolean).join("\n\n"), shouldPolish);
}

function formatTopics(value: unknown, shouldPolish: boolean) {
  const values = arrayValues(value);
  if (values.some((item) => asObject(item))) {
    return polishMarkdownText(
      values
        .map((item, index) => {
          const object = asObject(item);
          if (!object) return cleanText(item);

          const title = cleanText(object.title) || `Topico ${index + 1}`;
          const explanation = cleanText(object.explanation) || cleanText(object.detail);
          const evidence = cleanText(object.transcriptEvidence) || cleanText(object.evidence);
          const whyItMatters = cleanText(object.whyItMatters);
          const examples = textArray(object.examples);
          return [
            `## ${title}`,
            explanation,
            whyItMatters ? `- Relevancia: ${whyItMatters}` : "",
            evidence ? `- Evidencia: ${evidence}` : "",
            ...examples.map((example) => `- Exemplo: ${example}`),
          ]
            .filter(Boolean)
            .join("\n");
        })
        .filter(Boolean)
        .join("\n\n"),
      shouldPolish,
    );
  }

  return polishMarkdownText(bulletList(textArray(value)), shouldPolish);
}

function formatTechnicalReportLegacy(value: unknown, shouldPolish: boolean) {
  const object = asObject(value);
  if (object) {
    const importantPoints = [
      cleanText(object.objectiveFit),
      cleanText(object.audienceLevelFit),
      cleanText(object.technicalAccuracy),
    ].filter(Boolean);

    const importantTerms = textArray(object.notableTerms);
    const smallDetails = textArray(object.smallDetails);
    const gapsAndRisks = textArray(object.gapsAndRisks);
    const recommendations = textArray(object.recommendedAdjustments);

    const sections = [
      proseSection(
        "Resumo geral da aula",
        proseParagraphs([cleanText(object.objectiveFit), cleanText(object.structureAndClarity)]),
      ),
      proseSection(
        "Pontos importantes identificados",
        proseParagraphs([
          importantPoints.length
            ? `Os pontos centrais da aula foram ${sentenceList(importantPoints)}.`
            : cleanText(object.objectiveFit),
          smallDetails.length
            ? `Entre os elementos que merecem destaque estão ${sentenceList(smallDetails.slice(0, 4))}.`
            : "",
        ]),
      ),
      proseSection(
        "Qualidade da explicação",
        proseParagraphs([cleanText(object.languageAndTone), cleanText(object.structureAndClarity)]),
      ),
      proseSection(
        "Pontos que podem melhorar",
        proseParagraphs([
          gapsAndRisks.length
            ? `A aula ainda pode evoluir em ${sentenceList(gapsAndRisks.slice(0, 4))}.`
            : cleanText(object.technicalAccuracy),
          recommendations.length
            ? `Para uma próxima aula, vale priorizar ${sentenceList(recommendations.slice(0, 4))}.`
            : "",
        ]),
      ),
      proseSection(
        "Conclusão da análise",
        proseParagraphs([
          importantTerms.length
            ? `Os termos técnicos mais relevantes foram ${sentenceList(importantTerms.slice(0, 6))}.`
            : "",
          "No geral, a análise indica o que foi bem explicado, o que precisa de revisão e onde a organização da fala pode ficar mais consistente.",
        ]),
      ),
    ];

    return polishMarkdownText(
      sections.filter((section) => section.trim().length > 0).join("\n\n"),
      shouldPolish,
    );
  }

  return polishMarkdownText(bulletList(textArray(value)), shouldPolish);
}

function formatTechnicalReport(value: unknown, shouldPolish: boolean) {
  const object = asObject(value);
  if (!object) return formatTechnicalReportLegacy(value, shouldPolish);

  const generalSummary =
    cleanText(object.generalSummary) ||
    proseParagraphs([cleanText(object.objectiveFit), cleanText(object.structureAndClarity)]);
  const importantPoints = [
    ...textArray(object.importantPoints),
    cleanText(object.objectiveFit),
    cleanText(object.audienceLevelFit),
    cleanText(object.technicalAccuracy),
    ...textArray(object.smallDetails),
    ...textArray(object.notableTerms),
  ].filter(Boolean);
  const communicationAnalysis =
    cleanText(object.communicationAnalysis) ||
    proseParagraphs([
      cleanText(object.languageAndTone),
      cleanText(object.structureAndClarity),
      cleanText(object.audienceLevelFit),
    ]);
  const languageIssues = arrayValues(object.languageAndInformalityIssues)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const expression = objectText(item, ["expression", "term", "phrase", "title"]);
      const analysis = objectText(item, ["analysis", "impact", "reason", "detail"]);
      return [expression, analysis].filter(Boolean).join(": ");
    })
    .filter(Boolean);
  const improvementPoints = [
    ...textArray(object.improvementPoints),
    ...textArray(object.gapsAndRisks),
    ...textArray(object.recommendedAdjustments),
  ].filter(Boolean);
  const positivePoints = textArray(object.positivePoints);

  const sections = [
    proseSection(
      "Resumo geral da aula/conversa",
      generalSummary ||
        "A transcricao nao trouxe evidencia suficiente para uma sintese conclusiva.",
    ),
    proseSection(
      "Pontos importantes identificados",
      importantPoints.length
        ? bulletList(importantPoints.slice(0, 8))
        : "Nao foram identificados pontos centrais suficientes no material analisado.",
    ),
    proseSection(
      "Analise da comunicacao",
      communicationAnalysis ||
        "Nao houve dados suficientes para avaliar clareza, organizacao, seguranca, formalidade e uso de termos.",
    ),
    proseSection(
      "Erros de linguagem e informalidade",
      languageIssues.length
        ? bulletList(languageIssues.slice(0, 8))
        : "Nao foram identificados problemas relevantes de giria, vicio de linguagem ou informalidade no trecho analisado.",
    ),
    proseSection(
      "Pontos a melhorar",
      improvementPoints.length
        ? bulletList(improvementPoints.slice(0, 8))
        : "Nao ha melhorias especificas suficientes sem mais contexto de transcricao.",
    ),
    proseSection(
      "Pontos positivos",
      positivePoints.length
        ? bulletList(positivePoints.slice(0, 8))
        : "A aula apresentou elementos aproveitaveis, mas a transcricao nao trouxe detalhes suficientes para destacar pontos positivos com seguranca.",
    ),
  ];

  return polishMarkdownText(
    sections.filter((section) => section.trim().length > 0).join("\n\n"),
    shouldPolish,
  );
}

function diagnosisBulletLines(
  value: unknown,
  fields: {
    title: string[];
    detail?: string[];
    evidence?: string[];
    extra?: string[];
  },
) {
  return arrayValues(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const title = objectText(item, fields.title);
      const detail = fields.detail ? objectText(item, fields.detail) : "";
      const evidence = fields.evidence ? objectText(item, fields.evidence) : "";
      const extra = fields.extra ? objectText(item, fields.extra) : "";
      return [title, detail, evidence ? `Evidencia: ${evidence}` : "", extra]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean);
}

function mergeUniqueLines(...groups: string[][]) {
  const seen = new Set<string>();
  return groups
    .flat()
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatLessonDiagnosis(session: VoiceSession, value: unknown, shouldPolish: boolean) {
  const object = asObject(value);
  const persistedSignals = sessionSignalSnapshotFromMetadata(session.metadata);
  const persistedIntelligence = buildSessionSignalIntelligence(persistedSignals);

  if (!object && !persistedSignals?.signals.length) {
    return polishMarkdownText(
      "Nao houve sinais suficientes para montar um diagnostico confiavel desta aula ou conversa.",
      shouldPolish,
    );
  }

  const summary = cleanText(object?.summary);
  const painPoints = diagnosisBulletLines(object?.painPoints, {
    title: ["title", "pain", "point"],
    detail: ["impact", "whyItMatters", "summary"],
    evidence: ["evidence", "transcriptEvidence"],
  });
  const recurringQuestions = diagnosisBulletLines(object?.recurringQuestions, {
    title: ["question", "title"],
    detail: ["whyItMatters", "impact"],
    evidence: ["evidence", "transcriptEvidence"],
  });
  const objections = diagnosisBulletLines(object?.objections, {
    title: ["objection", "title"],
    detail: ["implication", "impact"],
    evidence: ["evidence", "transcriptEvidence"],
  });
  const opportunities = diagnosisBulletLines(object?.opportunities, {
    title: ["title", "opportunity"],
    detail: ["whyItMatters", "impact"],
    evidence: ["evidence", "transcriptEvidence"],
    extra: ["nextStep"],
  });
  const attentionPoints = diagnosisBulletLines(object?.attentionPoints, {
    title: ["point", "title"],
    detail: ["reason", "impact"],
    evidence: ["evidence", "transcriptEvidence"],
  });
  const decisionsAndTasks = arrayValues(object?.decisionsAndTasks)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const kind = objectText(item, ["type"]);
      const statement = objectText(item, ["item", "title", "task"]);
      const owner = objectText(item, ["ownerOrAudience", "owner"]);
      const urgency = objectText(item, ["urgency", "priority"]);
      const evidence = objectText(item, ["evidence", "transcriptEvidence"]);
      return [
        [kind, urgency].filter(Boolean).join(" | "),
        statement,
        owner ? `Responsavel: ${owner}` : "",
        evidence ? `Evidencia: ${evidence}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .filter(Boolean);
  const actionableSummary = textArray(object?.actionableSummary);
  const practicalRecommendations = textArray(object?.practicalRecommendations);
  const responseGuidance = arrayValues(object?.responseGuidance)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const scenario = objectText(item, ["scenario", "title"]);
      const relatedSignal = objectText(item, ["relatedSignal", "signal"]);
      const recommendedResponse = objectText(item, ["recommendedResponse", "response", "answer"]);
      const reason = objectText(item, ["reason", "whyItFits", "analysis"]);
      const confidence = objectText(item, ["confidence"]);
      const tone = objectText(item, ["tone"]);
      const nextQuestion = objectText(item, ["nextQuestion", "followUp"]);
      return [
        `### ${scenario || "Resposta sugerida"}`,
        relatedSignal ? `Sinal: ${relatedSignal}` : "",
        recommendedResponse ? `Resposta recomendada: ${recommendedResponse}` : "",
        reason ? `Motivo: ${reason}` : "",
        [confidence ? `Confianca: ${confidence}` : "", tone ? `Tom: ${tone}` : ""]
          .filter(Boolean)
          .join(" | "),
        nextQuestion ? `Proxima pergunta: ${nextQuestion}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean);

  const persistedPainPoints = persistedIntelligence.pains.map(
    (item) => `${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const persistedRecurringQuestions = persistedIntelligence.recurringQuestions.map(
    (item) => `${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const persistedObjections = persistedIntelligence.objections.map(
    (item) => `${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const persistedOpportunities = persistedIntelligence.opportunities.map(
    (item) => `${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const persistedAttentionPoints = persistedIntelligence.risks.map(
    (item) => `${item.title} | ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const persistedDecisionsAndTasks = [
    ...persistedIntelligence.decisions.map(
      (item) => `DECISION | ${item.title} | Evidencia: ${item.excerpt}`,
    ),
    ...persistedIntelligence.tasks.map(
      (item) => `TASK | ${item.title} | Evidencia: ${item.excerpt}`,
    ),
    ...persistedIntelligence.followUps.map(
      (item) => `FOLLOW_UP | ${item.title} | Evidencia: ${item.excerpt}`,
    ),
  ];
  const persistedActionableSummary =
    persistedSignals?.groups.slice(0, 4).map((group) => `${group.label}: ${group.summary}`) ?? [];
  const persistedPracticalRecommendations = persistedIntelligence.nextSteps.map(
    (item) => `${item.title}: ${item.description}`,
  );
  const persistedResponseGuidance = persistedIntelligence.suggestedResponses.map((item) =>
    [
      `### ${item.title}`,
      `Sinal: ${item.title}`,
      `Resposta recomendada: ${item.response}`,
      `Motivo: ${item.reason}`,
      [
        item.confidence !== undefined ? `Confianca: ${Math.round(item.confidence * 100)}%` : "",
        item.tone ? `Tom: ${String(item.tone).toUpperCase()}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      item.nextQuestion ? `Proxima pergunta: ${item.nextQuestion}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const mergedPainPoints = mergeUniqueLines(painPoints, persistedPainPoints);
  const mergedRecurringQuestions = mergeUniqueLines(
    recurringQuestions,
    persistedRecurringQuestions,
  );
  const mergedObjections = mergeUniqueLines(objections, persistedObjections);
  const mergedOpportunities = mergeUniqueLines(opportunities, persistedOpportunities);
  const mergedAttentionPoints = mergeUniqueLines(attentionPoints, persistedAttentionPoints);
  const mergedDecisionsAndTasks = mergeUniqueLines(decisionsAndTasks, persistedDecisionsAndTasks);
  const mergedActionableSummary = mergeUniqueLines(actionableSummary, persistedActionableSummary);
  const mergedPracticalRecommendations = mergeUniqueLines(
    practicalRecommendations,
    persistedPracticalRecommendations,
  );
  const mergedResponseGuidance = mergeUniqueLines(responseGuidance, persistedResponseGuidance);

  const sections = [
    proseSection(
      "Resumo acionavel",
      summary ||
        "A captura nao trouxe evidencia suficiente para montar um diagnostico acionavel com seguranca.",
    ),
    proseSection(
      "Dores identificadas",
      mergedPainPoints.length
        ? bulletList(mergedPainPoints)
        : "Nao houve evidencia suficiente para afirmar dores reais neste trecho.",
    ),
    proseSection(
      "Duvidas recorrentes",
      mergedRecurringQuestions.length
        ? bulletList(mergedRecurringQuestions)
        : "Nao houve duvidas recorrentes claras o bastante para destaque.",
    ),
    proseSection(
      "Objecoes percebidas",
      mergedObjections.length
        ? bulletList(mergedObjections)
        : "Nao houve objecoes claras o bastante para concluir resistencia relevante.",
    ),
    proseSection(
      "Oportunidades de melhoria ou avancar",
      mergedOpportunities.length
        ? bulletList(mergedOpportunities)
        : "Nao surgiram oportunidades suficientemente claras sem extrapolar a transcricao.",
    ),
    proseSection(
      "Pontos de atencao",
      mergedAttentionPoints.length
        ? bulletList(mergedAttentionPoints)
        : "Sem pontos de atencao fortes alem dos limites normais de contexto da conversa.",
    ),
    proseSection(
      "Decisoes e tarefas futuras",
      mergedDecisionsAndTasks.length
        ? bulletList(mergedDecisionsAndTasks)
        : "Nenhuma decisao ou tarefa futura apareceu com evidencia suficiente.",
    ),
    proseSection(
      "Resumo para agir depois",
      mergedActionableSummary.length
        ? bulletList(mergedActionableSummary)
        : "Ainda nao ha material suficiente para um resumo pratico confiavel.",
    ),
    proseSection(
      "Recomendacoes praticas",
      mergedPracticalRecommendations.length
        ? bulletList(mergedPracticalRecommendations)
        : "Ainda nao ha recomendacoes praticas seguras sem mais contexto real.",
    ),
    proseSection(
      "Respostas sugeridas",
      mergedResponseGuidance.length
        ? mergedResponseGuidance.join("\n\n")
        : "Ainda nao ha contexto suficiente para sugerir respostas confiaveis sem inventar dados.",
    ),
  ];

  return polishMarkdownText(
    sections.filter((section) => section.trim().length > 0).join("\n\n"),
    shouldPolish,
  );
}

function formatExecutiveHandoff(session: VoiceSession, value: unknown, shouldPolish: boolean) {
  const persistedSignals = sessionSignalSnapshotFromMetadata(session.metadata);
  const persistedIntelligence = buildSessionSignalIntelligence(persistedSignals);
  const object = asObject(value);
  const summary =
    cleanText(object?.summary) ||
    cleanText(object?.executiveSummary) ||
    cleanText(object?.handoffSummary) ||
    (persistedSignals?.groups.length
      ? sentenceList(persistedSignals.groups.slice(0, 3).map((group) => group.summary))
      : "Ainda nao ha sinais suficientes para um handoff executivo confiavel.");

  const priorities = [
    ...persistedIntelligence.decisions
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`),
    ...persistedIntelligence.tasks
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`),
    ...persistedIntelligence.followUps
      .slice(0, 2)
      .map((item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`),
  ];
  const risks = [
    ...persistedIntelligence.objections
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`),
    ...persistedIntelligence.risks
      .slice(0, 3)
      .map((item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`),
  ];
  const nextSteps = persistedIntelligence.nextSteps.map(
    (item) => `${item.title}: ${item.description}`,
  );

  const sections = [
    proseSection("Resumo executivo", summary),
    proseSection(
      "O que precisa ficar claro",
      priorities.length
        ? bulletList(priorities)
        : "Nenhuma decisao, tarefa ou follow-up forte apareceu com evidencia suficiente.",
    ),
    proseSection(
      "Riscos e travas",
      risks.length
        ? bulletList(risks)
        : "Nao apareceram riscos ou objecoes fortes o bastante para destaque.",
    ),
    proseSection(
      "Proximos passos recomendados",
      nextSteps.length
        ? bulletList(nextSteps)
        : "Ainda nao ha proximos passos persistidos para orientar o handoff.",
    ),
  ];

  return polishMarkdownText(sections.join("\n\n"), shouldPolish);
}

function formatSuggestedResponses(session: VoiceSession, value: unknown, shouldPolish: boolean) {
  const persistedSignals = sessionSignalSnapshotFromMetadata(session.metadata);
  const persistedIntelligence = buildSessionSignalIntelligence(persistedSignals);
  const values = arrayValues(value);

  const modeled = values
    .map((item) => {
      const object = asObject(item);
      if (!object) return "";
      const scenario = objectText(item, ["scenario", "title", "situation"]);
      const response = objectText(item, ["response", "recommendedResponse", "answer"]);
      const reason = objectText(item, ["reason", "why", "analysis"]);
      const nextQuestion = objectText(item, ["nextQuestion", "followUp"]);
      return [
        `### ${scenario || "Resposta sugerida"}`,
        response ? `Resposta: ${response}` : "",
        reason ? `Motivo: ${reason}` : "",
        nextQuestion ? `Proxima pergunta: ${nextQuestion}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean);

  const persisted = persistedIntelligence.suggestedResponses.map((item) =>
    [
      `### ${item.title}`,
      `Resposta: ${item.response}`,
      `Motivo: ${item.reason}`,
      [
        item.confidence !== undefined ? `Confianca: ${Math.round(item.confidence * 100)}%` : "",
        item.tone ? `Tom: ${String(item.tone).toUpperCase()}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
      item.nextQuestion ? `Proxima pergunta: ${item.nextQuestion}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const entries = mergeUniqueLines(modeled, persisted);
  return polishMarkdownText(
    entries.length
      ? entries.join("\n\n")
      : "Ainda nao ha contexto suficiente para montar respostas sugeridas com seguranca.",
    shouldPolish,
  );
}

function formatCommercialBrief(session: VoiceSession, value: unknown, shouldPolish: boolean) {
  const persistedSignals = sessionSignalSnapshotFromMetadata(session.metadata);
  const persistedIntelligence = buildSessionSignalIntelligence(persistedSignals);
  const object = asObject(value);
  const summary =
    cleanText(object?.summary) ||
    cleanText(object?.commercialSummary) ||
    (persistedIntelligence.opportunities[0]?.detail
      ? sentenceList(persistedIntelligence.opportunities.slice(0, 2).map((item) => item.detail))
      : "Ainda nao ha sinais suficientes para um brief comercial seguro.");

  const opportunities = persistedIntelligence.opportunities.map(
    (item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const objections = persistedIntelligence.objections.map(
    (item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const pains = persistedIntelligence.pains.map(
    (item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const followUps = persistedIntelligence.followUps.map(
    (item) => `${item.title}: ${item.detail} | Evidencia: ${item.excerpt}`,
  );
  const crmActions = persistedIntelligence.nextSteps
    .filter(
      (item) => item.kind === "register_crm_opportunity" || item.kind === "schedule_follow_up",
    )
    .map((item) => `${item.title}: ${item.description}`);

  const sections = [
    proseSection("Leitura comercial", summary),
    proseSection(
      "Oportunidades",
      opportunities.length
        ? bulletList(opportunities)
        : "Nenhuma oportunidade comercial apareceu com forca suficiente.",
    ),
    proseSection(
      "Objecoes e riscos comerciais",
      objections.length
        ? bulletList(objections)
        : "Nao apareceram objecoes comerciais fortes neste recorte.",
    ),
    proseSection(
      "Dores com potencial de valor",
      pains.length
        ? bulletList(pains)
        : "Ainda nao ha dores recorrentes claras para ancorar uma proposta.",
    ),
    proseSection(
      "Follow-ups e CRM",
      [...followUps, ...crmActions].length
        ? bulletList([...followUps, ...crmActions])
        : "Ainda nao ha follow-up ou registro comercial sugerido com seguranca.",
    ),
  ];

  return polishMarkdownText(sections.join("\n\n"), shouldPolish);
}
function formatActionItems(value: unknown, shouldPolish: boolean) {
  const values = arrayValues(value);
  if (values.some((item) => asObject(item))) {
    return polishMarkdownText(
      values
        .map((item, index) => {
          const object = asObject(item);
          if (!object) return cleanText(item);

          const task = cleanText(object.task) || cleanText(object.text);
          const priority = cleanText(object.priority);
          const category = cleanText(object.category);
          const owner = cleanText(object.ownerOrAudience);
          const reason = cleanText(object.reason);
          const successCriterion = cleanText(object.successCriterion);
          const tags = [priority, category].filter(Boolean).join(" | ");
          const prefix = tags ? `[${tags}] ` : "";
          const details = [
            owner ? `Responsavel: ${owner}` : "",
            reason ? `Por que: ${reason}` : "",
            successCriterion ? `Criterio: ${successCriterion}` : "",
          ].filter(Boolean);
          return task
            ? `- ${prefix}${index + 1}. ${task}${details.length ? ` | ${details.join(" | ")}` : ""}`
            : "";
        })
        .filter(Boolean)
        .join("\n"),
      shouldPolish,
    );
  }

  return polishMarkdownText(bulletList(textArray(value)), shouldPolish);
}

function questionDifficultyLabel(value: string) {
  const normalized = cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("advanced") || normalized.includes("reflex")) return "Reflexivas";
  if (normalized.includes("intermediate") || normalized.includes("medio")) return "Médias";
  return "Fáceis";
}

function formatQuestionAnswer(
  question: string,
  answer: string,
  difficulty: string,
  skillTarget: string,
  reviewTip: string,
  index: number,
) {
  const lines = [`### ${index + 1}. ${question}`];
  if (answer) lines.push(`Resposta: ${answer}`);
  if (skillTarget) lines.push(`Foco: ${skillTarget}`);
  if (reviewTip) lines.push(`Como revisar: ${reviewTip}`);
  if (difficulty) lines.push(`Nivel: ${difficulty}`);
  return lines.join("\n");
}

function formatQuestions(value: unknown, shouldPolish: boolean) {
  const values = arrayValues(value);
  if (values.some((item) => asObject(item))) {
    const groups = new Map<string, string[]>();

    values.forEach((item, index) => {
      const object = asObject(item);
      if (!object) return;

      const question = cleanText(object.question);
      const answer = cleanText(object.expectedAnswer) || cleanText(object.answer);
      const difficulty = cleanText(object.difficulty);
      const skillTarget = cleanText(object.skillTarget);
      const reviewTip = cleanText(object.reviewTip);
      if (!question || !answer) return;

      const label = questionDifficultyLabel(difficulty);
      const entries = groups.get(label) ?? [];
      entries.push(
        formatQuestionAnswer(question, answer, difficulty, skillTarget, reviewTip, index),
      );
      groups.set(label, entries);
    });

    const ordered = ["Fáceis", "Médias", "Reflexivas"];
    const content = ordered
      .map((label) => {
        const entries = groups.get(label) ?? [];
        if (!entries.length) return "";
        return [`## ${label}`, ...entries].join("\n\n");
      })
      .filter(Boolean)
      .join("\n\n");

    return polishMarkdownText(content, shouldPolish);
  }

  return polishMarkdownText(bulletList(textArray(value)), shouldPolish);
}

function mindMapChildrenLines(value: unknown, depth = 0): string[] {
  const prefix = `${"  ".repeat(depth)}- `;

  return arrayValues(value).flatMap((child) => {
    if (typeof child === "string") {
      return splitMindMapText(child).map((item) => `${prefix}${item}`);
    }

    const object = asObject(child);
    if (!object) return [];

    const title = cleanText(object.title) || objectText(child, ["name", "summary"]);
    const leaves = mindMapChildrenLines(object.children, depth + 1);
    return [`${prefix}${title}`, ...leaves].filter(
      (line) => line.replace(/^[-\s]+/, "").trim().length > 0,
    );
  });
}

function compactMindMapText(value: string, limit = 72) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized
    .slice(0, limit)
    .replace(/\s+\S*$/, "")
    .trim()}...`;
}

function splitMindMapText(value: string) {
  return value
    .split(/(?<=[.!?])\s+|;\s+|\s+\|\s+/)
    .map((item) => compactMindMapText(item.replace(/^[-*]\s+/, ""), 64))
    .filter(Boolean);
}

function mindMapBranchTitle(value: string, index: number) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/\b(conceito|definicao|fundamento|base|introducao|contexto)\b/.test(normalized)) {
    return "Contexto";
  }
  if (/\b(exemplo|aplicacao|caso|demonstracao)\b/.test(normalized)) {
    return "Exemplos";
  }
  if (/\b(problema|desafio|dificuldade|risco|erro|limite)\b/.test(normalized)) {
    return "Problemas";
  }
  if (/\b(solucao|resolver|correcao|mitigacao|ajuste)\b/.test(normalized)) {
    return "Solucoes";
  }
  if (/\b(ferramenta|tecnologia|recurso|stack|biblioteca)\b/.test(normalized)) {
    return "Ferramentas";
  }
  if (/\b(api|integracao|requisicao|comunicacao|endpoint)\b/.test(normalized)) {
    return "Integracao";
  }
  if (/\b(dado|banco|armazenamento|consulta|relacionamento)\b/.test(normalized)) {
    return "Dados";
  }
  if (/\b(boa pratica|boas praticas|organizacao|manutencao|teste)\b/.test(normalized)) {
    return "Boas praticas";
  }
  if (/\b(conclusao|resultado|fechamento|sintese)\b/.test(normalized)) {
    return "Conclusao";
  }

  return compactMindMapText(value, 28) || `Ramo ${index + 1}`;
}

function splitMindMapBranches(value: string) {
  const items = splitMindMapText(value);
  if (items.length <= 1) return items;

  const grouped = new Map<string, string[]>();
  const orderedTitles: string[] = [];

  for (const item of items) {
    const title = mindMapBranchTitle(item, orderedTitles.length);
    if (!grouped.has(title)) {
      grouped.set(title, []);
      orderedTitles.push(title);
    }
    grouped.get(title)?.push(item);
  }

  if (orderedTitles.length < 2 || orderedTitles.length > 8) {
    return items;
  }

  return orderedTitles.map((title) =>
    `${title}\n${
      grouped
        .get(title)
        ?.map((item) => `- ${item}`)
        .join("\n") ?? ""
    }`.trim(),
  );
}

function normalizeMindMapNode(node: { title: string; children: string[] }, index: number) {
  const title = compactMindMapText(node.title, 48) || `Ramo ${index + 1}`;
  const childItems = node.children.flatMap((child) => splitMindMapText(child));

  if (childItems.length === 0) {
    return { title, children: [] as string[] };
  }

  const expandedChildren = childItems.flatMap((item) => {
    const leaves = splitMindMapBranches(item);
    if (leaves.length <= 1) return [item];
    return leaves;
  });

  return {
    title,
    children: expandedChildren.slice(0, 8),
  };
}

function formatMindMap(session: VoiceSession, value: unknown, shouldPolish: boolean) {
  const root = asObject(value);
  const centralTitle = root
    ? cleanText(root.centralTheme) || cleanText(root.title) || session.title
    : session.title;
  const values = root
    ? arrayValues(root.branches ?? root.children ?? root.items ?? root.nodes)
    : arrayValues(value);
  if (values.some((item) => asObject(item))) {
    const branches = values
      .map((item, index) => {
        const object = asObject(item);
        if (!object) return "";

        const title = compactMindMapText(cleanText(object.title), 48) || `Ramo ${index + 1}`;
        const children = mindMapChildrenLines(object.children)
          .flatMap((line) => {
            const indent = line.match(/^(\s*)-\s*/)?.[1] ?? "";
            const text = line.replace(/^[-\s]+/, "").trim();
            if (!text) return [];
            if (indent) return [`${indent}- ${compactMindMapText(text, 72)}`];
            return splitMindMapBranches(text).map((branch) => `- ${branch}`);
          })
          .filter(Boolean);

        return [`## ${title}`, ...children].filter(Boolean).join("\n");
      })
      .filter(Boolean);

    const hasNestedChildren = branches.some((branch) =>
      branch.split(/\r?\n/).some((line) => /^\s+-\s/.test(line)),
    );

    if (hasNestedChildren) {
      return polishMarkdownText([`# ${centralTitle}`, "", ...branches].join("\n\n"), shouldPolish);
    }

    const normalizedBranches = branches.map((branch, index) => {
      const lines = branch.split(/\r?\n/);
      const title = lines[0]?.replace(/^##\s*/, "") ?? `Ramo ${index + 1}`;
      const children = lines
        .slice(1)
        .map((line) => line.replace(/^[-\s]+/, "").trim())
        .filter(Boolean);
      return normalizeMindMapNode({ title, children }, index);
    });

    const safeBranches = normalizedBranches
      .flatMap((branch, index) => {
        const currentChildren =
          branch.children.length > 1
            ? branch.children
            : splitMindMapBranches(branch.children[0] ?? "");
        const normalizedChildren = currentChildren.flatMap((child) => {
          const text = child.trim();
          if (!text) return [];
          const parsed = splitMindMapText(text);
          if (parsed.length <= 1) return [text];
          return parsed.map((item) => item);
        });

        const branchLines = [
          `## ${compactMindMapText(branch.title, 48) || `Ramo ${index + 1}`}`,
          ...normalizedChildren.slice(0, 6).map((child) => `- ${child}`),
        ];

        return branchLines.join("\n");
      })
      .filter(Boolean);

    if (safeBranches.length >= 2) {
      return polishMarkdownText(
        [`# ${centralTitle}`, "", ...safeBranches].join("\n\n"),
        shouldPolish,
      );
    }

    return polishMarkdownText([`# ${centralTitle}`, "", ...branches].join("\n\n"), shouldPolish);
  }

  const branches = textArray(value);
  const normalizedBranches = branches.flatMap((branch) => splitMindMapBranches(branch));

  if (normalizedBranches.length >= 2) {
    const structured = normalizedBranches.map((branch, index) => {
      const [titleLine, ...rest] = branch.split(/\r?\n/);
      const title = compactMindMapText(titleLine.replace(/^[-\s]+/, ""), 48) || `Ramo ${index + 1}`;
      const items = rest
        .map((line) => line.replace(/^[-\s]+/, "").trim())
        .flatMap((line) => splitMindMapText(line))
        .filter(Boolean);

      return [`## ${title}`, ...items.slice(0, 6).map((item) => `- ${item}`)].join("\n");
    });

    return polishMarkdownText([`# ${centralTitle}`, "", ...structured].join("\n\n"), shouldPolish);
  }

  return polishMarkdownText(
    [`# ${centralTitle}`, "", bulletList(branches)].filter(Boolean).join("\n"),
    shouldPolish,
  );
}

export function callMaterialsFromGeneratedPayload(
  session: VoiceSession,
  payload: JsonObject,
  model: string,
  generatedAt = new Date().toISOString(),
): CallMaterials {
  const shouldPolish = isPortugueseLanguage(session.language);
  const material = (type: GeneratedMaterialType, content: string): MaterialItem => ({
    id: id("mat"),
    sessionId: session.id,
    type,
    title: generatedMaterialTitle(type),
    content,
    format: "MARKDOWN",
    status: "COMPLETED",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  });

  const formatted: Record<GeneratedMaterialType, string> = {
    SUMMARY: formatSummary(payload.summary, shouldPolish),
    TOPICS: formatTopics(payload.topics, shouldPolish),
    INSIGHTS: formatTechnicalReport(payload.technicalReport ?? payload.insights, shouldPolish),
    LESSON_DIAGNOSIS: formatLessonDiagnosis(session, payload.lessonDiagnosis, shouldPolish),
    ACTION_ITEMS: formatActionItems(payload.actionItems, shouldPolish),
    QUESTIONS: formatQuestions(payload.questions, shouldPolish),
    MIND_MAP: formatMindMap(session, payload.mindMap, shouldPolish),
    EXECUTIVE_HANDOFF: formatExecutiveHandoff(session, payload.executiveHandoff, shouldPolish),
    SUGGESTED_RESPONSES: formatSuggestedResponses(
      session,
      payload.suggestedResponses,
      shouldPolish,
    ),
    COMMERCIAL_BRIEF: formatCommercialBrief(session, payload.commercialBrief, shouldPolish),
  };

  const allItems = generatedMaterialTypeOrder.map((type) => material(type, formatted[type]));
  const requested = requestedMaterialTypes(session);
  const selectedItems = requested
    ? allItems.filter((item) => requested.has(item.type as GeneratedMaterialType))
    : allItems;
  const nonEmptySelected = selectedItems.filter((item) => item.content.trim().length > 0);
  const items =
    nonEmptySelected.length > 0
      ? nonEmptySelected
      : allItems.filter((item) => item.content.trim().length > 0);

  return {
    sessionId: session.id,
    items,
    generatedAt,
    model,
  };
}
