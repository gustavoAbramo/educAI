import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getGeminiConnectionStatus, getOpenAIConnectionStatus } from "./cloud-provider-status";

const originalFetch = globalThis.fetch;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalGeminiInsights = process.env.GEMINI_INSIGHTS_MODEL;
const originalGeminiTranscribe = process.env.GEMINI_TRANSCRIBE_MODEL;
const originalOpenAIInsights = process.env.OPENAI_INSIGHTS_MODEL;
const originalOpenAITranscribe = process.env.OPENAI_TRANSCRIBE_MODEL;

type FetchCall = { url: string; init?: RequestInit };

function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return calls;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_INSIGHTS_MODEL;
  delete process.env.GEMINI_TRANSCRIBE_MODEL;
  delete process.env.OPENAI_INSIGHTS_MODEL;
  delete process.env.OPENAI_TRANSCRIBE_MODEL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv("GEMINI_API_KEY", originalGeminiKey);
  restoreEnv("OPENAI_API_KEY", originalOpenAIKey);
  restoreEnv("GEMINI_INSIGHTS_MODEL", originalGeminiInsights);
  restoreEnv("GEMINI_TRANSCRIBE_MODEL", originalGeminiTranscribe);
  restoreEnv("OPENAI_INSIGHTS_MODEL", originalOpenAIInsights);
  restoreEnv("OPENAI_TRANSCRIBE_MODEL", originalOpenAITranscribe);
});

describe("getGeminiConnectionStatus", () => {
  it("reports missing_key without calling the API", async () => {
    const calls = stubFetch(() => jsonResponse({}));

    const status = await getGeminiConnectionStatus();

    assert.equal(status.status, "missing_key");
    assert.equal(status.configured, false);
    assert.equal(calls.length, 0);
    assert.match(status.message, /GEMINI_API_KEY/);
  });

  it("reports ready when the configured model answers", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.GEMINI_INSIGHTS_MODEL = "gemini-test-model";
    const calls = stubFetch(() => jsonResponse({ candidates: [] }));

    const status = await getGeminiConnectionStatus();

    assert.equal(status.status, "ready");
    assert.equal(status.configured, true);
    assert.equal(status.model, "gemini-test-model");
    assert.ok(status.latencyMs >= 0);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /gemini-test-model:generateContent$/);
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers["x-goog-api-key"], "gemini-test-key");
    assert.equal(status.checks.find((item) => item.id === "credential")?.status, "pass");
  });

  it("reports invalid_key when the API rejects the credential", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    stubFetch(() => jsonResponse({ error: { message: "API key not valid." } }, 400));

    const status = await getGeminiConnectionStatus();

    assert.equal(status.status, "invalid_key");
    assert.equal(status.checks.find((item) => item.id === "credential")?.status, "fail");
  });

  it("reports model_unavailable for transient upstream failures", async () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    process.env.GEMINI_INSIGHTS_MODEL = "gemini-high-demand";
    stubFetch(() => jsonResponse({ error: { message: "high demand" } }, 503));

    const status = await getGeminiConnectionStatus();

    assert.equal(status.status, "model_unavailable");
    assert.match(status.message, /gemini-high-demand/);
  });

  it("reports unreachable on network errors and never leaks the key", async () => {
    process.env.GEMINI_API_KEY = "super-secret-gemini-key";
    stubFetch(() => {
      throw new Error("socket failed for super-secret-gemini-key");
    });

    const status = await getGeminiConnectionStatus();

    assert.equal(status.status, "unreachable");
    const serialized = JSON.stringify(status);
    assert.equal(serialized.includes("super-secret-gemini-key"), false);
  });

  it("redacts the key when an upstream error body echoes it", async () => {
    process.env.GEMINI_API_KEY = "super-secret-gemini-key";
    process.env.GEMINI_INSIGHTS_MODEL = "gemini-redacted-model";
    stubFetch(() => jsonResponse({ error: { message: "boom super-secret-gemini-key" } }, 500));

    const status = await getGeminiConnectionStatus();

    assert.equal(status.status, "model_unavailable");
    const serialized = JSON.stringify(status);
    assert.equal(serialized.includes("super-secret-gemini-key"), false);
    assert.match(serialized, /chave redigida/);
  });
});

describe("getOpenAIConnectionStatus", () => {
  it("reports missing_key without calling the API", async () => {
    const calls = stubFetch(() => jsonResponse({ data: [] }));

    const status = await getOpenAIConnectionStatus();

    assert.equal(status.status, "missing_key");
    assert.equal(status.configured, false);
    assert.equal(calls.length, 0);
    assert.match(status.message, /OPENAI_API_KEY/);
  });

  it("reports ready when the configured models are available", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.OPENAI_INSIGHTS_MODEL = "gpt-test-insights";
    process.env.OPENAI_TRANSCRIBE_MODEL = "gpt-test-transcribe";
    const calls = stubFetch(() =>
      jsonResponse({
        data: [{ id: "gpt-test-insights" }, { id: "gpt-test-transcribe" }],
      }),
    );

    const status = await getOpenAIConnectionStatus();

    assert.equal(status.status, "ready");
    assert.equal(status.configured, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/v1\/models$/);
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer openai-test-key");
    assert.equal(status.checks.find((item) => item.id === "model")?.status, "pass");
  });

  it("reports model_unavailable when a configured model is not present in the account", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    process.env.OPENAI_INSIGHTS_MODEL = "gpt-test-insights";
    process.env.OPENAI_TRANSCRIBE_MODEL = "gpt-test-transcribe";
    stubFetch(() => jsonResponse({ data: [{ id: "gpt-test-insights" }] }));

    const status = await getOpenAIConnectionStatus();

    assert.equal(status.status, "model_unavailable");
    const modelCheck = status.checks.find((item) => item.id === "model");
    assert.equal(modelCheck?.status, "warn");
    assert.match(modelCheck?.detail ?? "", /gpt-test-transcribe/);
  });

  it("reports invalid_key when the API rejects the credential", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    stubFetch(() => jsonResponse({ error: { message: "Incorrect API key." } }, 401));

    const status = await getOpenAIConnectionStatus();

    assert.equal(status.status, "invalid_key");
    assert.equal(status.checks.find((item) => item.id === "credential")?.status, "fail");
  });

  it("reports quota_exceeded for rate limit responses", async () => {
    process.env.OPENAI_API_KEY = "openai-test-key";
    stubFetch(() => jsonResponse({ error: { message: "rate limit" } }, 429));

    const status = await getOpenAIConnectionStatus();

    assert.equal(status.status, "quota_exceeded");
  });
});
