import type { SessionRecord } from "@/lib/voice-intelligence";

type PersistedVoiceData = {
  version: 1;
  savedAt: string;
  records: SessionRecord[];
};

type RuntimeGlobal = typeof globalThis & {
  process?: {
    cwd?: () => string;
    env?: Record<string, string | undefined>;
  };
};

async function loadNodeFileSystem() {
  try {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    return { fs, path };
  } catch {
    return null;
  }
}

function getStorePath(path: typeof import("node:path")) {
  const runtime = globalThis as RuntimeGlobal;
  const cwd = runtime.process?.cwd?.();
  if (!cwd) return undefined;

  return (
    runtime.process?.env?.EDUCAI_VOICE_STORE_PATH ?? path.join(cwd, ".data", "voice-sessions.json")
  );
}

function isPersistedVoiceData(value: unknown): value is PersistedVoiceData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<PersistedVoiceData>;
  return data.version === 1 && Array.isArray(data.records);
}

function parsePersistedVoiceData(raw: string) {
  return JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
}

export async function loadPersistedVoiceSessions(): Promise<SessionRecord[] | undefined> {
  const node = await loadNodeFileSystem();
  if (!node) return undefined;

  const filePath = getStorePath(node.path);
  if (!filePath) return undefined;

  try {
    const raw = await node.fs.readFile(filePath, "utf8");
    const parsed = parsePersistedVoiceData(raw);
    return isPersistedVoiceData(parsed) ? parsed.records : undefined;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") {
      console.error(error);
    }
    return undefined;
  }
}

export async function savePersistedVoiceSessions(records: SessionRecord[]) {
  const node = await loadNodeFileSystem();
  if (!node) return;

  const filePath = getStorePath(node.path);
  if (!filePath) return;

  const data: PersistedVoiceData = {
    version: 1,
    savedAt: new Date().toISOString(),
    records,
  };
  const tempPath = `${filePath}.tmp`;

  await node.fs.mkdir(node.path.dirname(filePath), { recursive: true });
  await node.fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await node.fs.rename(tempPath, filePath);
}
