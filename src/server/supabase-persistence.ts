import type { SessionRecord } from "@/lib/voice-intelligence";
import { serverEnv } from "./runtime-env";
import { getAppSettingsRuntimeValue } from "./settings-store";
import { getConfiguredSecret } from "./settings-secrets";

type PersistedVoiceData = {
  version: 1;
  savedAt: string;
  records: SessionRecord[];
};

const tableName = "educai_voice_store";
const storeId = "default";

function supabaseConfig() {
  const url = (serverEnv("SUPABASE_URL") ?? getAppSettingsRuntimeValue("SUPABASE_URL"))?.replace(
    /\/+$/,
    "",
  );
  const key =
    getConfiguredSecret("SUPABASE_SERVICE_ROLE_KEY") ?? getConfiguredSecret("SUPABASE_SECRET_KEY");

  if (!url || !key) return undefined;
  return { url, key };
}

function supabaseHeaders(key: string) {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

function isPersistedVoiceData(value: unknown): value is PersistedVoiceData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<PersistedVoiceData>;
  return data.version === 1 && Array.isArray(data.records);
}

async function readError(response: Response) {
  const text = await response.text().catch(() => "");
  return text || `${response.status} ${response.statusText}`;
}

export function isSupabasePersistenceConfigured() {
  return Boolean(supabaseConfig());
}

export async function checkSupabaseVoiceStoreConnection() {
  const config = supabaseConfig();
  const checkedAt = new Date().toISOString();

  if (!config) {
    return {
      checkedAt,
      status: "attention" as const,
      detail: "Supabase nao esta configurado com URL e chave de servidor.",
    };
  }

  const startedAt = Date.now();
  const response = await fetch(`${config.url}/rest/v1/${tableName}?select=id&limit=1`, {
    headers: supabaseHeaders(config.key),
  });
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    return {
      checkedAt,
      status: "blocked" as const,
      detail: `Supabase respondeu erro: ${await readError(response)}`,
      latencyMs,
    };
  }

  return {
    checkedAt,
    status: "ready" as const,
    detail: `Tabela ${tableName} acessivel pela Data API com credencial de servidor.`,
    latencyMs,
  };
}

export async function loadSupabaseVoiceSessions(): Promise<SessionRecord[] | undefined> {
  const config = supabaseConfig();
  if (!config) return undefined;

  const response = await fetch(
    `${config.url}/rest/v1/${tableName}?id=eq.${encodeURIComponent(storeId)}&select=data`,
    {
      headers: supabaseHeaders(config.key),
    },
  );

  if (!response.ok) {
    throw new Error(`SUPABASE_LOAD_FAILED: ${await readError(response)}`);
  }

  const rows = (await response.json()) as Array<{ data?: unknown }>;
  const data = rows[0]?.data;
  return isPersistedVoiceData(data) ? data.records : undefined;
}

export async function saveSupabaseVoiceSessions(records: SessionRecord[]) {
  const config = supabaseConfig();
  if (!config) return;

  const data: PersistedVoiceData = {
    version: 1,
    savedAt: new Date().toISOString(),
    records,
  };

  const response = await fetch(`${config.url}/rest/v1/${tableName}?on_conflict=id`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config.key),
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: storeId,
      data,
      updated_at: data.savedAt,
    }),
  });

  if (!response.ok) {
    throw new Error(`SUPABASE_SAVE_FAILED: ${await readError(response)}`);
  }
}
