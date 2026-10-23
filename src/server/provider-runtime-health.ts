import type {
  FasterWhisperConnectionStatus,
  OllamaConnectionStatus,
  ProviderCapabilityRuntime,
  ProviderRuntimeHealthEnvelope,
  ProviderSetupStep,
} from "@/lib/voice-intelligence";
import { getFasterWhisperConnectionStatus } from "./faster-whisper-provider";
import { getOllamaConnectionStatus } from "./ollama-provider";
import {
  getProviderRuntimeConfig,
  providerHasGeminiKey,
  providerHasOpenAIKey,
  resolveAssistantWebSearchMode,
  simulatedProvidersEnabled,
} from "./provider-runtime";

function issues(detail?: string) {
  return detail ? [detail] : [];
}

function openAIConfigured() {
  return providerHasOpenAIKey();
}

function geminiConfigured() {
  return providerHasGeminiKey();
}

function webSearchConfigured() {
  const mode = resolveAssistantWebSearchMode();
  return mode === "off" || openAIConfigured();
}

function webSearchDisabled() {
  return resolveAssistantWebSearchMode() === "off";
}

function capability(
  input: Omit<ProviderCapabilityRuntime, "issues"> & { issues?: string[] },
): ProviderCapabilityRuntime {
  return {
    ...input,
    issues: input.issues ?? issues(input.detail),
  };
}

function mapFasterWhisperCapability(status: FasterWhisperConnectionStatus) {
  if (status.status === "ready") {
    return capability({
      capability: "transcription",
      label: "Transcricao",
      selectedProvider: "faster-whisper",
      status: "ready",
      summary: "Worker local pronto para transcricao real.",
      detail: status.message,
    });
  }

  if (status.status === "mock_mode") {
    return capability({
      capability: "transcription",
      label: "Transcricao",
      selectedProvider: "faster-whisper",
      status: "blocked",
      summary: "Worker local conectado, mas ainda em modo simulado.",
      detail:
        "Selecione o provider simulado explicitamente para testes ou suba o Faster-Whisper com backend=command para transcricao real.",
    });
  }

  if (status.status === "misconfigured") {
    return capability({
      capability: "transcription",
      label: "Transcricao",
      selectedProvider: "faster-whisper",
      status: "blocked",
      summary: "Worker local encontrado, mas incompleto para producao.",
      detail: status.message,
    });
  }

  return capability({
    capability: "transcription",
    label: "Transcricao",
    selectedProvider: "faster-whisper",
    status: "blocked",
    summary:
      status.status === "model_missing"
        ? "Worker local respondeu, mas o modelo configurado nao esta disponivel."
        : "Worker local indisponivel.",
    detail: status.message,
  });
}

function mapOllamaCapability(
  capabilityKey: "materials" | "chat",
  status: OllamaConnectionStatus,
): ProviderCapabilityRuntime {
  if (status.status === "ready") {
    return capability({
      capability: capabilityKey,
      label: capabilityKey === "materials" ? "Materiais" : "Chat",
      selectedProvider: "ollama",
      status: capabilityKey === "materials" && !status.jsonGenerationReady ? "limited" : "ready",
      summary:
        capabilityKey === "materials" && !status.jsonGenerationReady
          ? "Ollama conectado, mas geracao estruturada precisa de atencao."
          : "Ollama pronto para responder localmente.",
      detail: status.message,
    });
  }

  return capability({
    capability: capabilityKey,
    label: capabilityKey === "materials" ? "Materiais" : "Chat",
    selectedProvider: "ollama",
    status: "blocked",
    summary:
      status.status === "model_missing"
        ? "Ollama respondeu, mas o modelo configurado nao foi encontrado."
        : "Ollama indisponivel para esta capacidade.",
    detail: status.message,
  });
}

function mapCloudCapability(
  capabilityKey: "transcription" | "materials" | "chat",
  provider: "openai" | "gemini",
): ProviderCapabilityRuntime {
  const ready = provider === "openai" ? openAIConfigured() : geminiConfigured();
  const providerLabel = provider === "openai" ? "OpenAI" : "Gemini";
  const capabilityLabel =
    capabilityKey === "transcription"
      ? "Transcricao"
      : capabilityKey === "materials"
        ? "Materiais"
        : "Chat";
  const missingEnv = provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";

  return capability({
    capability: capabilityKey,
    label: capabilityLabel,
    selectedProvider: provider,
    status: ready ? "ready" : "blocked",
    summary: ready
      ? `${providerLabel} configurado para ${capabilityLabel.toLowerCase()}.`
      : `${providerLabel} selecionado, mas sem credencial configurada.`,
    detail: ready
      ? `${providerLabel} pode atender essa capacidade agora.`
      : `Configure ${missingEnv}.`,
  });
}

