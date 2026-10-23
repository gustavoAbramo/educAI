import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSessionSignalIntelligence,
  buildSessionSignalSnapshot,
  sessionSignalSnapshotFromMetadata,
} from "./session-signals";

describe("session signals", () => {
  it("persists strong signals with grouping and actionable suggestions", () => {
    const snapshot = buildSessionSignalSnapshot({
      sessionTitle: "Aula comercial",
      sessionType: "SALES_CALL",
      audience: "Time comercial",
      objectives: "Entender dores e proximo passo",
      segments: [
        {
          id: "seg_1",
          speakerName: "Cliente",
          text: "Estamos perdendo informacao importante depois das reunioes e isso vira retrabalho no time.",
          confidence: 0.91,
          clarity: 0.86,
          conviction: 0.84,
          technicalTerms: ["retrabalho"],
          offsetMs: 10_000,
        },
        {
          id: "seg_2",
          speakerName: "Cliente",
          text: "Ficou combinado marcar um follow-up na proxima semana para revisar a proposta.",
          confidence: 0.92,
          clarity: 0.88,
          conviction: 0.82,
          technicalTerms: ["proposta"],
          offsetMs: 30_000,
        },
        {
          id: "seg_3",
          speakerName: "Cliente",
          text: "Se isso integrar com o CRM, vira uma oportunidade boa para o time comercial avancar.",
          confidence: 0.89,
          clarity: 0.81,
          conviction: 0.8,
          technicalTerms: ["CRM"],
          offsetMs: 48_000,
        },
      ],
    });

    assert.ok(snapshot.signals.length >= 3);
    assert.ok(snapshot.groups.length >= 2);
    assert.ok(snapshot.actionSuggestions.length >= 2);
    assert.ok(snapshot.signals.some((signal) => signal.type === "pain_point"));
    assert.ok(snapshot.signals.some((signal) => signal.type === "follow_up"));
    assert.ok(snapshot.signals.some((signal) => signal.type === "opportunity"));

    const intelligence = buildSessionSignalIntelligence(snapshot);
    assert.ok(intelligence.pains.length >= 1);
    assert.ok(intelligence.followUps.length >= 1);
    assert.ok(intelligence.opportunities.length >= 1);
    assert.ok(
      intelligence.nextSteps.some(
        (step) => step.kind === "schedule_follow_up" || step.kind === "register_crm_opportunity",
      ),
    );
  });

  it("reads a persisted snapshot back from metadata", () => {
    const original = buildSessionSignalSnapshot({
      sessionTitle: "Diagnostico",
      sessionType: "MEETING",
      segments: [
        {
          id: "seg_meta",
          speakerName: "Pessoa 1",
          text: "Precisamos responder essa objecao sobre custo antes da proxima conversa.",
          confidence: 0.93,
          clarity: 0.84,
          conviction: 0.88,
          offsetMs: 12_000,
        },
      ],
    });

    const restored = sessionSignalSnapshotFromMetadata({ sessionSignals: original });
    assert.ok(restored);
    assert.equal(restored?.signals.length, original.signals.length);
    assert.equal(restored?.actionSuggestions.length, original.actionSuggestions.length);
    assert.equal(restored?.signals[0]?.type, original.signals[0]?.type);
  });
});

