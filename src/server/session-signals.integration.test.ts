import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { VoiceSession, VoiceTranscript } from "@/lib/voice-intelligence";
import { callMaterialsFromGeneratedPayload } from "./material-generation";
import { buildSimulatedMaterials } from "./simulated-session-runtime";

describe("session signal integration", () => {
  const session: VoiceSession = {
    id: "ses_signals",
    type: "SALES_CALL",
    title: "Conversa comercial",
    language: "pt-BR",
    status: "CREATED",
    participants: [],
    metadata: {
      sessionSignals: {
        version: 1,
        generatedAt: "2026-06-15T12:00:00.000Z",
        signals: [
          {
            id: "sig_1",
            type: "objection",
            sourceCategory: "risk",
            themeId: "custo",
            themeLabel: "Custo",
            speakerName: "Cliente",
            excerpt: "O cliente disse que o custo parece alto para o momento.",
            score: 0.84,
            reason: "Ha uma objecao explicita ligada a custo.",
            suggestedAction: "Responder a objecao com valor e seguranca.",
            timestampMs: 18000,
            recurrence: 2,
            keywords: ["custo", "cliente"],
            recommendedResponse: "Faz sentido olhar custo com cuidado. Posso te mostrar onde o retorno aparece primeiro na operacao.",
            responseReason: "A resposta reduz friccao e ancora valor pratico.",
            responseConfidence: 0.81,
            responseTone: "consultivo",
            nextQuestion: "Hoje o peso maior esta em custo inicial ou tempo para capturar valor?",
          },
        ],
        groups: [
          {
            id: "group_1",
            label: "Custo",
            primaryType: "objection",
            signalIds: ["sig_1"],
            score: 0.84,
            recurrence: 2,
            excerpt: "O cliente disse que o custo parece alto para o momento.",
            summary: "Objecao recorrente de custo antes de avancar.",
            firstTimestampMs: 18000,
            lastTimestampMs: 26000,
          },
        ],
        actionSuggestions: [
          {
            id: "act_1",
            kind: "respond_objection",
            title: "Responder objecao prioritaria",
            description: "Preparar uma resposta comercial ancorada em valor e retorno.",
            priority: "high",
            basedOnSignalIds: ["sig_1"],
          },
        ],
      },
      outputsRequested: ["Diagnostico da aula"],
    },
    createdAt: "2026-06-15T12:00:00.000Z",
    updatedAt: "2026-06-15T12:00:00.000Z",
  };

  it("enriches LESSON_DIAGNOSIS with persisted signals", () => {
    const materials = callMaterialsFromGeneratedPayload(
      session,
      {
        lessonDiagnosis: {
          summary: "A conversa trouxe uma objecao comercial importante.",
        },
      },
      "test:model",
      "2026-06-15T12:00:00.000Z",
    );

    const content = materials.items[0]?.content ?? "";
    assert.match(content, /Custo/);
    assert.match(content, /Resposta recomendada:/);
    assert.match(content, /Responder objecao prioritaria/);
  });

  it("creates handoff, responses and commercial brief from persisted signals", () => {
    const materials = callMaterialsFromGeneratedPayload(
      {
        ...session,
        metadata: {
          ...session.metadata,
          outputsRequested: [
            "Diagnostico da aula",
            "Resumo executivo",
            "Respostas sugeridas",
            "Insights comerciais",
          ],
        },
      },
      { lessonDiagnosis: { summary: "A conversa trouxe uma objecao comercial importante." } },
      "test:model",
      "2026-06-15T12:00:00.000Z",
    );

    const handoff = materials.items.find((item) => item.type === "EXECUTIVE_HANDOFF")?.content ?? "";
    const responses = materials.items.find((item) => item.type === "SUGGESTED_RESPONSES")?.content ?? "";
    const commercial = materials.items.find((item) => item.type === "COMMERCIAL_BRIEF")?.content ?? "";

    assert.match(handoff, /Resumo executivo/);
    assert.match(responses, /Resposta:/);
    assert.match(commercial, /Oportunidades|Objecoes|Follow-ups/);
  });

  it("uses persisted signals in simulated materials too", () => {
    const transcript: VoiceTranscript = {
      id: "trn_signals",
      sessionId: session.id,
      language: "pt-BR",
      status: "COMPLETED",
      text: "Cliente: O custo parece alto para o momento.",
      segments: [
        {
          id: "seg_1",
          speaker: "Cliente",
          startMs: 0,
          endMs: 5000,
          text: "O custo parece alto para o momento.",
        },
      ],
      format: "TEXT",
      createdAt: "2026-06-15T12:00:00.000Z",
      updatedAt: "2026-06-15T12:00:00.000Z",
      provider: "mock",
    };

    const materials = buildSimulatedMaterials(session, transcript);
    const diagnosis = materials.items.find((item) => item.type === "LESSON_DIAGNOSIS")?.content ?? "";
    const actions = materials.items.find((item) => item.type === "ACTION_ITEMS")?.content ?? "";

    assert.match(diagnosis, /Objecoes percebidas/);
    assert.match(diagnosis, /Custo/);
    assert.match(actions, /Responder objecao prioritaria/);
  });
});