function mapMockCapability(
  capabilityKey: "transcription" | "materials" | "chat",
): ProviderCapabilityRuntime {
  const enabled = simulatedProvidersEnabled();
  const capabilityLabel =
    capabilityKey === "transcription"
      ? "Transcricao"
      : capabilityKey === "materials"
        ? "Materiais"
        : "Chat";

  return capability({
    capability: capabilityKey,
    label: capabilityLabel,
    selectedProvider: "mock",
    status: enabled ? "development_only" : "blocked",
    summary: enabled
      ? `${capabilityLabel} em modo simulado de desenvolvimento.`
      : `${capabilityLabel} simulado bloqueado fora do modo de desenvolvimento.`,
    detail: enabled
      ? "Resultados simulados so devem ser usados em testes controlados."
      : "Ative EDUCAI_ENABLE_SIMULATED_PROVIDERS=true apenas em ambientes de teste.",
  });
}

function assistantCapability(
  generationProvider: string,
  ollamaStatus: OllamaConnectionStatus,
): ProviderCapabilityRuntime {
  const issuesList: string[] = [];
  const selectedGenerationReady =
    generationProvider === "openai"
      ? openAIConfigured()
      : generationProvider === "gemini"
        ? geminiConfigured()
        : generationProvider === "ollama"
          ? ollamaStatus.status === "ready"
          : generationProvider === "mock"
            ? simulatedProvidersEnabled()
            : false;

  if (!webSearchConfigured()) {
    issuesList.push("Busca web com fontes atuais depende de OPENAI_API_KEY.");
  }

  if (selectedGenerationReady) {
    return capability({
      capability: "assistant",
      label: "Assistente",
      selectedProvider: generationProvider,
      status: issuesList.length > 0 ? "limited" : "ready",
      summary:
        issuesList.length > 0
          ? "Assistente funcional, mas com limitacoes em consultas externas recentes."
          : "Assistente pronto com conhecimento local e provider configurado.",
      detail:
        issuesList.length > 0
          ? issuesList.join(" ")
          : "Rotas locais, provider configurado e enriquecimento externo disponivel quando necessario.",
      issues: issuesList,
    });
  }

  const fallbackProviderAvailable =
    openAIConfigured() || geminiConfigured() || ollamaStatus.status === "ready";

  if (fallbackProviderAvailable) {
    return capability({
      capability: "assistant",
      label: "Assistente",
      selectedProvider: generationProvider,
      status: "limited",
      summary: "Assistente ainda responde, mas o provider selecionado nao e o mais saudavel agora.",
      detail:
        "O conhecimento local continua disponivel e o backend ainda pode recorrer a outros providers reais quando configurados.",
      issues: issuesList,
    });
  }

  return capability({
    capability: "assistant",
    label: "Assistente",
    selectedProvider: generationProvider,
    status: "limited",
    summary: "Assistente funcional apenas com conhecimento local e contexto da sessao.",
    detail:
      "Perguntas amplas, respostas generativas profundas e busca web ficam limitadas ate configurar OpenAI, Gemini ou Ollama.",
    issues: issuesList,
  });
}

