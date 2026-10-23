import type { AppSettingsSecretName, AppSettingsSecretStatus } from "@/lib/voice-intelligence";
import { serverEnv } from "./runtime-env";

type PersistedSecretEntry = {
  iv: string;
  tag: string;
  ciphertext: string;
  updatedAt: string;
};

type PersistedSecretVault = {
  version: 1;
  savedAt: string;
  secrets: Partial<Record<AppSettingsSecretName, PersistedSecretEntry>>;
};

type RuntimeGlobal = typeof globalThis & {
  process?: {
    cwd?: () => string;
    env?: Record<string, string | undefined>;
  };
};

const secretNames: AppSettingsSecretName[] = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
];

let loaded = false;
let loadPromise: Promise<void> | undefined;
let savePromise: Promise<void> = Promise.resolve();
let persistedSecrets: PersistedSecretVault["secrets"] = {};
let decryptedSecrets: Partial<Record<AppSettingsSecretName, { value: string; updatedAt: string }>> =
  {};

async function loadNodeModules() {
  try {
    const [fs, path, crypto] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
      import("node:crypto"),
    ]);
    return { fs, path, crypto };
  } catch {
    return null;
  }
}

function dataPath(path: typeof import("node:path"), fileName: string) {
  const cwd = (globalThis as RuntimeGlobal).process?.cwd?.();
  return cwd ? path.join(cwd, ".data", fileName) : undefined;
}

function vaultPath(path: typeof import("node:path")) {
  return (
    (globalThis as RuntimeGlobal).process?.env?.EDUCAI_SETTINGS_SECRETS_PATH ??
    dataPath(path, "settings-secrets.json")
  );
}

function masterKeyPath(path: typeof import("node:path")) {
  return (
    (globalThis as RuntimeGlobal).process?.env?.EDUCAI_SETTINGS_MASTER_KEY_PATH ??
    dataPath(path, "settings-master.key")
  );
}

function isSecretName(value: string): value is AppSettingsSecretName {
  return secretNames.includes(value as AppSettingsSecretName);
}

function maskSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

async function getMasterKey(node: NonNullable<Awaited<ReturnType<typeof loadNodeModules>>>) {
  const configured = serverEnv("EDUCAI_SETTINGS_SECRET_KEY")?.trim();
  if (configured) {
    return node.crypto.createHash("sha256").update(configured, "utf8").digest();
  }

  const filePath = masterKeyPath(node.path);
  if (!filePath) return node.crypto.randomBytes(32);

  try {
    const raw = await node.fs.readFile(filePath, "utf8");
    const key = Buffer.from(raw.trim(), "base64");
    if (key.length === 32) return key;
  } catch {
    // Generate the local backend vault key on first use.
  }

  const key = node.crypto.randomBytes(32);
  await node.fs.mkdir(node.path.dirname(filePath), { recursive: true });
  await node.fs.writeFile(filePath, key.toString("base64"), { mode: 0o600 });
  return key;
}

async function encryptSecret(name: AppSettingsSecretName, value: string) {
  const node = await loadNodeModules();
  if (!node) return undefined;

  const key = await getMasterKey(node);
  const iv = node.crypto.randomBytes(12);
  const cipher = node.crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(name, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    updatedAt: new Date().toISOString(),
  } satisfies PersistedSecretEntry;
}

async function decryptSecret(name: AppSettingsSecretName, entry: PersistedSecretEntry) {
  const node = await loadNodeModules();
  if (!node) return undefined;

  const key = await getMasterKey(node);
  const decipher = node.crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(entry.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(name, "utf8"));
  decipher.setAuthTag(Buffer.from(entry.tag, "base64"));
  const value = Buffer.concat([
    decipher.update(Buffer.from(entry.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return value;
}

function parseVault(raw: string): PersistedSecretVault | undefined {
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const data = parsed as Partial<PersistedSecretVault>;
  if (data.version !== 1 || !data.secrets || typeof data.secrets !== "object") return undefined;
  return {
    version: 1,
    savedAt: typeof data.savedAt === "string" ? data.savedAt : new Date().toISOString(),
    secrets: data.secrets,
  };
}

async function persistVault() {
  const node = await loadNodeModules();
  if (!node) return;

  const filePath = vaultPath(node.path);
  if (!filePath) return;

  const data: PersistedSecretVault = {
    version: 1,
    savedAt: new Date().toISOString(),
    secrets: persistedSecrets,
  };
  const tempPath = `${filePath}.tmp`;

  await node.fs.mkdir(node.path.dirname(filePath), { recursive: true });
  await node.fs.writeFile(tempPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  await node.fs.rename(tempPath, filePath);
}

export async function ensureSettingsSecretsLoaded() {
  if (loaded) return;

  loadPromise ??= (async () => {
    const node = await loadNodeModules();
    if (!node) {
      loaded = true;
      return;
    }

    const filePath = vaultPath(node.path);
    if (!filePath) {
      loaded = true;
      return;
    }

    try {
      const raw = await node.fs.readFile(filePath, "utf8");
      persistedSecrets = parseVault(raw)?.secrets ?? {};
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code !== "ENOENT") console.error(error);
      persistedSecrets = {};
    }

    const nextDecrypted: typeof decryptedSecrets = {};
    for (const name of secretNames) {
      const entry = persistedSecrets[name];
      if (!entry) continue;
      try {
        const value = await decryptSecret(name, entry);
        if (value) nextDecrypted[name] = { value, updatedAt: entry.updatedAt };
      } catch (error) {
        console.warn(
          `[educAI] secret ${name} could not be decrypted: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    decryptedSecrets = nextDecrypted;
    loaded = true;
  })();

  await loadPromise;
}

export function getConfiguredSecret(name: AppSettingsSecretName) {
  const envValue = serverEnv(name)?.trim();
  if (envValue) return envValue;
  return decryptedSecrets[name]?.value;
}

export function getSettingsSecretStatuses(): AppSettingsSecretStatus[] {
  return secretNames.map((name) => {
    const envValue = serverEnv(name)?.trim();
    if (envValue) {
      return {
        name,
        configured: true,
        source: "environment",
        maskedValue: maskSecret(envValue),
      };
    }

    const secret = decryptedSecrets[name];
    if (secret?.value) {
      return {
        name,
        configured: true,
        source: "backend_vault",
        maskedValue: maskSecret(secret.value),
        updatedAt: secret.updatedAt,
      };
    }

    return {
      name,
      configured: false,
      source: "missing",
    };
  });
}

export async function updateSettingsSecrets(
  patch: Partial<Record<AppSettingsSecretName, string | null>>,
) {
  await ensureSettingsSecretsLoaded();

  for (const [name, value] of Object.entries(patch)) {
    if (!isSecretName(name)) continue;

    if (value === null || value.trim() === "") {
      delete persistedSecrets[name];
      delete decryptedSecrets[name];
      continue;
    }

    const entry = await encryptSecret(name, value.trim());
    if (!entry) continue;
    persistedSecrets[name] = entry;
    decryptedSecrets[name] = { value: value.trim(), updatedAt: entry.updatedAt };
  }

  savePromise = savePromise.catch(() => undefined).then(() => persistVault());
  await savePromise;
}
