import { Link, getRouteApi } from "@tanstack/react-router";
import {
  Accessibility,
  ChevronDown,
  ChevronRight,
  Copy,
  ListChecks,
  Loader2,
  Moon,
  PlugZap,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AssistantWebSearchMode,
  AppSettingsCenterEnvelope,
  AppSettingsPatch,
  AppSettingsValidationEnvelope,
  CloudProviderConnectionStatus,
  FasterWhisperConnectionStatus,
  GenerationProviderMode,
  OllamaConnectionStatus,
  ProviderRuntimeCheck,
  ProviderRuntimeHealthEnvelope,
  ProviderRuntimeHealthHistoryEnvelope,
  ProviderRuntimeSettingsEnvelope,
  ProviderRuntimeSettingsPatch,
  TranscriptionProviderMode,
} from "@/lib/voice-intelligence";
import { ProviderChecks } from "./components/provider-checks";
import { Row } from "./components/row";
import { Section } from "./components/section";
import { StatusBadge } from "./components/status-badge";
import {
  selectClassName,
  inputClassName,
  secondaryButtonClassName,
  settingsSections,
  type SettingsSectionId,
  settingsSectionKey,
  appLanguageKey,
  transcriptionLanguageKey,
  microphoneDeviceKey,
  type DeviceOption,
  type BrowserCaptureSupport,
  emptyBrowserCaptureSupport,
  emptyProviderConfig,
  emptyOllamaStatus,
  emptyFasterWhisperStatus,
  emptyRuntimeHealth,
  emptyRuntimeHistory,
  emptyAppSettings,
  emptyAppSettingsValidation,
} from "./model/defaults";
import {
  safeLocalStorageGet,
  providerOptionSuffix,
  readApiJson,
  runtimeStatusLabel,
  runtimeStatusTone,
  checkTone,
  appSettingsStatusTone,
  appSettingsStatusLabel,
  browserCaptureStatus,
  browserCaptureStatusDetail,
  fasterWhisperToastLabel,
  fasterWhisperSmokeCheck,
  capabilityStatusLabel,
  capabilityStatusTone,
  capabilityProviderLabel,
  connectionStatusLabel,
  connectionStatusTone,
  offlineStatusLabel,
  offlineStatusTone,
  setupStepLabel,
  setupStepTone,
  localStackSummary,
} from "./model/status-labels";

const routeApi = getRouteApi("/configuracoes");

type ConnectionTestProvider = "gemini" | "openai" | "ollama" | "faster-whisper";

type ConnectionTestResult = {
  provider: ConnectionTestProvider;
  status: string;
  message: string;
  latencyMs?: number;
  checkedAt: string;
  checks: ProviderRuntimeCheck[];
};

const connectionProviders: { id: ConnectionTestProvider; label: string }[] = [
  { id: "gemini", label: "Gemini" },
  { id: "openai", label: "OpenAI" },
  { id: "ollama", label: "Ollama" },
  { id: "faster-whisper", label: "Faster-Whisper" },
];

export function SettingsPage() {
  const { canManageSettings } = routeApi.useRouteContext();
  if (canManageSettings) return <Configuracoes />;

  return (
    <section className="mx-auto max-w-2xl space-y-4 px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      <p className="text-sm text-muted-foreground">
        A administração do educAI gerencia os provedores de IA e o armazenamento. Você pode ajustar
        as preferências de acessibilidade neste navegador.
      </p>
      <Link
        to="/acessibilidade"
        className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
      >
        <Accessibility size={16} aria-hidden />
        Preferências de acessibilidade
      </Link>
    </section>
  );
}

