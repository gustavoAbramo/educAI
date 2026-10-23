import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { answerAssistantMessage } from "./assistant-service";

const originalFetch = globalThis.fetch;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalWebSearch = process.env.EDUCAI_ASSISTANT_WEB_SEARCH;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalOpenAIKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalOpenAIKey;
  }

  if (originalWebSearch === undefined) {
    delete process.env.EDUCAI_ASSISTANT_WEB_SEARCH;
  } else {
    process.env.EDUCAI_ASSISTANT_WEB_SEARCH = originalWebSearch;
  }
});

describe("answerAssistantMessage", () => {
  it("keeps stable knowledge answers local even when OpenAI is configured", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("provider should not be called for stable local knowledge");
    }) as typeof fetch;

    const response = await answerAssistantMessage({
      message: "O que e porcentagem?",
      mode: "student",
      context: {
        recording: false,
        transcriptSegments: [],
        interimTranscript: "",
        insights: {
          terms: [],
          transcriptionIssues: [],
          importantPoints: [],
          languageIssues: [],
        },
      },
    });

    assert.equal(response.meta.source, "local");
    assert.equal(fetchCalled, false);
    assert.match(response.content, /porcentagem/i);
  });

  it("keeps contextual lesson answers local when transcript context exists", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("provider should not be called for contextual lesson answer");
    }) as typeof fetch;

    const response = await answerAssistantMessage({
      message: "Resuma a aula ate agora.",
      mode: "student",
      context: {
        recording: true,
        transcriptSegments: [
          {
            speakerName: "Professora Ana",
            text: "Hoje vimos porcentagem, fracao e como aplicar isso em descontos.",
          },
        ],
        interimTranscript: "",
        insights: {
          terms: ["porcentagem", "fracao"],
          transcriptionIssues: [],
          importantPoints: ["Porcentagem representa partes de cada cem."],
          languageIssues: [],
        },
      },
    });

    assert.equal(response.meta.source, "local");
    assert.equal(fetchCalled, false);
    assert.match(response.content, /Resumo/i);
  });

  it("still uses provider for freshness-sensitive questions", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.EDUCAI_ASSISTANT_WEB_SEARCH = "on";
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response(
        JSON.stringify({
          output_text: "Hoje a principal noticia economica foi a queda de um indicador recente.",
          output: [
            {
              type: "web_search_call",
              results: [{ title: "Indicador", url: "https://example.com/indicador" }],
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const response = await answerAssistantMessage({
      message: "Qual foi uma noticia positiva de hoje na economia?",
      mode: "student",
      context: {
        recording: false,
        transcriptSegments: [],
        interimTranscript: "",
        insights: {
          terms: [],
          transcriptionIssues: [],
          importantPoints: [],
          languageIssues: [],
        },
      },
    });

    assert.equal(fetchCalled, true);
    assert.equal(response.meta.source, "provider");
    assert.equal(response.meta.usedWebSearch, true);
    assert.match(response.content, /noticia/i);
  });
});