function offlineReadiness(
  transcriptionProvider: string,
  generationProvider: string,
  fasterWhisperStatus: FasterWhisperConnectionStatus,
  ollamaStatus: OllamaConnectionStatus,
): ProviderRuntimeHealthEnvelope["offlineReadiness"] {
  const issuesList: string[] = [];

  if (transcriptionProvider !== "faster-whisper") {
    issuesList.push("Transcricao ainda nao esta selecionada como Faster-Whisper.");
  } else if (
    fasterWhisperStatus.status !== "ready" ||
    !fasterWhisperStatus.smokeTranscriptionReady
  ) {
    issuesList.push(fasterWhisperStatus.message);
  } else if (!fasterWhisperStatus.smokeDiarizationReady) {
    issuesList.push(
      "Diarizacao local ainda nao passou no smoke test; falantes remotos podem usar fallback.",
    );
  }

  if (generationProvider !== "ollama") {
    issuesList.push("IA generativa ainda nao esta selecionada como Ollama.");
  } else if (ollamaStatus.status !== "ready") {
    issuesList.push(ollamaStatus.message);
  } else if (!ollamaStatus.jsonGenerationReady) {
    issuesList.push(
      "Ollama responde, mas a geracao JSON estruturada ainda precisa de reparo/validacao.",
    );
  }

  if (!webSearchDisabled()) {
    issuesList.push("Busca web da assistente precisa ficar em off para operacao offline total.");
  }

  if (issuesList.length === 0) {
    return {
      status: "ready",
      summary: "Pilha offline pronta: Faster-Whisper, Ollama e busca web desligada.",
      issues: [],
    };
  }

  const hasLocalProviderSelected =
    transcriptionProvider === "faster-whisper" || generationProvider === "ollama";

  return {
    status: hasLocalProviderSelected ? "partial" : "blocked",
    summary: hasLocalProviderSelected
      ? "Pilha offline parcialmente preparada."
      : "Pilha offline ainda nao esta selecionada.",
    issues: issuesList,
  };
}

function setupStep(
  id: string,
  label: string,
  status: ProviderSetupStep["status"],
  action: string,
  detail: string,
  command?: string,
): ProviderSetupStep {
  return {
    id,
    label,
    status,
    action,
    detail,
    command,
  };
}

function localSetupGuide(
  transcriptionProvider: string,
  generationProvider: string,
  fasterWhisperStatus: FasterWhisperConnectionStatus,
  ollamaStatus: OllamaConnectionStatus,
): ProviderSetupStep[] {
  const steps: ProviderSetupStep[] = [];

  steps.push(
    setupStep(
      "select-local-transcription",
      "Selecionar transcricao local",
      transcriptionProvider === "faster-whisper" ? "done" : "todo",
      "Escolha Faster-Whisper como provider de transcricao.",
      transcriptionProvider === "faster-whisper"
        ? "A transcricao local ja esta selecionada."
        : "Sem isso, a captura ainda depende de OpenAI, Gemini ou modo simulado.",
      undefined,
    ),
  );

  steps.push(
    setupStep(
      "start-faster-whisper-worker",
      "Subir worker Faster-Whisper",
      fasterWhisperStatus.reachable ? "done" : "blocked",
      "Inicie o worker local em FASTER_WHISPER_BASE_URL.",
      fasterWhisperStatus.reachable
        ? `Worker respondeu em ${fasterWhisperStatus.baseUrl}.`
        : fasterWhisperStatus.message,
      "npm.cmd run dev:faster-whisper-worker",
    ),
  );

  steps.push(
    setupStep(
      "configure-faster-whisper-command",
      "Configurar comando real de transcricao",
      fasterWhisperStatus.smokeTranscriptionReady
        ? "done"
        : fasterWhisperStatus.reachable
          ? "todo"
          : "blocked",
      "Configure FASTER_WHISPER_COMMAND e use backend=command.",
      fasterWhisperStatus.smokeTranscriptionReady
        ? "Backend command, comando e modelo estao prontos para transcricao real."
        : "Enquanto este passo nao estiver pronto, o worker pode responder sem transcrever audio real.",
      '$env:FASTER_WHISPER_WORKER_BACKEND="command"; $env:FASTER_WHISPER_COMMAND="node --import tsx workers/faster-whisper-local/command-bridge.ts"; npm.cmd run dev:faster-whisper-worker',
    ),
  );

  steps.push(
    setupStep(
      "configure-faster-whisper-diarization",
      "Configurar diarizacao real",
      fasterWhisperStatus.smokeDiarizationReady
        ? "done"
        : fasterWhisperStatus.reachable
          ? "todo"
          : "blocked",
      "Configure FASTER_WHISPER_DIARIZATION_COMMAND para separar falantes do audio remoto.",
      fasterWhisperStatus.smokeDiarizationReady
        ? "Diarizacao real passou no smoke test do worker local."
        : "Sem este passo, o app usa rotulos simulados/heuristicos para speaker_1, speaker_2.",
      '$env:FASTER_WHISPER_DIARIZATION_COMMAND="node --import tsx workers/faster-whisper-local/diarization-bridge.ts"; $env:FASTER_WHISPER_DIARIZATION_BRIDGE_BACKEND="http"; $env:FASTER_WHISPER_DIARIZATION_BRIDGE_URL="http://127.0.0.1:9001/diarize"',
    ),
  );

  steps.push(
    setupStep(
      "select-local-generation",
      "Selecionar IA local",
      generationProvider === "ollama" ? "done" : "todo",
      "Escolha Ollama como provider de IA generativa.",
      generationProvider === "ollama"
        ? "A geracao local ja esta selecionada."
        : "Materiais e chat ainda podem depender de cloud ou modo simulado.",
      undefined,
    ),
  );

  steps.push(
    setupStep(
      "start-ollama",
      "Subir Ollama",
      ollamaStatus.reachable ? "done" : "blocked",
      "Inicie o Ollama e confirme OLLAMA_BASE_URL.",
      ollamaStatus.reachable
        ? `Ollama respondeu em ${ollamaStatus.baseUrl}.`
        : ollamaStatus.message,
      "ollama serve",
    ),
  );

  steps.push(
    setupStep(
      "pull-ollama-model",
      "Disponibilizar modelo local",
      ollamaStatus.activeModelAvailable ? "done" : ollamaStatus.reachable ? "todo" : "blocked",
      `Baixe ou selecione o modelo ${ollamaStatus.model}.`,
      ollamaStatus.activeModelAvailable
        ? `Modelo ${ollamaStatus.model} encontrado.`
        : "O endpoint respondeu, mas o modelo configurado nao apareceu na lista local.",
      `ollama pull ${ollamaStatus.model}`,
    ),
  );

  steps.push(
    setupStep(
      "validate-ollama-json",
      "Validar materiais estruturados",
      ollamaStatus.jsonGenerationReady
        ? "done"
        : ollamaStatus.activeModelAvailable
          ? "todo"
          : "blocked",
      "Execute o teste de conexao do Ollama e confirme geracao JSON.",
      ollamaStatus.jsonGenerationReady
        ? "O modelo respondeu JSON simples valido."
        : "Chat pode funcionar, mas materiais estruturados ainda precisam de validacao ou reparo.",
      undefined,
    ),
  );

  steps.push(
    setupStep(
      "disable-web-search",
      "Desligar busca web para offline total",
      webSearchDisabled() ? "done" : "todo",
      "Defina busca web da assistente como off.",
      webSearchDisabled()
        ? "A assistente nao tentara consultar fontes externas."
        : "Enquanto a busca web estiver auto/on, a operacao nao e totalmente offline.",
      '$env:EDUCAI_ASSISTANT_WEB_SEARCH="off"',
    ),
  );

  return steps;
}

