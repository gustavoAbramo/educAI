import type {
  AppSettingsCategory,
  AppSettingsCenterEnvelope,
  AppSettingsField,
  AppSettingsPatch,
  AppSettingsStatus,
  AppSettingsValidationCheck,
  AppSettingsValidationEnvelope,
  AppSettingsValues,
} from "@/lib/voice-intelligence";
import { getProviderRuntimeConfig, updateProviderRuntimeConfig } from "./provider-runtime";
import { getProviderRuntimeHealth } from "./provider-runtime-health";
import {
  ensureAppSettingsLoaded,
  getAppSettingsUpdatedAt,
  getPersistedAppSettingsValues,
  updatePersistedAppSettings,
} from "./settings-store";
import {
  ensureSettingsSecretsLoaded,
  getConfiguredSecret,
  getSettingsSecretStatuses,
  updateSettingsSecrets,
} from "./settings-secrets";
import { serverEnv } from "./runtime-env";
import { checkSupabaseVoiceStoreConnection } from "./supabase-persistence";

function statusFromRequired(configured: boolean): AppSettingsStatus {
  return configured ? "ready" : "attention";
}

function categoryStatus(fields: AppSettingsField[]): AppSettingsStatus {
  if (fields.some((field) => field.status === "blocked")) return "blocked";
  if (fields.some((field) => field.status === "attention")) return "attention";
  if (fields.every((field) => field.status === "ready")) return "ready";
  return "unknown";
}

function validationStatus(checks: AppSettingsValidationCheck[]): AppSettingsStatus {
  if (checks.some((check) => check.status === "blocked")) return "blocked";
  if (checks.some((check) => check.status === "attention")) return "attention";
  if (checks.some((check) => check.status === "ready")) return "ready";
  return "unknown";
}

function field(input: Omit<AppSettingsField, "status"> & { status?: AppSettingsStatus }) {
  return {
    ...input,
    status: input.status ?? "unknown",
  } satisfies AppSettingsField;
}

function category(input: Omit<AppSettingsCategory, "status">) {
  return {
    ...input,
    status: categoryStatus(input.fields),
  } satisfies AppSettingsCategory;
}

function secretConfigured(name: Parameters<typeof getConfiguredSecret>[0]) {
  return Boolean(getConfiguredSecret(name)?.trim());
}

function settingFromEnvOrStore(name: string, storedValue = "") {
  return serverEnv(name)?.trim() || storedValue;
}

function buildValues(): AppSettingsValues {
  const provider = getProviderRuntimeConfig();
  const stored = getPersistedAppSettingsValues();
  const persistenceProvider =
    (serverEnv(
      "EDUCAI_PERSISTENCE_PROVIDER",
    )?.trim() as AppSettingsValues["database"]["persistenceProvider"]) ||
    stored.database?.persistenceProvider ||
    "local";

  return {
    ai: {
      transcriptionProvider: provider.settings.transcriptionProvider,
      generationProvider: provider.settings.generationProvider,
      assistantWebSearch: provider.settings.assistantWebSearch,
    },
    database: {
      persistenceProvider: persistenceProvider === "supabase" ? "supabase" : "local",
      supabaseUrl: settingFromEnvOrStore("SUPABASE_URL", stored.database?.supabaseUrl ?? ""),
    },
    voice: {
      captureMode: stored.voice?.captureMode ?? "microphone",
      diarizationMode: stored.voice?.diarizationMode ?? "off",
      preserveSourceTracks: stored.voice?.preserveSourceTracks ?? true,
    },
    integrations: {
      googleMeetEnabled: stored.integrations?.googleMeetEnabled ?? true,
      microsoftTeamsEnabled: stored.integrations?.microsoftTeamsEnabled ?? true,
    },
    security: {
      secretStorage: "backend_vault",
      encryptedAtRest: true,
    },
    interface: {
      appLanguage: stored.interface?.appLanguage ?? "pt-BR",
      theme: stored.interface?.theme ?? "system",
    },
    automations: {
      enabled: stored.automations?.enabled ?? false,
    },
  };
}

