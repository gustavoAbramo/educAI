import type {
  ProviderCapabilityKey,
  ProviderCapabilityRuntimeStatus,
  ProviderRuntimeHealthEnvelope,
  ProviderRuntimeHealthHistoryEntry,
  ProviderRuntimeHealthHistoryEnvelope,
} from "@/lib/voice-intelligence";

type RuntimeGlobal = typeof globalThis & {
  process?: {
    cwd?: () => string;
    env?: Record<string, string | undefined>;
  };
};

type PersistedRuntimeHistory = {
  version: 1;
  savedAt: string;
  entries: ProviderRuntimeHealthHistoryEntry[];
};

const maxHistoryEntries = 30;

async function loadNodeFileSystem() {
  try {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    return { fs, path };
  } catch {
    return null;
  }
}

function getHistoryPath(path: typeof import("node:path")) {
  const runtime = globalThis as RuntimeGlobal;
  const cwd = runtime.process?.cwd?.();
  if (!cwd) return undefined;

  return (
    runtime.process?.env?.EDUCAI_RUNTIME_HISTORY_PATH ??
    path.join(cwd, ".data", "runtime-diagnostics.json")
  );
}

function isPersistedRuntimeHistory(value: unknown): value is PersistedRuntimeHistory {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<PersistedRuntimeHistory>;
  return data.version === 1 && Array.isArray(data.entries);
}

function compactIssueList(health: ProviderRuntimeHealthEnvelope) {
  return [
    ...health.offlineReadiness.issues,
    ...health.capabilities.flatMap((capability) => capability.issues),
  ].filter(Boolean);
}

function historyEntryFromHealth(
  health: ProviderRuntimeHealthEnvelope,
): ProviderRuntimeHealthHistoryEntry {
  const issues = compactIssueList(health);
  const capabilityStatus = Object.fromEntries(
    health.capabilities.map((capability) => [capability.capability, capability.status]),
  ) as Record<ProviderCapabilityKey, ProviderCapabilityRuntimeStatus>;

  return {
    id: `runtime_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    checkedAt: health.checkedAt,
    offlineStatus: health.offlineReadiness.status,
    offlineSummary: health.offlineReadiness.summary,
    capabilityStatus,
    ollamaStatus: health.localProviders.ollama.status,
    fasterWhisperStatus: health.localProviders.fasterWhisper.status,
    fasterWhisperSmokeReady: health.localProviders.fasterWhisper.smokeTranscriptionReady,
    fasterWhisperDiarizationReady: health.localProviders.fasterWhisper.smokeDiarizationReady,
    issueCount: issues.length,
    firstIssue: issues[0],
  };
}

async function readHistory(): Promise<ProviderRuntimeHealthHistoryEntry[]> {
  const node = await loadNodeFileSystem();
  if (!node) return [];

  const filePath = getHistoryPath(node.path);
  if (!filePath) return [];

  try {
    const raw = await node.fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    return isPersistedRuntimeHistory(parsed) ? parsed.entries : [];
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") {
      console.error(error);
    }
    return [];
  }
}

async function writeHistory(entries: ProviderRuntimeHealthHistoryEntry[]) {
  const node = await loadNodeFileSystem();
  if (!node) return;

  const filePath = getHistoryPath(node.path);
  if (!filePath) return;

  const data: PersistedRuntimeHistory = {
    version: 1,
    savedAt: new Date().toISOString(),
    entries,
  };
  const tempPath = `${filePath}.tmp`;

  await node.fs.mkdir(node.path.dirname(filePath), { recursive: true });
  await node.fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await node.fs.rename(tempPath, filePath);
}

export async function appendProviderRuntimeHealthHistory(health: ProviderRuntimeHealthEnvelope) {
  const entries = await readHistory();
  const nextEntries = [historyEntryFromHealth(health), ...entries].slice(0, maxHistoryEntries);
  await writeHistory(nextEntries);
  return nextEntries[0];
}

export async function getProviderRuntimeHealthHistory(): Promise<ProviderRuntimeHealthHistoryEnvelope> {
  return {
    entries: await readHistory(),
  };
}
