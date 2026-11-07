import type {
  CloudProviderConnectionStatus,
  CloudProviderConnectionStatusValue,
  ProviderRuntimeCheck,
} from "@/lib/voice-intelligence";
import { geminiInsightsModel } from "./gemini-provider";
import { openAIInsightsModel, openAITranscriptionModel } from "./openai-provider";
import { ProviderHttpError, providerRequestTimeoutMs, requestProviderJson } from "./provider-http";
import { getConfiguredSecret } from "./settings-secrets";

type CloudProviderId = CloudProviderConnectionStatus["provider"];

const geminiModelsUrl = "https://generativelanguage.googleapis.com/v1beta/models";
const openAIModelsUrl = "https://api.openai.com/v1/models";

function check(
  id: string,
  label: string,
  status: ProviderRuntimeCheck["status"],
  detail: string,
): ProviderRuntimeCheck {
  return { id, label, status, detail };
}

function redactSecret(value: string, secret: string | undefined) {
  const trimmed = secret?.trim();
  if (!trimmed) return value;
  return value.split(trimmed).join("[chave redigida]");
}

function failureStatus(error: unknown): CloudProviderConnectionStatusValue {
  if (!(error instanceof ProviderHttpError)) return "unreachable";
  if (error.code === "TIMEOUT" || error.code === "NETWORK_ERROR") return "unreachable";
  if (error.status === 400 || error.status === 401 || error.status === 403) return "invalid_key";
  if (error.status === 429) return "quota_exceeded";
  if (error.status === 404) return "model_unavailable";
  if (typeof error.status === "number" && error.status >= 500) return "model_unavailable";
  return "unreachable";
}

function failureMessage(
  providerLabel: string,
  status: CloudProviderConnectionStatusValue,
  model: string,
) {
  if (status === "invalid_key") {
    return `A chave ${providerLabel} foi recusada pela API. Confira ou gere uma nova chave.`;
  }
  if (status === "quota_exceeded") {
    return `A chave ${providerLabel} foi aceita, mas a cota ou o limite de requisicoes foi atingido.`;
  }
  if (status === "model_unavailable") {
    return `A chave ${providerLabel} foi aceita, mas o modelo ${model} nao esta disponivel agora.`;
  }
  return `Nao foi possivel alcancar a API do ${providerLabel}. Verifique a rede e tente novamente.`;
}

function credentialCheck(
  status: CloudProviderConnectionStatusValue,
  providerLabel: string,
): ProviderRuntimeCheck {
  if (status === "invalid_key") {
    return check("credential", "Credencial", "fail", `A API recusou a chave ${providerLabel}.`);
  }
  if (status === "unreachable") {
    return check(
      "credential",
      "Credencial",
      "warn",
      "A chave nao pode ser validada porque a API nao respondeu.",
    );
  }
  return check("credential", "Credencial", "pass", `A chave ${providerLabel} foi aceita pela API.`);
}

function missingKeyStatus(
  provider: CloudProviderId,
  envName: "GEMINI_API_KEY" | "OPENAI_API_KEY",
  model: string,
  providerLabel: string,
): CloudProviderConnectionStatus {
  return {
    provider,
    checkedAt: new Date().toISOString(),
    status: "missing_key",
    configured: false,
    model,
    latencyMs: 0,
    checks: [check("credential", "Credencial", "fail", `${envName} nao configurada no backend.`)],
    message: `Configure a chave ${envName} para testar o ${providerLabel}.`,
  };
}

