import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

let tempRoot = "";

const originalAppSettingsPath = process.env.EDUCAI_APP_SETTINGS_PATH;
const originalSecretsPath = process.env.EDUCAI_SETTINGS_SECRETS_PATH;
const originalMasterKeyPath = process.env.EDUCAI_SETTINGS_MASTER_KEY_PATH;
const originalProviderSettingsPath = process.env.EDUCAI_PROVIDER_SETTINGS_PATH;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalProvider = process.env.EDUCAI_PERSISTENCE_PROVIDER;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalFetch = globalThis.fetch;

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "educai-settings-"));
  process.env.EDUCAI_APP_SETTINGS_PATH = path.join(tempRoot, "settings.json");
  process.env.EDUCAI_SETTINGS_SECRETS_PATH = path.join(tempRoot, "settings-secrets.json");
  process.env.EDUCAI_SETTINGS_MASTER_KEY_PATH = path.join(tempRoot, "settings-master.key");
  process.env.EDUCAI_PROVIDER_SETTINGS_PATH = path.join(tempRoot, "provider-settings.json");
  delete process.env.OPENAI_API_KEY;
  delete process.env.EDUCAI_PERSISTENCE_PROVIDER;
  delete process.env.SUPABASE_URL;
});

after(async () => {
  if (originalAppSettingsPath === undefined) delete process.env.EDUCAI_APP_SETTINGS_PATH;
  else process.env.EDUCAI_APP_SETTINGS_PATH = originalAppSettingsPath;

  if (originalSecretsPath === undefined) delete process.env.EDUCAI_SETTINGS_SECRETS_PATH;
  else process.env.EDUCAI_SETTINGS_SECRETS_PATH = originalSecretsPath;

  if (originalMasterKeyPath === undefined) delete process.env.EDUCAI_SETTINGS_MASTER_KEY_PATH;
  else process.env.EDUCAI_SETTINGS_MASTER_KEY_PATH = originalMasterKeyPath;

  if (originalProviderSettingsPath === undefined) delete process.env.EDUCAI_PROVIDER_SETTINGS_PATH;
  else process.env.EDUCAI_PROVIDER_SETTINGS_PATH = originalProviderSettingsPath;

  if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAIKey;

  if (originalProvider === undefined) delete process.env.EDUCAI_PERSISTENCE_PROVIDER;
  else process.env.EDUCAI_PERSISTENCE_PROVIDER = originalProvider;

  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;

  globalThis.fetch = originalFetch;

  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

describe("settings center", () => {
  it("persists categories and keeps secrets masked outside the backend vault", async () => {
    const { getAppSettingsCenter, updateAppSettingsCenter } = await import("./settings-center");
    const { getConfiguredSecret } = await import("./settings-secrets");
    const { providerHasOpenAIKey } = await import("./provider-runtime");

    const saved = await updateAppSettingsCenter({
      database: {
        persistenceProvider: "supabase",
        supabaseUrl: "https://example.supabase.co/",
      },
      voice: {
        captureMode: "microphone_and_system",
        diarizationMode: "speaker_labels_with_names",
        preserveSourceTracks: true,
      },
      secrets: {
        OPENAI_API_KEY: "sk-test-secret-123456",
        SUPABASE_SERVICE_ROLE_KEY: "supabase-service-role-secret",
      },
    });

    assert.equal(saved.values.database.persistenceProvider, "supabase");
    assert.equal(saved.values.database.supabaseUrl, "https://example.supabase.co");
    assert.equal(saved.values.voice.captureMode, "microphone_and_system");
    assert.equal(saved.values.voice.diarizationMode, "speaker_labels_with_names");
    assert.equal(getConfiguredSecret("OPENAI_API_KEY"), "sk-test-secret-123456");
    assert.equal(providerHasOpenAIKey(), true);

    const reloaded = await getAppSettingsCenter();
    const asJson = JSON.stringify(reloaded);
    assert.match(asJson, /sk-t\.\.\.3456/);
    assert.doesNotMatch(asJson, /sk-test-secret-123456/);
    assert.doesNotMatch(asJson, /supabase-service-role-secret/);
  });

  it("validates Supabase persistence through the backend REST configuration", async () => {
    const { updateAppSettingsCenter, validateAppSettingsCenter } =
      await import("./settings-center");

    await updateAppSettingsCenter({
      database: {
        persistenceProvider: "supabase",
        supabaseUrl: "https://example.supabase.co",
      },
      secrets: {
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
    });

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      assert.match(url, /\/rest\/v1\/educai_voice_store\?select=id&limit=1$/);
      assert.equal(
        (init?.headers as Record<string, string>).authorization,
        "Bearer service-role-key",
      );
      return Response.json([]);
    }) as typeof fetch;

    const validation = await validateAppSettingsCenter();
    const supabase = validation.checks.find((check) => check.id === "database.supabase");

    assert.equal(supabase?.status, "ready");
    assert.match(supabase?.detail ?? "", /educai_voice_store/);
  });
});
