import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLivePreviewDashboard } from "./live-preview";

describe("buildLivePreviewDashboard", () => {
  it("prefers interim speech as the live line and suggests a useful follow-up", () => {
    const dashboard = buildLivePreviewDashboard({
      recording: true,
      activeSpeaker: "Professora Ana",
      interimTranscript: "Estamos conectando frontend com backend pela API agora.",
      segments: [
        {
          speakerName: "Professora Ana",
          text: "Hoje vamos revisar integracao de sistemas.",
          confidence: 0.78,
          clarity: 0.74,
          conviction: 0.69,
        },
      ],
      insights: {
        terms: ["API", "frontend", "backend"],
        importantPoints: ["Conectar frontend e backend pela API."],
        transcriptionIssues: [],
        languageIssues: [],
      },
      context: {
        sessionType: "CLASS",
        recentSegments: ["Hoje vamos revisar integracao de sistemas."],
      },
    });

    assert.match(dashboard.liveLabel, /Professora Ana falando agora/i);
    assert.match(dashboard.liveLine, /frontend com backend pela API agora/i);
    assert.ok(dashboard.relevantInsights.length >= 1);
    assert.equal(dashboard.topCategory, "highlight");
    assert.match(dashboard.suggestedQuestion ?? "", /Quer que eu aprofunde|Peca um exemplo/i);
  });

  it("aggregates speech metrics from finalized segments", () => {
    const dashboard = buildLivePreviewDashboard({
      recording: true,
      activeSpeaker: "Pessoa 1",
      interimTranscript: "",
      segments: [
        {
          speakerName: "Pessoa 1",
          text: "Primeiro trecho final.",
          confidence: 0.8,
          clarity: 0.6,
          conviction: 0.4,
        },
        {
          speakerName: "Pessoa 2",
          text: "Segundo trecho final.",
          confidence: 0.6,
          clarity: 0.8,
          conviction: 0.6,
        },
      ],
      insights: {
        terms: [],
        importantPoints: [],
        transcriptionIssues: [],
        languageIssues: [],
      },
    });

    assert.equal(dashboard.metrics[0]?.value, 0.7);
    assert.equal(dashboard.metrics[1]?.value, 0.7);
    assert.equal(dashboard.metrics[2]?.value, 0.5);
    assert.match(dashboard.liveLabel, /Ultimo trecho de Pessoa 2/i);
  });

  it("highlights a strong recurring question and offers response guidance", () => {
    const dashboard = buildLivePreviewDashboard({
      recording: true,
      activeSpeaker: "Pessoa 2",
      interimTranscript: "Como esse token expira na pratica?",
      segments: [
        {
          speakerName: "Pessoa 1",
          text: "Hoje falamos sobre login e token.",
          confidence: 0.88,
          clarity: 0.79,
          conviction: 0.76,
        },
        {
          speakerName: "Pessoa 2",
          text: "Qual a diferenca entre token e login?",
          confidence: 0.86,
          clarity: 0.77,
          conviction: 0.72,
        },
      ],
      insights: {
        terms: ["token", "login"],
        importantPoints: ["Qual a diferenca entre token e login?"],
        transcriptionIssues: [],
        languageIssues: [],
      },
      context: {
        sessionType: "CLASS",
        recentSegments: [
          "Qual a diferenca entre token e login?",
          "Como esse token expira na pratica?",
          "Ainda estou em duvida sobre token e login.",
        ],
      },
    });

    assert.equal(dashboard.topCategory, "question");
    assert.ok((dashboard.topRelevanceScore ?? 0) >= 0.65);
    assert.match(dashboard.responseSuggestion?.response ?? "", /Boa pergunta|vou responder/i);
    assert.match(dashboard.suggestedQuestion ?? "", /Quer que eu mostre|recapitule/i);
  });

  it("keeps honest empty states when no speech was captured", () => {
    const dashboard = buildLivePreviewDashboard({
      recording: false,
      activeSpeaker: "Pessoa 1",
      interimTranscript: "",
      segments: [],
      insights: {
        terms: [],
        importantPoints: [],
        transcriptionIssues: [],
        languageIssues: [],
      },
    });

    assert.equal(dashboard.headline, "Preview ao vivo pausado");
    assert.equal(dashboard.liveLine, "");
    assert.match(dashboard.insightSummary, /Retome a gravacao/i);
    assert.equal(dashboard.relevantInsights.length, 0);
  });
});
