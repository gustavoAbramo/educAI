type RuntimeGlobal = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

type RuntimeEnv = Record<string, unknown>;

let currentRuntimeEnv: RuntimeEnv | undefined;

export function setServerRuntimeEnv(env: unknown) {
  if (env === undefined || env === null) {
    currentRuntimeEnv = undefined;
    return;
  }
  if (typeof env !== "object" || Array.isArray(env)) return;
  currentRuntimeEnv = env as RuntimeEnv;
}

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return undefined;
  return String(value);
}

export function serverEnv(name: string) {
  const processValue = (globalThis as RuntimeGlobal).process?.env?.[name];
  if (processValue?.trim()) return processValue;

  const runtimeValue = asString(currentRuntimeEnv?.[name]);
  if (runtimeValue?.trim()) return runtimeValue;

  const viteEnv = import.meta.env as Record<string, string | undefined> | undefined;
  const viteValue = viteEnv?.[name];
  if (viteValue?.trim()) return viteValue;

  return processValue ?? runtimeValue ?? viteValue;
}
