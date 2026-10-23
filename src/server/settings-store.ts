import type {
  AppSettingsDiarizationMode,
  AppSettingsPatch,
  AppSettingsValues,
  AppSettingsVoiceCaptureMode,
} from "@/lib/voice-intelligence";

type PersistedAppSettings = {
  version: 1;
  savedAt: string;
  values: Partial<{
    database: Partial<AppSettingsValues["database"]>;
    voice: Partial<AppSettingsValues["voice"]>;
    integrations: Partial<AppSettingsValues["integrations"]>;
    security: Partial<AppSettingsValues["security"]>;
    interface: Partial<AppSettingsValues["interface"]>;
    automations: Partial<AppSettingsValues["automations"]>;
  }>;
};

type RuntimeGlobal = typeof globalThis & {
  process?: {
    cwd?: () => string;
    env?: Record<string, string | undefined>;
  };
};

let loaded = false;
let loadPromise: Promise<void> | undefined;
let savePromise: Promise<void> = Promise.resolve();
let cachedValues: PersistedAppSettings["values"] = {};
let cachedUpdatedAt: string | undefined;

async function loadNodeFileSystem() {
  try {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    return { fs, path };
  } catch {
    return null;
  }
}

function now() {
  return new Date().toISOString();
}

function settingsPath(path: typeof import("node:path")) {
  const runtime = globalThis as RuntimeGlobal;
  const cwd = runtime.process?.cwd?.();
  if (!cwd) return undefined;

  return runtime.process?.env?.EDUCAI_APP_SETTINGS_PATH ?? path.join(cwd, ".data", "settings.json");
}

function parsePersistedAppSettings(raw: string): PersistedAppSettings | undefined {
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const data = parsed as Partial<PersistedAppSettings>;
  if (data.version !== 1 || !data.values || typeof data.values !== "object") return undefined;
  return {
    version: 1,
    savedAt: typeof data.savedAt === "string" ? data.savedAt : now(),
    values: data.values,
  };
}

function isPersistenceProvider(
  value: unknown,
): value is AppSettingsValues["database"]["persistenceProvider"] {
  return value === "local" || value === "supabase";
}

function isCaptureMode(value: unknown): value is AppSettingsVoiceCaptureMode {
  return value === "microphone" || value === "microphone_and_system";
}

function isDiarizationMode(value: unknown): value is AppSettingsDiarizationMode {
  return value === "off" || value === "speaker_labels" || value === "speaker_labels_with_names";
}

function isTheme(value: unknown): value is AppSettingsValues["interface"]["theme"] {
  return value === "system" || value === "light" || value === "dark";
}

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

function normalizeValues(values: PersistedAppSettings["values"]): PersistedAppSettings["values"] {
  const next: PersistedAppSettings["values"] = {};

  if (values.database) {
    next.database = {};
    if (isPersistenceProvider(values.database.persistenceProvider)) {
      next.database.persistenceProvider = values.database.persistenceProvider;
    }
    if (typeof values.database.supabaseUrl === "string") {
      next.database.supabaseUrl = normalizeUrl(values.database.supabaseUrl);
    }
  }

  if (values.voice) {
    next.voice = {};
    if (isCaptureMode(values.voice.captureMode)) next.voice.captureMode = values.voice.captureMode;
    if (isDiarizationMode(values.voice.diarizationMode)) {
      next.voice.diarizationMode = values.voice.diarizationMode;
    }
    if (typeof values.voice.preserveSourceTracks === "boolean") {
      next.voice.preserveSourceTracks = values.voice.preserveSourceTracks;
    }
  }

  if (values.integrations) {
    next.integrations = {};
    if (typeof values.integrations.googleMeetEnabled === "boolean") {
      next.integrations.googleMeetEnabled = values.integrations.googleMeetEnabled;
    }
    if (typeof values.integrations.microsoftTeamsEnabled === "boolean") {
      next.integrations.microsoftTeamsEnabled = values.integrations.microsoftTeamsEnabled;
    }
  }

  if (values.security) {
    next.security = {};
    if (values.security.secretStorage === "backend_vault") {
      next.security.secretStorage = "backend_vault";
    }
    if (typeof values.security.encryptedAtRest === "boolean") {
      next.security.encryptedAtRest = values.security.encryptedAtRest;
    }
  }

  if (values.interface) {
    next.interface = {};
    if (typeof values.interface.appLanguage === "string" && values.interface.appLanguage.trim()) {
      next.interface.appLanguage = values.interface.appLanguage.trim();
    }
    if (isTheme(values.interface.theme)) next.interface.theme = values.interface.theme;
  }

  if (values.automations) {
    next.automations = {};
    if (typeof values.automations.enabled === "boolean") {
      next.automations.enabled = values.automations.enabled;
    }
  }

  return next;
}

async function persistSettings() {
  const node = await loadNodeFileSystem();
  if (!node) return;

  const filePath = settingsPath(node.path);
  if (!filePath) return;

  const data: PersistedAppSettings = {
    version: 1,
    savedAt: cachedUpdatedAt ?? now(),
    values: cachedValues,
  };
  const tempPath = `${filePath}.tmp`;

  await node.fs.mkdir(node.path.dirname(filePath), { recursive: true });
  await node.fs.writeFile(tempPath, JSON.stringify(data, null, 2), "utf8");
  await node.fs.rename(tempPath, filePath);
}

export async function ensureAppSettingsLoaded() {
  if (loaded) return;

  loadPromise ??= (async () => {
    const node = await loadNodeFileSystem();
    if (!node) {
      loaded = true;
      return;
    }

    const filePath = settingsPath(node.path);
    if (!filePath) {
      loaded = true;
      return;
    }

    try {
      const raw = await node.fs.readFile(filePath, "utf8");
      const persisted = parsePersistedAppSettings(raw);
      cachedValues = normalizeValues(persisted?.values ?? {});
      cachedUpdatedAt = persisted?.savedAt;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      if (code !== "ENOENT") console.error(error);
      cachedValues = {};
    }

    loaded = true;
  })();

  await loadPromise;
}

export function getAppSettingsUpdatedAt() {
  return cachedUpdatedAt ?? now();
}

export function getAppSettingsRuntimeValue(name: string) {
  if (name === "EDUCAI_PERSISTENCE_PROVIDER") return cachedValues.database?.persistenceProvider;
  if (name === "SUPABASE_URL") return cachedValues.database?.supabaseUrl;
  return undefined;
}

export function getPersistedAppSettingsValues(): PersistedAppSettings["values"] {
  return cachedValues;
}

export async function updatePersistedAppSettings(patch: AppSettingsPatch) {
  await ensureAppSettingsLoaded();

  cachedValues = normalizeValues({
    ...cachedValues,
    database: { ...cachedValues.database, ...patch.database },
    voice: { ...cachedValues.voice, ...patch.voice },
    integrations: { ...cachedValues.integrations, ...patch.integrations },
    security: { ...cachedValues.security, ...patch.security },
    interface: { ...cachedValues.interface, ...patch.interface },
    automations: { ...cachedValues.automations, ...patch.automations },
  });
  cachedUpdatedAt = now();

  savePromise = savePromise.catch(() => undefined).then(() => persistSettings());
  await savePromise;
}