function buildCategories(values: AppSettingsValues): AppSettingsCategory[] {
  const openAIReady = secretConfigured("OPENAI_API_KEY");
  const geminiReady = secretConfigured("GEMINI_API_KEY");
  const supabaseKeyReady =
    secretConfigured("SUPABASE_SERVICE_ROLE_KEY") || secretConfigured("SUPABASE_SECRET_KEY");
  const supabaseUrlReady = Boolean(values.database.supabaseUrl.trim());
  const supabaseReady =
    values.database.persistenceProvider === "local" || (supabaseUrlReady && supabaseKeyReady);

  return [
    category({
      id: "ai",
      label: "IA",
      description: "Providers pessoais, modelos e chaves usados por transcricao, materiais e chat.",
      fields: [
        field({
          key: "ai.transcriptionProvider",
          label: "Provider de transcricao",
          category: "ai",
          type: "select",
          value: values.ai.transcriptionProvider,
          description: "Motor usado para transformar audio em texto.",
          example: "faster-whisper para local, openai ou gemini para nuvem",
          status: "ready",
        }),
        field({
          key: "ai.generationProvider",
          label: "Provider generativo",
          category: "ai",
          type: "select",
          value: values.ai.generationProvider,
          description: "Motor usado para materiais, chat e assistente.",
          example: "ollama para local, openai ou gemini para nuvem",
          status: "ready",
        }),
        field({
          key: "secrets.OPENAI_API_KEY",
          label: "Chave OpenAI",
          category: "ai",
          type: "password",
          maskedValue: getSettingsSecretStatuses().find((item) => item.name === "OPENAI_API_KEY")
            ?.maskedValue,
          description: "Salva no cofre do backend para transcricao, chat e busca web.",
          example: "sk-...",
          status: statusFromRequired(openAIReady),
        }),
        field({
          key: "secrets.GEMINI_API_KEY",
          label: "Chave Gemini",
          category: "ai",
          type: "password",
          maskedValue: getSettingsSecretStatuses().find((item) => item.name === "GEMINI_API_KEY")
            ?.maskedValue,
          description: "Salva no cofre do backend para transcricao e geracao com Gemini.",
          example: "AIza...",
          status: statusFromRequired(geminiReady),
        }),
      ],
    }),
    category({
      id: "database",
      label: "Banco de Dados",
      description: "Persistencia local ou Supabase para sessoes, diagnosticos e historico.",
      fields: [
        field({
          key: "database.persistenceProvider",
          label: "Persistencia",
          category: "database",
          type: "select",
          value: values.database.persistenceProvider,
          description: "Define onde o backend grava os dados principais do produto.",
          example: "local por padrao, supabase para sincronizar",
          status: supabaseReady ? "ready" : "attention",
        }),
        field({
          key: "database.supabaseUrl",
          label: "URL do Supabase",
          category: "database",
          type: "url",
          value: values.database.supabaseUrl,
          description: "Endpoint do projeto Supabase usado apenas pelo backend.",
          example: "https://seu-projeto.supabase.co",
          status:
            values.database.persistenceProvider === "supabase"
              ? statusFromRequired(supabaseUrlReady)
              : "ready",
        }),
        field({
          key: "secrets.SUPABASE_SERVICE_ROLE_KEY",
          label: "Service role key",
          category: "database",
          type: "password",
          maskedValue: getSettingsSecretStatuses().find(
            (item) => item.name === "SUPABASE_SERVICE_ROLE_KEY",
          )?.maskedValue,
          description: "Credencial de servidor. Nunca e enviada ao navegador.",
          example: "eyJ...",
          status:
            values.database.persistenceProvider === "supabase"
              ? statusFromRequired(supabaseKeyReady)
              : "ready",
        }),
      ],
    }),
    category({
      id: "voice",
      label: "Voz e Audio",
      description: "Captura multi-fonte, canais preservados e diarizacao de participantes.",
      fields: [
        field({
          key: "voice.captureMode",
          label: "Modo de captura",
          category: "voice",
          type: "select",
          value: values.voice.captureMode,
          description: "Controla se a sessao captura so microfone ou microfone + audio da reuniao.",
          example: "microphone_and_system para reunioes online",
          status: "ready",
        }),
        field({
          key: "voice.preserveSourceTracks",
          label: "Preservar fontes separadas",
          category: "voice",
          type: "toggle",
          value: values.voice.preserveSourceTracks,
          description: "Mantem microfone e audio remoto como registros independentes.",
          status: values.voice.preserveSourceTracks ? "ready" : "attention",
        }),
        field({
          key: "voice.diarizationMode",
          label: "Diarizacao",
          category: "voice",
          type: "select",
          value: values.voice.diarizationMode,
          description: "Define como participantes remotos serao separados no transcript.",
          example: "speaker_labels_with_names para associacao assistida",
          status: values.voice.diarizationMode === "off" ? "attention" : "ready",
        }),
      ],
    }),
    category({
      id: "integrations",
      label: "Integracoes",
      description: "Preferencias para fontes externas como Google Meet e Microsoft Teams.",
      fields: [
        field({
          key: "integrations.googleMeetEnabled",
          label: "Google Meet",
          category: "integrations",
          type: "toggle",
          value: values.integrations.googleMeetEnabled,
          description: "Habilita orientacoes e mapeamento manual para reunioes do Meet.",
          status: values.integrations.googleMeetEnabled ? "ready" : "unknown",
        }),
        field({
          key: "integrations.microsoftTeamsEnabled",
          label: "Microsoft Teams",
          category: "integrations",
          type: "toggle",
          value: values.integrations.microsoftTeamsEnabled,
          description: "Habilita orientacoes e mapeamento manual para reunioes do Teams.",
          status: values.integrations.microsoftTeamsEnabled ? "ready" : "unknown",
        }),
      ],
    }),
    category({
      id: "security",
      label: "Seguranca",
      description: "Politicas para segredos e protecao de credenciais sensiveis.",
      fields: [
        field({
          key: "security.secretStorage",
          label: "Armazenamento de segredos",
          category: "security",
          type: "status",
          value: "backend_vault",
          description: "Segredos ficam criptografados no backend e mascarados na API.",
          status: "ready",
        }),
      ],
    }),
    category({
      id: "interface",
      label: "Interface",
      description: "Idioma, tema e preferencias visuais do aplicativo.",
      fields: [
        field({
          key: "interface.appLanguage",
          label: "Idioma",
          category: "interface",
          type: "select",
          value: values.interface.appLanguage,
          description: "Preferencia persistida para a experiencia do app.",
          status: "ready",
        }),
      ],
    }),
    category({
      id: "automations",
      label: "Automacoes",
      description: "Base para lembretes, monitores e rotinas futuras do produto.",
      fields: [
        field({
          key: "automations.enabled",
          label: "Automacoes",
          category: "automations",
          type: "toggle",
          value: values.automations.enabled,
          description: "Reserva o estado operacional para automacoes futuras.",
          status: values.automations.enabled ? "ready" : "unknown",
        }),
      ],
    }),
  ];
}

