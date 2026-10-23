import { serverEnv } from "./runtime-env";

type ProviderHttpErrorCode = "TIMEOUT" | "NETWORK_ERROR" | "HTTP_ERROR" | "INVALID_JSON";

type ProviderRequestOptions = {
  provider: string;
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  maxErrorBodyChars?: number;
};

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: ProviderHttpErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function providerRequestTimeoutMs(fallback = 30_000) {
  return positiveInteger(serverEnv("EDUCAI_PROVIDER_TIMEOUT_MS"), fallback);
}

function abortReason(signal: AbortSignal | undefined) {
  return signal?.reason instanceof Error ? signal.reason : undefined;
}

function createRequestSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => {
    controller.abort(abortReason(signal) ?? new Error("Provider request aborted."));
  };

  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`Provider request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

export async function requestProviderJson<T extends Record<string, unknown>>({
  provider,
  url,
  init = {},
  timeoutMs = providerRequestTimeoutMs(),
  maxErrorBodyChars = 500,
}: ProviderRequestOptions): Promise<T> {
  const requestSignal = createRequestSignal(init.signal ?? undefined, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: requestSignal.signal,
      });
    } catch (error) {
      if (requestSignal.timedOut()) {
        throw new ProviderHttpError(
          `${provider} request timed out after ${timeoutMs}ms.`,
          provider,
          "TIMEOUT",
        );
      }

      throw new ProviderHttpError(
        `${provider} request failed: ${error instanceof Error ? error.message : String(error)}`,
        provider,
        "NETWORK_ERROR",
      );
    }

    const raw = await response.text();
    if (!response.ok) {
      const detail = raw.trim().slice(0, maxErrorBodyChars);
      throw new ProviderHttpError(
        `${provider} request failed (${response.status})${detail ? `: ${detail}` : "."}`,
        provider,
        "HTTP_ERROR",
        response.status,
      );
    }

    try {
      return JSON.parse(raw.replace(/^\uFEFF/, "")) as T;
    } catch (error) {
      throw new ProviderHttpError(
        `${provider} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        provider,
        "INVALID_JSON",
        response.status,
      );
    }
  } finally {
    requestSignal.dispose();
  }
}
