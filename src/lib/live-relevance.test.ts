import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateLiveRelevance } from "./live-relevance";

describe("evaluateLiveRelevance", () => {
  it("scores explicit decisions highly", () => {
    const result = evaluateLiveRelevance({
      terms: ["API", "backend"],
      highlights: ["Decidimos seguir com a API unica e manter o backend separado do frontend."],
      interimTranscript: "",
      metrics: {
        confidence: 0.88,
        clarity: 0.82,
        conviction: 0.79,
      },
      context: {
        sessionType: "MEETING",
        recentSegments: [
          "Hoje avaliamos frontend, backend e contrato de API.",
          "Decidimos seguir com a API unica e manter o backend separado do frontend.",
        ],
      },
    });

    assert.equal(result.topInsight?.category, "decision");
    assert.ok((result.topInsight?.relevanceScore ?? 0) >= 0.75);
    assert.match(result.topInsight?.reason ?? "", /decisao/i);
  });

  it("raises recurring doubts above generic highlights", () => {
    const result = evaluateLiveRelevance({
      terms: ["token", "login"],
      highlights: [
        "Como esse token expira?",
        "Qual a diferenca entre token e login nessa arquitetura?",
      ],
      interimTranscript: "Como esse token expira na pratica?",
      metrics: {
        confidence: 0.8,
        clarity: 0.76,
        conviction: 0.71,
      },
      context: {
        sessionType: "CLASS",
        recentSegments: [
          "Qual a diferenca entre token e login nessa arquitetura?",
          "Como esse token expira na pratica?",
          "Ainda estou em duvida sobre token e login.",
        ],
      },
    });

    assert.equal(result.topInsight?.category, "question");
    assert.ok((result.topInsight?.relevanceScore ?? 0) >= 0.68);
    assert.ok((result.topInsight?.recurrence ?? 0) >= 2);
    assert.match(result.responseSuggestion?.response ?? "", /Boa pergunta|faz sentido/i);
  });

  it("detects actionable tasks with suggested follow-up", () => {
    const result = evaluateLiveRelevance({
      terms: ["proposta", "crm"],
      highlights: ["Precisamos enviar a proposta final e revisar o CRM ainda hoje."],
      interimTranscript: "",
      metrics: {
        confidence: 0.86,
        clarity: 0.77,
        conviction: 0.83,
      },
      context: {
        sessionType: "SALES_CALL",
        recentSegments: [
          "Precisamos enviar a proposta final e revisar o CRM ainda hoje.",
          "Tambem vale confirmar quem fica com a proposta.",
        ],
      },
    });

    assert.equal(result.topInsight?.category, "task");
    assert.match(result.topInsight?.suggestedAction ?? "", /responsavel|prazo/i);
    assert.equal(result.responseSuggestion?.tone, "direto");
  });

  it("keeps weak language or insufficient speech as low-relevance noise", () => {
    const result = evaluateLiveRelevance({
      terms: [],
      highlights: [],
      interimTranscript: "Ok... tipo...",
      metrics: {
        confidence: 0.41,
        clarity: 0.35,
        conviction: 0.32,
      },
      context: {
        languageIssues: ["Uso de 'tipo', ainda sem conteudo acionavel."],
        recentSegments: ["Ok...", "Tipo..."],
      },
    });

    assert.equal(result.evaluations[0]?.category, "noise");
    assert.ok((result.evaluations[0]?.relevanceScore ?? 1) <= 0.25);
    assert.equal(result.responseSuggestion, undefined);
  });
});