export async function getProviderRuntimeHealth(): Promise<ProviderRuntimeHealthEnvelope> {
  const {
    settings: { transcriptionProvider, generationProvider },
  } = getProviderRuntimeConfig();

  const [fasterWhisper, ollama] = await Promise.all([
    getFasterWhisperConnectionStatus(),
    getOllamaConnectionStatus(),
  ]);

  const capabilities: ProviderCapabilityRuntime[] = [];

  if (transcriptionProvider === "mock") {
    capabilities.push(mapMockCapability("transcription"));
  } else if (transcriptionProvider === "openai" || transcriptionProvider === "gemini") {
    capabilities.push(mapCloudCapability("transcription", transcriptionProvider));
  } else {
    capabilities.push(mapFasterWhisperCapability(fasterWhisper));
  }

  if (generationProvider === "mock") {
    capabilities.push(mapMockCapability("materials"));
    capabilities.push(mapMockCapability("chat"));
  } else if (generationProvider === "openai" || generationProvider === "gemini") {
    capabilities.push(mapCloudCapability("materials", generationProvider));
    capabilities.push(mapCloudCapability("chat", generationProvider));
  } else {
    capabilities.push(mapOllamaCapability("materials", ollama));
    capabilities.push(mapOllamaCapability("chat", ollama));
  }

  capabilities.push(assistantCapability(generationProvider, ollama));

  return {
    checkedAt: new Date().toISOString(),
    capabilities,
    offlineReadiness: offlineReadiness(
      transcriptionProvider,
      generationProvider,
      fasterWhisper,
      ollama,
    ),
    setupGuide: localSetupGuide(transcriptionProvider, generationProvider, fasterWhisper, ollama),
    localProviders: {
      ollama,
      fasterWhisper,
    },
  };
}