function Configuracoes() {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("geral");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = safeLocalStorageGet(settingsSectionKey, "geral");
    if (settingsSections.some((section) => section.id === saved)) {
      setActiveSection(saved as SettingsSectionId);
    }
  }, []);

  const selectSection = (id: SettingsSectionId) => {
    setActiveSection(id);
    localStorage.setItem(settingsSectionKey, id);
  };
  const [appLanguage, setAppLanguage] = useState("pt-BR");
  const [transcriptionLanguage, setTranscriptionLanguage] = useState("pt-BR");
  const [microphoneId, setMicrophoneId] = useState("default");
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState("");
  const [browserCaptureSupport, setBrowserCaptureSupport] = useState<BrowserCaptureSupport>(
    emptyBrowserCaptureSupport,
  );
  const [providerConfig, setProviderConfig] =
    useState<ProviderRuntimeSettingsEnvelope>(emptyProviderConfig);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [ollamaBaseUrlDraft, setOllamaBaseUrlDraft] = useState("http://localhost:11434");
  const [ollamaModelDraft, setOllamaModelDraft] = useState("qwen3:8b");
  const [fasterWhisperBaseUrlDraft, setFasterWhisperBaseUrlDraft] =
    useState("http://localhost:8765");
  const [fasterWhisperModelDraft, setFasterWhisperModelDraft] = useState("small");
  const [ollamaStatus, setOllamaStatus] = useState<OllamaConnectionStatus>(emptyOllamaStatus);
  const [fasterWhisperStatus, setFasterWhisperStatus] =
    useState<FasterWhisperConnectionStatus>(emptyFasterWhisperStatus);
  const [runtimeHealth, setRuntimeHealth] =
    useState<ProviderRuntimeHealthEnvelope>(emptyRuntimeHealth);
  const [runtimeHealthLoading, setRuntimeHealthLoading] = useState(true);
  const [runtimeHistory, setRuntimeHistory] =
    useState<ProviderRuntimeHealthHistoryEnvelope>(emptyRuntimeHistory);
  const [runtimeHistoryLoading, setRuntimeHistoryLoading] = useState(true);
  const [appSettings, setAppSettings] = useState<AppSettingsCenterEnvelope>(emptyAppSettings);
  const [appSettingsLoading, setAppSettingsLoading] = useState(true);
  const [appSettingsSaving, setAppSettingsSaving] = useState(false);
  const [appSettingsError, setAppSettingsError] = useState("");
  const [appSettingsValidation, setAppSettingsValidation] = useState<AppSettingsValidationEnvelope>(
    emptyAppSettingsValidation,
  );
  const [appSettingsValidationLoading, setAppSettingsValidationLoading] = useState(false);
  const [openAIKeyDraft, setOpenAIKeyDraft] = useState("");
  const [geminiKeyDraft, setGeminiKeyDraft] = useState("");
  const [supabaseUrlDraft, setSupabaseUrlDraft] = useState("");
  const [supabaseServiceKeyDraft, setSupabaseServiceKeyDraft] = useState("");
  const [ollamaTesting, setOllamaTesting] = useState(false);
  const [fasterWhisperTesting, setFasterWhisperTesting] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState<ConnectionTestProvider[]>([]);
  const [connectionResults, setConnectionResults] = useState<ConnectionTestResult[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    setBrowserCaptureSupport({
      getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
      getDisplayMedia: Boolean(navigator.mediaDevices?.getDisplayMedia),
      mediaRecorder: typeof MediaRecorder !== "undefined",
      secureContext:
        window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1",
    });
  }, []);

  const browserCaptureReadiness = browserCaptureStatus(browserCaptureSupport);

  const copySetupCommand = (command: string) => {
    if (!navigator.clipboard?.writeText) {
      toast.error("Copia indisponivel neste navegador");
      return;
    }

    void navigator.clipboard
      .writeText(command)
      .then(() => toast.success("Comando copiado"))
      .catch(() => toast.error("Nao foi possivel copiar o comando"));
  };

  const loadDevices = async (options: { notify?: boolean } = {}) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setMicrophones([{ deviceId: "default", label: "Padrao do sistema" }]);
      setDevicesError("Este navegador nao permite listar dispositivos de audio.");
      setDevicesLoading(false);
      if (options.notify) {
        toast.error("Nao foi possivel listar microfones");
      }
      return;
    }

    setDevicesLoading(true);
    setDevicesError("");

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId || `audio-${index}`,
          label: device.label || `Microfone ${index + 1}`,
        }));
      const selectedId = safeLocalStorageGet(microphoneDeviceKey, "default");
      const nextMicrophones = audioInputs.length
        ? audioInputs
        : [{ deviceId: "default", label: "Padrao do sistema" }];

      if (
        selectedId !== "default" &&
        !nextMicrophones.some((device) => device.deviceId === selectedId)
      ) {
        nextMicrophones.unshift({
          deviceId: selectedId,
          label: "Microfone salvo (indisponivel agora)",
        });
      }

      setMicrophones(nextMicrophones);
      if (options.notify) {
        toast.success("Dispositivos atualizados");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar os dispositivos de audio.";
      setMicrophones([{ deviceId: "default", label: "Padrao do sistema" }]);
      setDevicesError(message);
      if (options.notify) {
        toast.error("Falha ao atualizar dispositivos", { description: message });
      }
    } finally {
      setDevicesLoading(false);
    }
  };

  const loadProviderConfig = async (options: { notify?: boolean } = {}) => {
    setProviderLoading(true);
    setProviderError("");

    try {
      const response = await fetch("/api/v1/settings/providers");
      const data = await readApiJson<ProviderRuntimeSettingsEnvelope>(response);
      setProviderConfig(data);
      setOllamaBaseUrlDraft(data.settings.ollamaBaseUrl);
      setOllamaModelDraft(data.settings.ollamaModel);
      setFasterWhisperBaseUrlDraft(data.settings.fasterWhisperBaseUrl);
      setFasterWhisperModelDraft(data.settings.fasterWhisperModel);
      setOllamaStatus((current) => ({
        ...current,
        baseUrl: data.settings.ollamaBaseUrl,
        model: data.settings.ollamaModel,
      }));
      setFasterWhisperStatus((current) => ({
        ...current,
        baseUrl: data.settings.fasterWhisperBaseUrl,
        model: data.settings.fasterWhisperModel,
      }));
      if (options.notify) {
        toast.success("Configuracoes do backend atualizadas");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel carregar os providers.";
      setProviderError(message);
      if (options.notify) {
        toast.error("Falha ao atualizar providers", { description: message });
      }
    } finally {
      setProviderLoading(false);
    }
  };

  const loadAppSettings = async (options: { notify?: boolean } = {}) => {
    setAppSettingsLoading(true);
    setAppSettingsError("");

    try {
      const response = await fetch("/api/v1/settings");
      const data = await readApiJson<AppSettingsCenterEnvelope>(response);
      setAppSettings(data);
      setSupabaseUrlDraft(data.values.database.supabaseUrl);
      setOpenAIKeyDraft("");
      setGeminiKeyDraft("");
      setSupabaseServiceKeyDraft("");
      if (options.notify) {
        toast.success("Centro de configuracoes atualizado");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel carregar as configuracoes.";
      setAppSettingsError(message);
      if (options.notify) {
        toast.error("Falha ao atualizar configuracoes", { description: message });
      }
    } finally {
      setAppSettingsLoading(false);
    }
  };

  const saveAppSettingsPatch = async (patch: AppSettingsPatch, successMessage: string) => {
    setAppSettingsSaving(true);
    setAppSettingsError("");

    try {
      const response = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const data = await readApiJson<AppSettingsCenterEnvelope>(response);
      setAppSettings(data);
      setSupabaseUrlDraft(data.values.database.supabaseUrl);
      setOpenAIKeyDraft("");
      setGeminiKeyDraft("");
      setSupabaseServiceKeyDraft("");
      toast.success(successMessage);
      void loadProviderConfig();
      void loadRuntimeHealth();
      void validateAppSettings();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes.";
      setAppSettingsError(message);
      toast.error("Falha ao salvar configuracoes", { description: message });
    } finally {
      setAppSettingsSaving(false);
    }
  };

  const validateAppSettings = async (options: { notify?: boolean } = {}) => {
    setAppSettingsValidationLoading(true);

    try {
      const response = await fetch("/api/v1/settings/status");
      const data = await readApiJson<AppSettingsValidationEnvelope>(response);
      setAppSettingsValidation(data);
      if (options.notify) {
        toast.success("Validacao operacional atualizada");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel validar as configuracoes.";
      setAppSettingsError(message);
      if (options.notify) {
        toast.error("Falha ao validar configuracoes", { description: message });
      }
    } finally {
      setAppSettingsValidationLoading(false);
    }
  };

  const loadRuntimeHistory = async () => {
    setRuntimeHistoryLoading(true);

    try {
      const response = await fetch("/api/v1/settings/providers/runtime-history");
      const data = await readApiJson<ProviderRuntimeHealthHistoryEnvelope>(response);
      setRuntimeHistory(data);
    } catch {
      setRuntimeHistory(emptyRuntimeHistory);
    } finally {
      setRuntimeHistoryLoading(false);
    }
  };

  const loadRuntimeHealth = async (options: { notify?: boolean } = {}) => {
    setRuntimeHealthLoading(true);

    try {
      const response = await fetch("/api/v1/settings/providers/runtime-status");
      const data = await readApiJson<ProviderRuntimeHealthEnvelope>(response);
      setRuntimeHealth(data);
      setOllamaStatus(data.localProviders.ollama);
      setFasterWhisperStatus(data.localProviders.fasterWhisper);
      void loadRuntimeHistory();
      if (options.notify) {
        toast.success("Saude operacional atualizada");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar a saude operacional dos providers.";
      setProviderError(message);
      if (options.notify) {
        toast.error("Falha ao atualizar saude operacional", { description: message });
      }
    } finally {
      setRuntimeHealthLoading(false);
    }
  };

  const saveProviderConfig = async (
    patch: ProviderRuntimeSettingsPatch,
    successMessage: string,
  ) => {
    setProviderSaving(true);
    setProviderError("");

    try {
      const response = await fetch("/api/v1/settings/providers", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const data = await readApiJson<ProviderRuntimeSettingsEnvelope>(response);
      setProviderConfig(data);
      setOllamaBaseUrlDraft(data.settings.ollamaBaseUrl);
      setOllamaModelDraft(data.settings.ollamaModel);
      setFasterWhisperBaseUrlDraft(data.settings.fasterWhisperBaseUrl);
      setFasterWhisperModelDraft(data.settings.fasterWhisperModel);
      setOllamaStatus((current) => ({
        ...current,
        baseUrl: data.settings.ollamaBaseUrl,
        model: data.settings.ollamaModel,
      }));
      setFasterWhisperStatus((current) => ({
        ...current,
        baseUrl: data.settings.fasterWhisperBaseUrl,
        model: data.settings.fasterWhisperModel,
      }));
      await loadRuntimeHealth();
      toast.success(successMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel salvar os providers.";
      setProviderError(message);
      toast.error("Falha ao salvar", { description: message });
    } finally {
      setProviderSaving(false);
    }
  };

  const applyOfflinePreset = async () => {
    await saveProviderConfig(
      {
        transcriptionProvider: "faster-whisper",
        generationProvider: "ollama",
        assistantWebSearch: "off",
        fasterWhisperBaseUrl: fasterWhisperBaseUrlDraft,
        fasterWhisperModel: fasterWhisperModelDraft,
        ollamaBaseUrl: ollamaBaseUrlDraft,
        ollamaModel: ollamaModelDraft,
      },
      "Preset offline aplicado",
    );
  };

  const testOllamaConnection = async (
    options: { notify?: boolean } = {},
  ): Promise<OllamaConnectionStatus> => {
    setOllamaTesting(true);

    try {
      const response = await fetch("/api/v1/settings/providers/ollama/status");
      const data = await readApiJson<OllamaConnectionStatus>(response);
      setOllamaStatus(data);
      if (options.notify) {
        toast.success(
          data.status === "ready"
            ? "Ollama conectado"
            : data.status === "model_missing"
              ? "Ollama respondeu, mas o modelo nao foi encontrado"
              : "Status do Ollama atualizado",
        );
      }
      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel testar a conexao com o Ollama.";
      const fallback: OllamaConnectionStatus = {
        provider: "ollama",
        baseUrl: providerConfig.settings.ollamaBaseUrl,
        model: providerConfig.settings.ollamaModel,
        checkedAt: new Date().toISOString(),
        status: "unreachable",
        reachable: false,
        activeModelAvailable: false,
        availableModels: [],
        jsonGenerationReady: false,
        checks: [
          {
            id: "endpoint",
            label: "Endpoint local",
            status: "fail",
            detail: message,
          },
        ],
        message,
      };
      setOllamaStatus(fallback);
      if (options.notify) {
        toast.error("Falha ao testar Ollama", { description: message });
      }
      return fallback;
    } finally {
      setOllamaTesting(false);
    }
  };

  const testFasterWhisperConnection = async (
    options: { notify?: boolean } = {},
  ): Promise<FasterWhisperConnectionStatus> => {
    setFasterWhisperTesting(true);

    try {
      const response = await fetch("/api/v1/settings/providers/faster-whisper/status");
      const data = await readApiJson<FasterWhisperConnectionStatus>(response);
      setFasterWhisperStatus(data);
      if (options.notify) {
        toast.success(fasterWhisperToastLabel(data.status));
      }
      return data;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel testar a conexao com o Faster-Whisper.";
      const fallback: FasterWhisperConnectionStatus = {
        ...emptyFasterWhisperStatus,
        baseUrl: providerConfig.settings.fasterWhisperBaseUrl,
        model: providerConfig.settings.fasterWhisperModel,
        checkedAt: new Date().toISOString(),
        checks: [
          {
            id: "endpoint",
            label: "Endpoint local",
            status: "fail",
            detail: message,
          },
        ],
        message,
      };
      setFasterWhisperStatus(fallback);
      if (options.notify) {
        toast.error("Falha ao testar Faster-Whisper", { description: message });
      }
      return fallback;
    } finally {
      setFasterWhisperTesting(false);
    }
  };

  const toConnectionResult = (
    data: OllamaConnectionStatus | FasterWhisperConnectionStatus,
  ): ConnectionTestResult => ({
    provider: data.provider,
    status: data.status,
    message: data.message,
    latencyMs: data.latencyMs,
    checkedAt: data.checkedAt,
    checks: data.checks,
  });

  const runConnectionTest = async (providers: ConnectionTestProvider[]) => {
    if (providers.length === 0) return;

    setConnectionTesting(providers);

    try {
      const settled = await Promise.allSettled(
        providers.map(async (provider): Promise<ConnectionTestResult> => {
          if (provider === "gemini" || provider === "openai") {
            const response = await fetch(`/api/v1/settings/providers/${provider}/status`);
            const data = await readApiJson<CloudProviderConnectionStatus>(response);
            return {
              provider,
              status: data.status,
              message: data.message,
              latencyMs: data.latencyMs,
              checkedAt: data.checkedAt,
              checks: data.checks,
            };
          }

          const data =
            provider === "ollama"
              ? await testOllamaConnection()
              : await testFasterWhisperConnection();
          return toConnectionResult(data);
        }),
      );

      const results: ConnectionTestResult[] = settled.map((item, index) => {
        if (item.status === "fulfilled") return item.value;

        return {
          provider: providers[index],
          status: "unreachable",
          message:
            item.reason instanceof Error
              ? item.reason.message
              : "Nao foi possivel testar a conexao.",
          checkedAt: new Date().toISOString(),
          checks: [],
        };
      });

      setConnectionResults((current) => {
        const byProvider = new Map<ConnectionTestProvider, ConnectionTestResult>();
        for (const result of current) byProvider.set(result.provider, result);
        for (const result of results) byProvider.set(result.provider, result);
        return connectionProviders
          .map((provider) => byProvider.get(provider.id))
          .filter((item): item is ConnectionTestResult => Boolean(item));
      });

      await loadRuntimeHealth();

      const readyCount = results.filter((result) => result.status === "ready").length;
      const summary = `${readyCount} de ${results.length} conexao(oes) pronta(s).`;

      if (readyCount === results.length) {
        toast.success(
          providers.length === 1
            ? `${connectionProviders.find((item) => item.id === providers[0])?.label ?? "Provedor"} conectado`
            : "Todas as conexoes estao prontas",
          { description: summary },
        );
      } else {
        toast.error("Alguma conexao precisa de atencao", { description: summary });
      }
    } finally {
      setConnectionTesting([]);
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      setDark(document.documentElement.classList.contains("dark"));
      document.documentElement.lang = safeLocalStorageGet(appLanguageKey, "pt-BR");
    }

    setAppLanguage(safeLocalStorageGet(appLanguageKey, "pt-BR"));
    setTranscriptionLanguage(safeLocalStorageGet(transcriptionLanguageKey, "pt-BR"));
    setMicrophoneId(safeLocalStorageGet(microphoneDeviceKey, "default"));
    void loadDevices();
    void loadAppSettings();
    void validateAppSettings();
    void loadProviderConfig();
    void loadRuntimeHealth();
    void loadRuntimeHistory();
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("educai-theme", next ? "dark" : "light");
    toast(next ? "Tema escuro ativado" : "Tema claro ativado");
  };

  const saveAppLanguage = (value: string) => {
    setAppLanguage(value);
    document.documentElement.lang = value;
    localStorage.setItem(appLanguageKey, value);
    toast.success("Idioma do aplicativo atualizado");
  };

  const saveTranscriptionLanguage = (value: string) => {
    setTranscriptionLanguage(value);
    localStorage.setItem(transcriptionLanguageKey, value);
    toast.success("Idioma padrao da transcricao atualizado");
  };

  const saveMicrophone = (value: string) => {
    setMicrophoneId(value);
    localStorage.setItem(microphoneDeviceKey, value);
    toast.success("Microfone padrao atualizado");
  };

  const transcriptionItems = providerConfig.catalog.transcription;
  const generationItems = providerConfig.catalog.generation;
  const openAISecret = appSettings.secrets.find((item) => item.name === "OPENAI_API_KEY");
  const geminiSecret = appSettings.secrets.find((item) => item.name === "GEMINI_API_KEY");
  const supabaseSecret = appSettings.secrets.find(
    (item) => item.name === "SUPABASE_SERVICE_ROLE_KEY",
  );
  const aiCategory = appSettings.categories.find((item) => item.id === "ai");
  const databaseCategory = appSettings.categories.find((item) => item.id === "database");
  const voiceCategory = appSettings.categories.find((item) => item.id === "voice");
  const featuredSettingsCategories = [aiCategory, databaseCategory, voiceCategory].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );

  const activeSectionMeta =
    settingsSections.find((section) => section.id === activeSection) ?? settingsSections[0];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 animate-fade-in sm:py-10">
      <div className="mb-6">
        <BackButton to="/painel" label="Início" />
      </div>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Configurações</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Preferências do app, provedores de IA, transcrição, banco de dados e diagnóstico.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadDevices({ notify: true });
            void loadAppSettings({ notify: true });
            void validateAppSettings({ notify: true });
            void loadProviderConfig({ notify: true });
            void loadRuntimeHealth({ notify: true });
          }}
          disabled={
            devicesLoading ||
            appSettingsLoading ||
            appSettingsSaving ||
            appSettingsValidationLoading ||
            providerLoading ||
            runtimeHealthLoading ||
            ollamaTesting ||
            fasterWhisperTesting
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {devicesLoading ||
          appSettingsLoading ||
          appSettingsSaving ||
          appSettingsValidationLoading ||
          providerLoading ||
          runtimeHealthLoading ||
          ollamaTesting ||
          fasterWhisperTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Revalidar
        </button>
      </div>

      {(devicesError || providerError) && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          {devicesError || providerError}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[210px_minmax(0,1fr)] md:gap-10">
        <div
          role="tablist"
          aria-label="Seções das configurações"
          aria-orientation="vertical"
          className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 md:sticky md:top-6 md:mx-0 md:flex-col md:self-start md:overflow-visible md:px-0"
        >
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const selected = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                id={`tab-${section.id}`}
                aria-selected={selected}
                aria-controls="settings-panel"
                onClick={() => selectSection(section.id)}
                className={`flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-left text-[13px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected
                    ? "bg-black/5 font-medium text-foreground dark:bg-white/10"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                {section.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={`tab-${activeSection}`}
          className="min-w-0 space-y-5"
        >
          <div className="mb-2">
            <h2 className="text-lg font-semibold tracking-tight">{activeSectionMeta.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{activeSectionMeta.description}</p>
          </div>

          {activeSection === "geral" ? (
            <>
              <Section title="Aparência" description="Como o educAI aparece neste navegador.">
                <Row title="Tema" desc="Alterne entre claro e escuro.">
                  <button
                    onClick={toggleTheme}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted active:scale-95"
                  >
                    {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    {dark ? "Escuro" : "Claro"}
                  </button>
                </Row>
                <Row title="Idioma do aplicativo" desc="Preferencia local salva no navegador.">
                  <select
                    className={selectClassName}
                    value={appLanguage}
                    onChange={(event) => saveAppLanguage(event.target.value)}
                  >
                    <option value="pt-BR">Portugues (Brasil)</option>
                    <option value="en">English</option>
                    <option value="es">Espanol</option>
                  </select>
                </Row>
                <Row
                  title="Acessibilidade"
                  desc="Tamanho do texto, contraste, leitura em voz alta e linguagem simples."
                >
                  <Link to="/acessibilidade" className={secondaryButtonClassName}>
                    <Accessibility className="h-4 w-4" aria-hidden />
                    Abrir
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Row>
              </Section>

              <Section title="Gravação" description="Padrões usados ao iniciar uma nova aula.">
                <Row
                  title="Microfone"
                  desc="Usado como preferencia padrao quando a gravacao comecar."
                >
                  <div className="flex w-full items-center gap-2">
                    <select
                      className={selectClassName}
                      value={microphoneId}
                      onChange={(event) => saveMicrophone(event.target.value)}
                      disabled={devicesLoading}
                    >
                      {microphones.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void loadDevices({ notify: true })}
                      disabled={devicesLoading}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Atualizar dispositivos"
                    >
                      {devicesLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </Row>
                <Row title="Idioma da transcricao" desc="Usado como padrao ao criar novas sessoes.">
                  <select
                    className={selectClassName}
                    value={transcriptionLanguage}
                    onChange={(event) => saveTranscriptionLanguage(event.target.value)}
                  >
                    <option value="pt-BR">Portugues (Brasil)</option>
                    <option value="pt-PT">Portugues (Portugal)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es">Espanol</option>
                  </select>
                </Row>
              </Section>
            </>
          ) : null}

          {activeSection === "ia" ? (
            <>
              <Section
                title="Provedor de IA"
                description="Quem gera os materiais, o chat contextual e as respostas do assistente."
              >
                <Row
                  title="Provider de IA generativa"
                  desc="Controla geracao de materiais, chat contextual e respostas do backend."
                >
                  <select
                    className={selectClassName}
                    value={providerConfig.settings.generationProvider}
                    onChange={(event) => {
                      void saveProviderConfig(
                        { generationProvider: event.target.value as GenerationProviderMode },
                        "Provider de IA atualizado",
                      );
                    }}
                    disabled={providerLoading || providerSaving}
                  >
                    {generationItems.map((item) => (
                      <option key={item.id} value={item.id} disabled={!item.selectable}>
                        {item.label}
                        {providerOptionSuffix(item)}
                      </option>
                    ))}
                  </select>
                </Row>

                <Row
                  title="Busca web da assistente"
                  desc="Define quando a assistente pode consultar fontes externas para perguntas atuais."
                >
                  <select
                    className={selectClassName}
                    value={providerConfig.settings.assistantWebSearch}
                    onChange={(event) => {
                      void saveProviderConfig(
                        { assistantWebSearch: event.target.value as AssistantWebSearchMode },
                        "Politica de busca web atualizada",
                      );
                    }}
                    disabled={providerLoading || providerSaving}
                  >
                    <option value="auto">Automatico</option>
                    <option value="on">Sempre que necessario</option>
                    <option value="off">Desligado</option>
                  </select>
                </Row>
              </Section>

              <Section
                title="Chaves de API"
                description="Ficam criptografadas no backend e nunca voltam em texto puro para o navegador."
              >
                <div className="p-5">
                  <div className="grid gap-3">
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">
                        OpenAI {openAISecret?.configured ? `(${openAISecret.maskedValue})` : ""}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className={inputClassName}
                          value={openAIKeyDraft}
                          onChange={(event) => setOpenAIKeyDraft(event.target.value)}
                          placeholder="sk-..."
                          type="password"
                          disabled={appSettingsLoading || appSettingsSaving}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void saveAppSettingsPatch(
                              { secrets: { OPENAI_API_KEY: openAIKeyDraft } },
                              "Chave OpenAI salva no backend",
                            )
                          }
                          disabled={
                            !openAIKeyDraft.trim() || appSettingsLoading || appSettingsSaving
                          }
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">
                        Gemini {geminiSecret?.configured ? `(${geminiSecret.maskedValue})` : ""}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className={inputClassName}
                          value={geminiKeyDraft}
                          onChange={(event) => setGeminiKeyDraft(event.target.value)}
                          placeholder="AIza..."
                          type="password"
                          disabled={appSettingsLoading || appSettingsSaving}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void saveAppSettingsPatch(
                              { secrets: { GEMINI_API_KEY: geminiKeyDraft } },
                              "Chave Gemini salva no backend",
                            )
                          }
                          disabled={
                            !geminiKeyDraft.trim() || appSettingsLoading || appSettingsSaving
                          }
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section
                title="Teste de conexão"
                description="Valide credencial, modelo e disponibilidade de cada provedor."
              >
                <Row
                  title="Testar conexões"
                  desc="Escolha um provedor no menu ou valide todos de uma vez."
                >
                  <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={
                            connectionTesting.length > 0 || providerLoading || providerSaving
                          }
                          className={secondaryButtonClassName}
                        >
                          {connectionTesting.length > 0 ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PlugZap className="h-4 w-4" />
                          )}
                          Escolher provedor
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Testar qual conexão?</DropdownMenuLabel>
                        {connectionProviders.map((provider) => (
                          <DropdownMenuItem
                            key={provider.id}
                            onSelect={() => void runConnectionTest([provider.id])}
                          >
                            {provider.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() =>
                            void runConnectionTest(connectionProviders.map((item) => item.id))
                          }
                        >
                          Testar todas
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                      type="button"
                      onClick={() =>
                        void runConnectionTest(connectionProviders.map((item) => item.id))
                      }
                      disabled={connectionTesting.length > 0 || providerLoading || providerSaving}
                      className={secondaryButtonClassName}
                    >
                      {connectionTesting.length > 0 ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ListChecks className="h-4 w-4" />
                      )}
                      Testar todas
                    </button>
                  </div>
                </Row>

                {connectionResults.length > 0 ? (
                  <div className="grid gap-3 p-5">
                    {connectionResults.map((result) => (
                      <div
                        key={result.provider}
                        className="rounded-xl border border-border/70 bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              {capabilityProviderLabel(result.provider)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {result.message}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${connectionStatusTone(result.status)}`}
                          >
                            {connectionStatusLabel(result.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          {typeof result.latencyMs === "number" ? (
                            <span>Latência: {result.latencyMs}ms</span>
                          ) : null}
                          {result.checkedAt ? (
                            <span>
                              Verificado em {new Date(result.checkedAt).toLocaleString("pt-BR")}
                            </span>
                          ) : null}
                        </div>
                        {result.provider === "gemini" || result.provider === "openai" ? (
                          <div className="mt-3">
                            <ProviderChecks checks={result.checks} />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Section>

              <Section title="Ollama" description="IA local e gratuita, rodando no seu computador.">
                <Row
                  title="URL do Ollama"
                  desc="Endpoint local usado quando o provider de IA estiver configurado como Ollama."
                >
                  <div className="flex w-full gap-2">
                    <input
                      className={inputClassName}
                      value={ollamaBaseUrlDraft}
                      onChange={(event) => setOllamaBaseUrlDraft(event.target.value)}
                      placeholder="http://localhost:11434"
                      disabled={providerLoading || providerSaving}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void saveProviderConfig(
                          { ollamaBaseUrl: ollamaBaseUrlDraft },
                          "Endpoint do Ollama salvo",
                        )
                      }
                      disabled={providerLoading || providerSaving}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </Row>

                <Row
                  title="Modelo padrao do Ollama"
                  desc="Exemplo: qwen3:8b, qwen3-coder ou gemma3. O backend usa este modelo nas respostas locais."
                >
                  <div className="flex w-full gap-2">
                    <input
                      className={inputClassName}
                      value={ollamaModelDraft}
                      onChange={(event) => setOllamaModelDraft(event.target.value)}
                      placeholder="qwen3:8b"
                      disabled={providerLoading || providerSaving}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void saveProviderConfig(
                          { ollamaModel: ollamaModelDraft },
                          "Modelo do Ollama salvo",
                        )
                      }
                      disabled={providerLoading || providerSaving}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </Row>
              </Section>

              <Section title="Status do Ollama" description="Diagnóstico do runtime local.">
                <div className="p-5">
                  <div className="grid gap-3">
                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Status
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] ${runtimeStatusTone(ollamaStatus.status)}`}
                        >
                          {runtimeStatusLabel(ollamaStatus.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {ollamaStatus.message}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Endpoint e modelo
                      </div>
                      <div className="mt-2 text-sm font-medium">{ollamaStatus.baseUrl}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Modelo ativo: {ollamaStatus.model}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Verificado em:{" "}
                        {ollamaStatus.checkedAt
                          ? new Date(ollamaStatus.checkedAt).toLocaleString("pt-BR")
                          : "ainda nao verificado"}
                      </div>
                      {typeof ollamaStatus.latencyMs === "number" ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Diagnostico em: {ollamaStatus.latencyMs}ms
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Checklist operacional
                      </div>
                      <div className="mt-3">
                        <ProviderChecks checks={ollamaStatus.checks} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Modelos detectados
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ollamaStatus.availableModels.length > 0 ? (
                          ollamaStatus.availableModels.map((model) => (
                            <span
                              key={model}
                              className={`rounded-full border px-2 py-1 text-[11px] ${
                                model === ollamaStatus.model
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-border bg-background text-muted-foreground"
                              }`}
                            >
                              {model}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Nenhum modelo foi retornado pelo endpoint local.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Provedores disponíveis">
                <div className="p-5">
                  <div className="space-y-3">
                    {generationItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/70 bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          </div>
                          <StatusBadge item={item} />
                        </div>
                        {item.reason ? (
                          <div className="mt-3 text-xs text-muted-foreground">{item.reason}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </>
          ) : null}

          {activeSection === "audio" ? (
            <>
              <Section
                title="Provedor de transcrição"
                description="O motor que transforma o áudio das sessões em texto."
              >
                <Row
                  title="Provider de transcricao"
                  desc="Escolha o motor responsavel por gerar a transcricao das sessoes."
                >
                  <select
                    className={selectClassName}
                    value={providerConfig.settings.transcriptionProvider}
                    onChange={(event) => {
                      void saveProviderConfig(
                        { transcriptionProvider: event.target.value as TranscriptionProviderMode },
                        "Provider de transcricao atualizado",
                      );
                    }}
                    disabled={providerLoading || providerSaving}
                  >
                    {transcriptionItems.map((item) => (
                      <option key={item.id} value={item.id} disabled={!item.selectable}>
                        {item.label}
                        {providerOptionSuffix(item)}
                      </option>
                    ))}
                  </select>
                </Row>
              </Section>

              <Section
                title="Faster-Whisper"
                description="Transcrição local, sem enviar o áudio para a internet."
              >
                <Row
                  title="URL do Faster-Whisper"
                  desc="Endpoint local do worker HTTP de transcricao. Pensado para virar executavel depois."
                >
                  <div className="flex w-full gap-2">
                    <input
                      className={inputClassName}
                      value={fasterWhisperBaseUrlDraft}
                      onChange={(event) => setFasterWhisperBaseUrlDraft(event.target.value)}
                      placeholder="http://localhost:8765"
                      disabled={providerLoading || providerSaving}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void saveProviderConfig(
                          { fasterWhisperBaseUrl: fasterWhisperBaseUrlDraft },
                          "Endpoint do Faster-Whisper salvo",
                        )
                      }
                      disabled={providerLoading || providerSaving}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </Row>

                <Row
                  title="Modelo padrao do Faster-Whisper"
                  desc="Exemplo: tiny, base, small, medium, large-v3 ou outro modelo instalado no worker."
                >
                  <div className="flex w-full gap-2">
                    <input
                      className={inputClassName}
                      value={fasterWhisperModelDraft}
                      onChange={(event) => setFasterWhisperModelDraft(event.target.value)}
                      placeholder="small"
                      disabled={providerLoading || providerSaving}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void saveProviderConfig(
                          { fasterWhisperModel: fasterWhisperModelDraft },
                          "Modelo do Faster-Whisper salvo",
                        )
                      }
                      disabled={providerLoading || providerSaving}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                </Row>
              </Section>

              <Section
                title="Captura e diarização"
                description="Como o áudio da aula ou reunião é capturado e separado por falante."
              >
                <div className="p-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <select
                      className={selectClassName}
                      value={appSettings.values.voice.captureMode}
                      onChange={(event) =>
                        void saveAppSettingsPatch(
                          {
                            voice: {
                              captureMode: event.target.value as
                                | "microphone"
                                | "microphone_and_system",
                            },
                          },
                          "Modo de captura atualizado",
                        )
                      }
                      disabled={appSettingsLoading || appSettingsSaving}
                    >
                      <option value="microphone">Microfone</option>
                      <option value="microphone_and_system">Microfone + reuniao/sistema</option>
                    </select>
                    <select
                      className={selectClassName}
                      value={appSettings.values.voice.diarizationMode}
                      onChange={(event) =>
                        void saveAppSettingsPatch(
                          {
                            voice: {
                              diarizationMode: event.target.value as
                                | "off"
                                | "speaker_labels"
                                | "speaker_labels_with_names",
                            },
                          },
                          "Diarizacao atualizada",
                        )
                      }
                      disabled={appSettingsLoading || appSettingsSaving}
                    >
                      <option value="off">Sem diarizacao</option>
                      <option value="speaker_labels">speaker_1, speaker_2</option>
                      <option value="speaker_labels_with_names">Associacao com nomes</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        void saveAppSettingsPatch(
                          {
                            voice: {
                              preserveSourceTracks: !appSettings.values.voice.preserveSourceTracks,
                            },
                          },
                          "Preferencia de canais atualizada",
                        )
                      }
                      disabled={appSettingsLoading || appSettingsSaving}
                      className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        appSettings.values.voice.preserveSourceTracks
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      {appSettings.values.voice.preserveSourceTracks
                        ? "Canais separados"
                        : "Canais misturados"}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                    <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                      <div className="font-medium text-foreground">Google Meet/Teams</div>
                      <p className="mt-1 leading-5">
                        Use Chrome ou Edge, escolha a aba da reuniao e marque compartilhar audio da
                        aba.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                      <div className="font-medium text-foreground">Fontes separadas</div>
                      <p className="mt-1 leading-5">
                        Microfone e audio remoto sao enviados como faixas independentes para
                        preservar contexto.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                      <div className="font-medium text-foreground">Diarizacao</div>
                      <p className="mt-1 leading-5">
                        O status do worker valida transcricao e separacao de falantes com smoke
                        tests.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-border/70 bg-card/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          Compatibilidade deste navegador
                        </div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">
                          {browserCaptureStatusDetail(browserCaptureSupport)}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] ${appSettingsStatusTone(
                          browserCaptureReadiness,
                        )}`}
                      >
                        {appSettingsStatusLabel(browserCaptureReadiness)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                      <span className="rounded-full border border-border bg-background px-2 py-1">
                        Microfone: {browserCaptureSupport.getUserMedia ? "ok" : "indisponivel"}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-1">
                        Aba/tela: {browserCaptureSupport.getDisplayMedia ? "ok" : "indisponivel"}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-1">
                        Gravador: {browserCaptureSupport.mediaRecorder ? "ok" : "indisponivel"}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2 py-1">
                        Contexto seguro: {browserCaptureSupport.secureContext ? "ok" : "necessario"}
                      </span>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Status do Faster-Whisper" description="Diagnóstico do worker local.">
                <div className="p-5">
                  <div className="grid gap-3">
                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Status
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] ${runtimeStatusTone(fasterWhisperStatus.status)}`}
                        >
                          {runtimeStatusLabel(fasterWhisperStatus.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {fasterWhisperStatus.message}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Runtime
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {fasterWhisperStatus.serviceName}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Backend:{" "}
                        {fasterWhisperStatus.runtimeBackend === "command"
                          ? "command"
                          : fasterWhisperStatus.runtimeBackend === "mock"
                            ? "mock"
                            : "desconhecido"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Wrapper real configurado:{" "}
                        {fasterWhisperStatus.runtimeBackend === "command"
                          ? fasterWhisperStatus.runtimeCommandConfigured
                            ? "sim"
                            : "nao"
                          : "nao se aplica"}
                      </div>
                      <div
                        className={`mt-3 rounded-lg border px-3 py-2 text-xs ${checkTone(
                          fasterWhisperSmokeCheck(fasterWhisperStatus)?.status ??
                            (fasterWhisperStatus.smokeTranscriptionReady ? "pass" : "warn"),
                        )}`}
                      >
                        <div className="font-medium">
                          Smoke do pipeline:{" "}
                          {fasterWhisperStatus.smokeTranscriptionReady
                            ? "validado"
                            : fasterWhisperSmokeCheck(fasterWhisperStatus)?.status === "fail"
                              ? "falhou"
                              : "pendente"}
                        </div>
                        <div className="mt-0.5 opacity-90">
                          {fasterWhisperSmokeCheck(fasterWhisperStatus)?.detail ??
                            "Execute o teste de conexao para validar o pipeline command."}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Endpoint e modelo
                      </div>
                      <div className="mt-2 text-sm font-medium">{fasterWhisperStatus.baseUrl}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Modelo ativo: {fasterWhisperStatus.model}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Verificado em:{" "}
                        {fasterWhisperStatus.checkedAt
                          ? new Date(fasterWhisperStatus.checkedAt).toLocaleString("pt-BR")
                          : "ainda nao verificado"}
                      </div>
                      {typeof fasterWhisperStatus.latencyMs === "number" ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Diagnostico em: {fasterWhisperStatus.latencyMs}ms
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Checklist operacional
                      </div>
                      <div className="mt-3">
                        <ProviderChecks checks={fasterWhisperStatus.checks} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-background/60 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Modelos detectados
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {fasterWhisperStatus.availableModels.length > 0 ? (
                          fasterWhisperStatus.availableModels.map((model) => (
                            <span
                              key={model}
                              className={`rounded-full border px-2 py-1 text-[11px] ${
                                model === fasterWhisperStatus.model
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-border bg-background text-muted-foreground"
                              }`}
                            >
                              {model}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Nenhum modelo foi retornado pelo worker local.
                          </span>
                        )}
                      </div>
                    </div>

                    {(fasterWhisperStatus.status === "mock_mode" ||
                      fasterWhisperStatus.status === "misconfigured") && (
                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
                        {fasterWhisperStatus.status === "mock_mode"
                          ? "O endpoint local esta online, mas ainda gera transcricoes simuladas. O proximo passo e subir o worker com backend=command ligado a um wrapper real do Faster-Whisper."
                          : "O worker entrou em modo command, mas ainda nao recebeu o comando real de transcricao. Configure FASTER_WHISPER_COMMAND antes de usar este runtime em producao."}
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Provedores disponíveis">
                <div className="p-5">
                  <div className="space-y-3">
                    {transcriptionItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/70 bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          </div>
                          <StatusBadge item={item} />
                        </div>
                        {item.reason ? (
                          <div className="mt-3 text-xs text-muted-foreground">{item.reason}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </>
          ) : null}

          {activeSection === "dados" ? (
            <Section
              title="Persistência"
              description="Onde ficam salvas as sessões, transcrições e materiais gerados."
            >
              <div className="p-5">
                <div className="grid gap-3">
                  <select
                    className={selectClassName}
                    value={appSettings.values.database.persistenceProvider}
                    onChange={(event) =>
                      void saveAppSettingsPatch(
                        {
                          database: {
                            persistenceProvider: event.target.value as "local" | "supabase",
                          },
                        },
                        "Provider de persistencia atualizado",
                      )
                    }
                    disabled={appSettingsLoading || appSettingsSaving}
                  >
                    <option value="local">Local</option>
                    <option value="supabase">Supabase</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      className={inputClassName}
                      value={supabaseUrlDraft}
                      onChange={(event) => setSupabaseUrlDraft(event.target.value)}
                      placeholder="https://seu-projeto.supabase.co"
                      disabled={appSettingsLoading || appSettingsSaving}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void saveAppSettingsPatch(
                          { database: { supabaseUrl: supabaseUrlDraft } },
                          "URL do Supabase salva",
                        )
                      }
                      disabled={appSettingsLoading || appSettingsSaving}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Salvar
                    </button>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      Service role{" "}
                      {supabaseSecret?.configured ? `(${supabaseSecret.maskedValue})` : ""}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={inputClassName}
                        value={supabaseServiceKeyDraft}
                        onChange={(event) => setSupabaseServiceKeyDraft(event.target.value)}
                        placeholder="eyJ..."
                        type="password"
                        disabled={appSettingsLoading || appSettingsSaving}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void saveAppSettingsPatch(
                            { secrets: { SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKeyDraft } },
                            "Chave Supabase salva no backend",
                          )
                        }
                        disabled={
                          !supabaseServiceKeyDraft.trim() || appSettingsLoading || appSettingsSaving
                        }
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          ) : null}

          {activeSection === "diagnostico" ? (
            <>
              <Section
                title="Status geral"
                description="Providers, banco e captura checados pelo backend com o estado salvo agora."
                action={
                  <span
                    className={`w-fit rounded-full border px-2 py-1 text-[11px] ${
                      appSettingsLoading
                        ? appSettingsStatusTone("unknown")
                        : appSettingsStatusTone(
                            appSettings.categories.some((item) => item.status === "blocked")
                              ? "blocked"
                              : appSettings.categories.some((item) => item.status === "attention")
                                ? "attention"
                                : "ready",
                          )
                    }`}
                  >
                    {appSettingsLoading
                      ? "Carregando"
                      : appSettingsStatusLabel(
                          appSettings.categories.some((item) => item.status === "blocked")
                            ? "blocked"
                            : appSettings.categories.some((item) => item.status === "attention")
                              ? "attention"
                              : "ready",
                        )}
                  </span>
                }
              >
                <div className="space-y-4 p-5">
                  {appSettingsError ? (
                    <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {appSettingsError}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {featuredSettingsCategories.map((categoryItem) => (
                      <div
                        key={categoryItem.id}
                        className="rounded-xl border border-border/70 bg-background/60 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium">{categoryItem.label}</div>
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] ${appSettingsStatusTone(
                              categoryItem.status,
                            )}`}
                          >
                            {appSettingsStatusLabel(categoryItem.status)}
                          </span>
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {categoryItem.description}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Search className="h-4 w-4 text-primary" />
                          Validacao em tempo real
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Providers, banco e captura sao checados pelo backend com o estado salvo
                          agora.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] ${appSettingsStatusTone(
                            appSettingsValidation.status,
                          )}`}
                        >
                          {appSettingsStatusLabel(appSettingsValidation.status)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void validateAppSettings({ notify: true })}
                          disabled={appSettingsValidationLoading}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2 text-xs transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {appSettingsValidationLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {appSettingsValidation.checks.length > 0 ? (
                        appSettingsValidation.checks.slice(0, 8).map((check) => (
                          <div
                            key={check.id}
                            className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{check.label}</span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] ${appSettingsStatusTone(
                                  check.status,
                                )}`}
                              >
                                {appSettingsStatusLabel(check.status)}
                              </span>
                            </div>
                            <div className="mt-1 leading-relaxed text-muted-foreground">
                              {check.detail}
                            </div>
                            {typeof check.latencyMs === "number" ? (
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                Latencia: {check.latencyMs}ms
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
                          Execute Revalidar para carregar o primeiro status operacional.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Saúde operacional" description="O que está pronto para uso agora.">
                <div className="p-5 text-xs text-muted-foreground">
                  <div className="grid gap-2">
                    <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-foreground">Modo offline</div>
                        <span
                          className={`rounded-full border px-2 py-1 text-[11px] ${offlineStatusTone(
                            runtimeHealth.offlineReadiness.status,
                          )}`}
                        >
                          {offlineStatusLabel(runtimeHealth.offlineReadiness.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {runtimeHealth.offlineReadiness.summary}
                      </div>
                      {runtimeHealth.offlineReadiness.issues[0] ? (
                        <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                          {runtimeHealth.offlineReadiness.issues[0]}
                        </div>
                      ) : null}
                    </div>
                    {runtimeHealth.capabilities.map((item) => (
                      <div
                        key={item.capability}
                        className="rounded-lg border border-border/70 bg-background/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-foreground">{item.label}</div>
                          <span
                            className={`rounded-full border px-2 py-1 text-[11px] ${capabilityStatusTone(item.status)}`}
                          >
                            {capabilityStatusLabel(item.status)}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Provider: {capabilityProviderLabel(item.selectedProvider)}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{item.summary}</div>
                        {item.issues[0] ? (
                          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                            {item.issues[0]}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <Search className="h-3.5 w-3.5" />
                      <span>{localStackSummary(runtimeHealth)}</span>
                    </div>
                    <div>
                      Ultima verificacao:{" "}
                      {runtimeHealth.checkedAt
                        ? new Date(runtimeHealth.checkedAt).toLocaleString("pt-BR")
                        : "ainda nao verificada"}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Modo offline">
                <Row
                  title="Preset offline"
                  desc="Aplica Faster-Whisper, Ollama e busca web desligada em uma unica acao."
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => void applyOfflinePreset()}
                      disabled={providerLoading || providerSaving}
                      className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-medium text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {providerSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Aplicar configuracao offline
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Mantem os endpoints e modelos digitados acima antes de testar a saude
                      operacional.
                    </span>
                  </div>
                </Row>
              </Section>

              <Section
                title="Guia de ativação local"
                description="Passo a passo para deixar transcrição e IA locais prontas."
                action={
                  <span
                    className={`w-fit rounded-full border px-2 py-1 text-[11px] ${offlineStatusTone(
                      runtimeHealth.offlineReadiness.status,
                    )}`}
                  >
                    {offlineStatusLabel(runtimeHealth.offlineReadiness.status)}
                  </span>
                }
              >
                <div className="p-5">
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {runtimeHealth.setupGuide.length > 0 ? (
                      runtimeHealth.setupGuide.map((step, index) => (
                        <div
                          key={step.id}
                          className="rounded-xl border border-border/70 bg-background/60 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                Passo {index + 1}
                              </div>
                              <div className="mt-1 text-sm font-medium">{step.label}</div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${setupStepTone(
                                step.status,
                              )}`}
                            >
                              {setupStepLabel(step.status)}
                            </span>
                          </div>
                          <div className="mt-3 text-xs font-medium text-foreground">
                            {step.action}
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {step.detail}
                          </div>
                          {step.command ? (
                            <div className="mt-3 rounded-lg border border-border/70 bg-muted/50 p-2">
                              <div className="flex items-start justify-between gap-3">
                                <code className="font-mono text-[11px] leading-relaxed text-foreground">
                                  {step.command}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copySetupCommand(step.command ?? "")}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] transition hover:bg-muted"
                                >
                                  <Copy className="h-3 w-3" />
                                  Copiar
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-xs text-muted-foreground">
                        Execute a verificacao de saude operacional para montar o guia local.
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              <Section
                title="Histórico de diagnósticos"
                description="Últimas verificações, para ver quando algo melhora ou piora."
                action={
                  <span className="w-fit rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    {runtimeHistory.entries.length} eventos
                  </span>
                }
              >
                <div className="p-5">
                  <div className="mt-4 grid gap-3">
                    {runtimeHistoryLoading ? (
                      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 p-4 text-xs text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando historico de diagnosticos...
                      </div>
                    ) : runtimeHistory.entries.length > 0 ? (
                      runtimeHistory.entries.slice(0, 5).map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-border/70 bg-background/60 p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-xs font-medium text-foreground">
                                {entry.checkedAt
                                  ? new Date(entry.checkedAt).toLocaleString("pt-BR")
                                  : "Verificacao sem data"}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {entry.offlineSummary}
                              </div>
                            </div>
                            <span
                              className={`w-fit rounded-full border px-2 py-1 text-[11px] ${offlineStatusTone(
                                entry.offlineStatus,
                              )}`}
                            >
                              {offlineStatusLabel(entry.offlineStatus)}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span className="rounded-full border border-border bg-card px-2 py-1">
                              Ollama: {runtimeStatusLabel(entry.ollamaStatus)}
                            </span>
                            <span className="rounded-full border border-border bg-card px-2 py-1">
                              Faster-Whisper: {runtimeStatusLabel(entry.fasterWhisperStatus)}
                            </span>
                            <span className="rounded-full border border-border bg-card px-2 py-1">
                              Smoke: {entry.fasterWhisperSmokeReady ? "pronto" : "pendente"}
                            </span>
                            <span className="rounded-full border border-border bg-card px-2 py-1">
                              Diarizacao:{" "}
                              {entry.fasterWhisperDiarizationReady ? "pronta" : "pendente"}
                            </span>
                            <span className="rounded-full border border-border bg-card px-2 py-1">
                              Pontos de atencao: {entry.issueCount}
                            </span>
                          </div>
                          {entry.firstIssue ? (
                            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                              {entry.firstIssue}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-border/70 bg-background/60 p-4 text-xs text-muted-foreground">
                        Nenhum diagnostico salvo ainda. Use Revalidar para registrar o primeiro
                        ponto de qualidade operacional.
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            </>
          ) : null}

          <div className="flex items-start gap-2 rounded-xl border border-border bg-gradient-brand-soft px-4 py-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              O audio continua salvo localmente. As chaves de IA permanecem no backend e nao ficam
              expostas no navegador.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