export async function getGeminiConnectionStatus(): Promise<CloudProviderConnectionStatus> {
  const startedAt = Date.now();
  const model = geminiInsightsModel();
  const key = getConfiguredSecret("GEMINI_API_KEY")?.trim();

  if (!key) {
    return missingKeyStatus("gemini", "GEMINI_API_KEY", model, "Gemini");
  }

  try {
    await requestProviderJson({
      provider: "Gemini",
      url: `${geminiModelsUrl}/${encodeURIComponent(model)}:generateContent`,
      timeoutMs: providerRequestTimeoutMs(20_000),
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Responda apenas com a palavra ok." }] }],
          generationConfig: { maxOutputTokens: 16, temperature: 0 },
        }),
      },
    });

    const latencyMs = Date.now() - startedAt;
    return {
      provider: "gemini",
      checkedAt: new Date().toISOString(),
      status: "ready",
      configured: true,
      model,
      latencyMs,
      checks: [
        check("credential", "Credencial", "pass", "A chave Gemini foi aceita pela API."),
        check("model", "Modelo", "pass", `O modelo ${model} respondeu em ${latencyMs}ms.`),
      ],
      message: `Gemini conectado com o modelo ${model}.`,
    };
  } catch (error) {
    const status = failureStatus(error);
    const latencyMs = Date.now() - startedAt;
    const detail = redactSecret(error instanceof Error ? error.message : String(error), key);

    return {
      provider: "gemini",
      checkedAt: new Date().toISOString(),
      status,
      configured: true,
      model,
      latencyMs,
      checks: [
        credentialCheck(status, "Gemini"),
        check(
          "model",
          "Modelo",
          status === "model_unavailable" ? "fail" : "warn",
          status === "model_unavailable" ? detail : `O modelo ${model} nao pode ser validado.`,
        ),
      ],
      message: failureMessage("Gemini", status, model),
    };
  }
}

export async function getOpenAIConnectionStatus(): Promise<CloudProviderConnectionStatus> {
  const startedAt = Date.now();
  const configuredModels = Array.from(
    new Set([openAITranscriptionModel(), openAIInsightsModel()].map((item) => item.trim())),
  ).filter(Boolean);
  const model = configuredModels[0] ?? "gpt-4o-mini";
  const key = getConfiguredSecret("OPENAI_API_KEY")?.trim();

  if (!key) {
    return missingKeyStatus("openai", "OPENAI_API_KEY", model, "OpenAI");
  }

  try {
    const result = await requestProviderJson<{ data?: unknown }>({
      provider: "OpenAI",
      url: openAIModelsUrl,
      timeoutMs: providerRequestTimeoutMs(20_000),
      init: {
        method: "GET",
        headers: {
          authorization: `Bearer ${key}`,
        },
      },
    });

    const availableModels = Array.isArray(result.data)
      ? result.data
          .map((item) =>
            item && typeof item === "object" ? (item as Record<string, unknown>).id : undefined,
          )
          .filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
    const missingModels = configuredModels.filter((item) => !availableModels.includes(item));
    const latencyMs = Date.now() - startedAt;

    return {
      provider: "openai",
      checkedAt: new Date().toISOString(),
      status: missingModels.length > 0 ? "model_unavailable" : "ready",
      configured: true,
      model,
      latencyMs,
      checks: [
        check("credential", "Credencial", "pass", "A chave OpenAI foi aceita pela API."),
        check(
          "model",
          "Modelo",
          missingModels.length > 0 ? "warn" : "pass",
          missingModels.length > 0
            ? `Nao encontrado(s) na conta: ${missingModels.join(", ")}.`
            : `Modelo(s) configurado(s) disponivel(is): ${configuredModels.join(", ")}.`,
        ),
      ],
      message:
        missingModels.length > 0
          ? `OpenAI conectado, mas ${missingModels.join(", ")} nao aparece(m) na conta.`
          : "OpenAI conectado e modelos configurados disponiveis.",
    };
  } catch (error) {
    const status = failureStatus(error);
    const latencyMs = Date.now() - startedAt;
    const detail = redactSecret(error instanceof Error ? error.message : String(error), key);

    return {
      provider: "openai",
      checkedAt: new Date().toISOString(),
      status,
      configured: true,
      model,
      latencyMs,
      checks: [
        credentialCheck(status, "OpenAI"),
        check(
          "model",
          "Modelo",
          status === "invalid_key" ? "warn" : "fail",
          status === "invalid_key"
            ? "O modelo nao pode ser verificado sem uma chave valida."
            : detail,
        ),
      ],
      message: failureMessage("OpenAI", status, model),
    };
  }
}
