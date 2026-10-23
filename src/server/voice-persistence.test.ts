import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { SessionRecord } from "@/lib/voice-intelligence";
import {
  loadVoiceSessionsFromPersistence,
  saveVoiceSessionsToPersistence,
  selectedVoicePersistenceProvider,
  voicePersistenceStatus,
} from "./voice-persistence";

const originalFetch = globalThis.fetch;
const originalProvider = process.env.EDUCAI_PERSISTENCE_PROVIDER;
const originalUrl = process.env.SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalSecretKey = process.env.SUPABASE_SECRET_KEY;
const originalStorePath = process.env.EDUCAI_VOICE_STORE_PATH;

function restoreEnv() {
  if (originalProvider === undefined) delete process.env.EDUCAI_PERSISTENCE_PROVIDER;
  else process.env.EDUCAI_PERSISTENCE_PROVIDER = originalProvider;

  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;

  if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;

  if (originalSecretKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalSecretKey;

  if (originalStorePath === undefined) delete process.env.EDUCAI_VOICE_STORE_PATH;
  else process.env.EDUCAI_VOICE_STORE_PATH = originalStorePath;
}

afterEach(() => {
  restoreEnv();
  globalThis.fetch = originalFetch;
});

describe("voice persistence provider", () => {
  it("uses local persistence by default", () => {
    delete process.env.EDUCAI_PERSISTENCE_PROVIDER;

    assert.equal(selectedVoicePersistenceProvider(), "local");
    assert.deepEqual(voicePersistenceStatus(), {
      provider: "local",
      configured: true,
    });
  });

  it("reports unconfigured Supabase when selected without credentials", () => {
    process.env.EDUCAI_PERSISTENCE_PROVIDER = "supabase";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;

    assert.equal(selectedVoicePersistenceProvider(), "supabase");
    assert.deepEqual(voicePersistenceStatus(), {
      provider: "supabase",
      configured: false,
    });
  });

  it("loads and saves the voice store through Supabase REST when configured", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const records = [] as SessionRecord[];

    process.env.EDUCAI_PERSISTENCE_PROVIDER = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (init?.method === "POST") {
        assert.match(url, /\/rest\/v1\/educai_voice_store\?on_conflict=id$/);
        assert.equal(
          (init.headers as Record<string, string>).authorization,
          "Bearer service-role-key",
        );
        assert.equal(
          (init.headers as Record<string, string>).prefer,
          "resolution=merge-duplicates",
        );
        return new Response(null, { status: 201 });
      }

      assert.match(url, /\/rest\/v1\/educai_voice_store\?id=eq.default&select=data$/);
      return Response.json([
        { data: { version: 1, savedAt: "2026-06-16T00:00:00.000Z", records } },
      ]);
    }) as typeof fetch;

    assert.deepEqual(await loadVoiceSessionsFromPersistence(), records);
    await saveVoiceSessionsToPersistence(records);

    assert.equal(calls.length, 2);
  });
});