export async function getAppSettingsCenter(): Promise<AppSettingsCenterEnvelope> {
  await Promise.all([ensureAppSettingsLoaded(), ensureSettingsSecretsLoaded()]);
  const values = buildValues();

  return {
    version: 1,
    updatedAt: getAppSettingsUpdatedAt(),
    values,
    categories: buildCategories(values),
    secrets: getSettingsSecretStatuses(),
  };
}

export async function updateAppSettingsCenter(patch: AppSettingsPatch) {
  await Promise.all([ensureAppSettingsLoaded(), ensureSettingsSecretsLoaded()]);

  if (patch.providerSettings) {
    await updateProviderRuntimeConfig(patch.providerSettings);
  }

  if (
    patch.database ||
    patch.voice ||
    patch.integrations ||
    patch.security ||
    patch.interface ||
    patch.automations
  ) {
    await updatePersistedAppSettings(patch);
  }

  if (patch.secrets) {
    await updateSettingsSecrets(patch.secrets);
  }

  return getAppSettingsCenter();
}

export async function validateAppSettingsCenter(): Promise<AppSettingsValidationEnvelope> {
  await Promise.all([ensureAppSettingsLoaded(), ensureSettingsSecretsLoaded()]);
  const checkedAt = new Date().toISOString();
  const values = buildValues();
  const checks: AppSettingsValidationCheck[] = [];

  const addCheck = (
    input: Omit<AppSettingsValidationCheck, "checkedAt"> & { checkedAt?: string },
  ) => {
    checks.push({
      checkedAt,
      ...input,
    });
  };

  const health = await getProviderRuntimeHealth();
  for (const capability of health.capabilities) {
    addCheck({
      id: `provider.${capability.capability}`,
      category: "ai",
      label: capability.label,
      status:
        capability.status === "ready"
          ? "ready"
          : capability.status === "limited" || capability.status === "development_only"
            ? "attention"
            : "blocked",
      detail: capability.detail ?? capability.summary,
    });
  }

  addCheck({
    id: "secret.openai",
    category: "ai",
    label: "Chave OpenAI",
    status:
      values.ai.transcriptionProvider === "openai" ||
      values.ai.generationProvider === "openai" ||
      values.ai.assistantWebSearch === "on"
        ? statusFromRequired(secretConfigured("OPENAI_API_KEY"))
        : secretConfigured("OPENAI_API_KEY")
          ? "ready"
          : "unknown",
    detail: secretConfigured("OPENAI_API_KEY")
      ? "Chave OpenAI disponivel no backend."
      : "Chave OpenAI nao configurada.",
  });

  addCheck({
    id: "secret.gemini",
    category: "ai",
    label: "Chave Gemini",
    status:
      values.ai.transcriptionProvider === "gemini" || values.ai.generationProvider === "gemini"
        ? statusFromRequired(secretConfigured("GEMINI_API_KEY"))
        : secretConfigured("GEMINI_API_KEY")
          ? "ready"
          : "unknown",
    detail: secretConfigured("GEMINI_API_KEY")
      ? "Chave Gemini disponivel no backend."
      : "Chave Gemini nao configurada.",
  });

  if (values.database.persistenceProvider === "supabase") {
    const supabase = await checkSupabaseVoiceStoreConnection();
    addCheck({
      id: "database.supabase",
      category: "database",
      label: "Supabase",
      status: supabase.status,
      detail: supabase.detail,
      latencyMs: supabase.latencyMs,
      checkedAt: supabase.checkedAt,
    });
  } else {
    addCheck({
      id: "database.local",
      category: "database",
      label: "Persistencia local",
      status: "ready",
      detail: "Persistencia local ativa no backend.",
    });
  }

  addCheck({
    id: "voice.capture-mode",
    category: "voice",
    label: "Captura multi-fonte",
    status: values.voice.captureMode === "microphone_and_system" ? "ready" : "attention",
    detail:
      values.voice.captureMode === "microphone_and_system"
        ? "Aula tentara capturar microfone e audio da reuniao/sistema como fontes separadas."
        : "Aula esta configurada para capturar apenas microfone.",
  });

  addCheck({
    id: "voice.diarization",
    category: "voice",
    label: "Diarizacao",
    status:
      values.voice.diarizationMode === "off"
        ? "attention"
        : health.localProviders.fasterWhisper.smokeDiarizationReady
          ? "ready"
          : "attention",
    detail:
      values.voice.diarizationMode === "off"
        ? "Diarizacao esta desligada para participantes remotos."
        : health.localProviders.fasterWhisper.smokeDiarizationReady
          ? "Worker local validou a diarizacao real com smoke test."
          : "Transcricoes remotas usam contrato/fallback de diarizacao ate configurar e validar FASTER_WHISPER_DIARIZATION_COMMAND.",
  });

  return {
    checkedAt,
    status: validationStatus(checks),
    checks,
  };
}
