import * as assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { normalizeLocalProviderBaseUrl } from "./provider-endpoint";

const originalRemoteSetting = process.env.EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS;

afterEach(() => {
  if (originalRemoteSetting === undefined) {
    delete process.env.EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS;
  } else {
    process.env.EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS = originalRemoteSetting;
  }
});

describe("local provider endpoint validation", () => {
  it("accepts localhost and private network endpoints", () => {
    assert.equal(
      normalizeLocalProviderBaseUrl("http://localhost:11434/", "Ollama"),
      "http://localhost:11434",
    );
    assert.equal(
      normalizeLocalProviderBaseUrl("http://192.168.1.20:8765", "Faster-Whisper"),
      "http://192.168.1.20:8765",
    );
  });

  it("rejects unsafe protocols, credentials, and public endpoints by default", () => {
    assert.throws(
      () => normalizeLocalProviderBaseUrl("file:///tmp/runtime", "Ollama"),
      /http or https/i,
    );
    assert.throws(
      () => normalizeLocalProviderBaseUrl("http://user:pass@localhost:11434", "Ollama"),
      /must not include credentials/i,
    );
    assert.throws(
      () => normalizeLocalProviderBaseUrl("https://example.com", "Ollama"),
      /localhost or a private network/i,
    );
  });

  it("allows an explicitly enabled remote provider endpoint", () => {
    process.env.EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS = "true";
    assert.equal(
      normalizeLocalProviderBaseUrl("https://runtime.example.com/", "Ollama"),
      "https://runtime.example.com",
    );
  });
});
