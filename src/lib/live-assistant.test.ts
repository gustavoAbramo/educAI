import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLiveAssistantResponse, type LiveAssistantContext } from "./live-assistant";

function emptyContext(overrides: Partial<LiveAssistantContext> = {}): LiveAssistantContext {
  return {
    recording: false,
    transcriptSegments: [],
    interimTranscript: "",
    insights: {
      terms: [],
      transcriptionIssues: [],
      importantPoints: [],
      languageIssues: [],
    },
    ...overrides,
  };
}

describe("buildLiveAssistantResponse", () => {
  it("answers known definition questions directly", () => {
    const response = buildLiveAssistantResponse("O que e backend?", "student", emptyContext());

    assert.match(response, /\*\*Backend\*\*/);
    assert.match(response, /servidor/i);
  });

  it("does not force glossary mode for generic contextual questions", () => {
    const response = buildLiveAssistantResponse(
      "O que e isso aqui?",
      "student",
      emptyContext({
        transcriptSegments: [
          {
            speakerName: "Professora Ana",
            text: "Hoje vamos revisar porcentagem e regra de tres.",
          },
        ],
      }),
    );

    assert.doesNotMatch(response, /Ainda nao tenho uma definicao pronta/i);
    assert.doesNotMatch(response, /^\*\*Isso aqui\*\*/i);
  });

  it("matches glossary aliases as whole terms only", () => {
    const response = buildLiveAssistantResponse(
      "Qual foi uma noticia positiva de hoje?",
      "student",
      emptyContext(),
    );

    assert.doesNotMatch(response, /\*\*IA\*\*/i);
  });

  it("monta respostas e follow-ups curtos a partir do contexto", () => {
    const context = emptyContext({
      transcriptSegments: [
        {
          speakerName: "Cliente",
          text: "Estou com receio do custo e queria entender o retorno mais rapido.",
          technicalTerms: ["custo", "retorno"],
        },
      ],
      insights: {
        terms: ["custo", "retorno"],
        transcriptionIssues: [],
        importantPoints: ["Existe objecao de custo antes de avancar."],
        languageIssues: [],
      },
    });

    assert.match(
      buildLiveAssistantResponse("o que eu respondo para isso?", "student", context),
      /Resposta pronta/i,
    );
    assert.match(
      buildLiveAssistantResponse("qual follow-up faz mais sentido agora?", "student", context),
      /Follow-up sugerido/i,
    );
    assert.match(
      buildLiveAssistantResponse("gera um resumo executivo", "student", context),
      /Resumo executivo/i,
    );
  });
});
