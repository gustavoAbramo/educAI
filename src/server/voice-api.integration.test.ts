import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { VoiceSession } from "@/lib/voice-intelligence";
import { buildLiveAssistantResponse, type LiveAssistantContext } from "@/lib/live-assistant";
import { matchWakeWord } from "@/lib/speech";
import { callMaterialsFromGeneratedPayload } from "./material-generation";
import { setServerRuntimeEnv } from "./runtime-env";
import { transcriptSegmentsFromText } from "./transcript-segments";
import { loadPersistedVoiceSessions, savePersistedVoiceSessions } from "./local-persistence";

type ApiHandler = (request: Request) => Promise<Response | null>;

type JsonBody = {
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  error?: {
    code: string;
    message: string;
  };
};

const tempRoot = path.join(os.tmpdir(), `educai-v1-${Date.now()}-${Math.random()}`);
const storePath = path.join(tempRoot, "voice-sessions.json");
const recordingsDir = path.join(tempRoot, "recordings");

let handleVoiceApiRequest: ApiHandler;

async function api(method: string, pathname: string, init: RequestInit = {}) {
  const request = new Request(`http://localhost:5173${pathname}`, {
    method,
    ...init,
  });

  const response = await handleVoiceApiRequest(request);
  if (!response) {
    throw new Error(`Expected API response for ${pathname}`);
  }

  const json = (await response.json()) as JsonBody;
  return { response, json };
}

function makeAssistantContext(overrides: Partial<LiveAssistantContext> = {}): LiveAssistantContext {
  return {
    sessionTitle: "Sessao de teste",
    sessionType: "CLASS",
    recording: true,
    activeSpeaker: "Pessoa 1",
    transcriptSegments: [
      {
        speakerName: "Pessoa 1",
        text: "Falamos sobre API, backend e autenticacao.",
        confidence: 0.91,
        clarity: 0.84,
        conviction: 0.79,
        verbalQuality: "adequada",
        technicalTerms: ["API", "backend", "autenticacao"],
        createdAt: 1717200000000,
        offsetMs: 12000,
      },
    ],
    interimTranscript: "",
    insights: {
      terms: ["API", "backend"],
      transcriptionIssues: ["Trecho com pausa longa"],
      importantPoints: ["Separar frontend e backend ajuda na manutencao."],
      languageIssues: ["Uso de linguagem um pouco informal"],
    },
    ...overrides,
  };
}

describe("material generation formatting", () => {
  it("keeps the V1 material shape while formatting rich AI payloads", () => {
    const session: VoiceSession = {
      id: "ses_test",
      type: "CLASS",
      title: "Industrializacao",
      language: "pt-BR",
      status: "CREATED",
      participants: [],
      summaryTemplate: "Para alunos",
      metadata: {
        outputsRequested: ["Resumo", "Relatorio tecnico", "Mapa mental"],
      },
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    };

    const materials = callMaterialsFromGeneratedPayload(
      session,
      {
        summary: {
          coreMessage: "A industrializacao alterou trabalho e cidade.",
          overview: "A aula explicou causas e impactos da industrializacao.",
          keyTakeaways: ["Maquinas mudaram o trabalho."],
          boundaries: "A transcricao nao detalha todas as fases industriais.",
        },
        technicalReport: {
          generalSummary:
            "A aula explicou a industrializacao como mudanca no trabalho, na cidade e na producao.",
          importantPoints: ["Maquinas", "Urbanizacao", "Proletariado"],
          communicationAnalysis:
            "A fala foi organizada e didatica, com boa sequencia causal e termos adequados para alunos.",
          languageAndInformalityIssues: [
            {
              expression: "tipo assim",
              analysis: "Pode soar informal se aparecer repetidamente durante a explicacao.",
            },
          ],
          improvementPoints: ["Adicionar linha do tempo no proximo material."],
          positivePoints: ["A comparacao entre oficina e fabrica ajuda a fixacao."],
        },
        topics: [],
        actionItems: [],
        questions: [],
        mindMap: {
          centralTheme: "Industrializacao",
          branches: [{ title: "Causas", children: [{ title: "Energia", children: ["Carvao"] }] }],
        },
      },
      "test:model",
      "2026-05-29T00:00:00.000Z",
    );

    assert.deepEqual(
      materials.items.map((item) => item.type),
      ["SUMMARY", "INSIGHTS", "MIND_MAP"],
    );
    assert.equal(materials.items[0]?.format, "MARKDOWN");
    assert.match(materials.items[0]?.content ?? "", /### Pontos-chave/);
    assert.match(materials.items[1]?.content ?? "", /## Resumo geral/);
    assert.match(materials.items[1]?.content ?? "", /## Erros de linguagem/);
    assert.match(materials.items[2]?.content ?? "", /## Causas/);
    assert.match(materials.items[2]?.content ?? "", / {2}- Carvao/);
  });

  it("formats study questions as grouped questions and answers", () => {
    const session: VoiceSession = {
      id: "ses_questions",
      type: "CLASS",
      title: "Aula sobre Lovable",
      language: "pt-BR",
      status: "CREATED",
      participants: [],
      metadata: {
        outputsRequested: ["Perguntas"],
      },
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    };

    const materials = callMaterialsFromGeneratedPayload(
      session,
      {
        questions: [
          {
            question: "Qual é a principal diferença entre front end e back end?",
            expectedAnswer:
              "O front end é a camada visual usada pelo usuário, enquanto o back end processa regras, integrações e dados.",
            difficulty: "BASIC",
            skillTarget: "conceitual",
            reviewTip: "Explique as duas camadas usando um exemplo de tela e servidor.",
          },
          {
            question: "O que acontece quando o usuário clica em salvar?",
            expectedAnswer:
              "A interface envia os dados para a API, que valida as informações, aplica regras de negócio e salva no banco de dados.",
            difficulty: "INTERMEDIATE",
            reviewTip: "Desenhe o caminho do clique ate o banco de dados.",
            skillTarget: "prática",
          },
          {
            question: "Por que separar responsabilidades melhora a manutenção?",
            expectedAnswer:
              "Porque cada camada fica com uma função clara, reduz acoplamento e facilita testar ou alterar partes do sistema.",
            difficulty: "ADVANCED",
            reviewTip: "Compare uma mudanca isolada com uma mudanca que afeta todo o sistema.",
            skillTarget: "reflexão técnica",
          },
        ],
      },
      "test:model",
      "2026-05-29T00:00:00.000Z",
    );

    assert.deepEqual(
      materials.items.map((item) => item.type),
      ["QUESTIONS"],
    );
    const content = materials.items[0]?.content ?? "";
    assert.match(content, /## Fáceis/);
    assert.match(content, /## Médias/);
    assert.match(content, /## Reflexivas/);
    assert.match(content, /Resposta: O front-end/);
    assert.match(content, /Como revisar: Desenhe/);
    assert.match(content, /Foco: prática/);
    assert.match(content, /Nível: BASIC/);
    assert.match(content, /## Fáceis/);
    assert.match(content, /## Médias/);
    assert.match(content, /## Reflexivas/);
    assert.match(content, /Resposta: O front-end/);
    assert.match(content, /Como revisar: Desenhe/);
    assert.match(content, /Foco: prática/);
    assert.match(content, /Nível: BASIC/);
  });

  it("formats action items as concrete tasks with priority and success criteria", () => {
    const session: VoiceSession = {
      id: "ses_actions",
      type: "CLASS",
      title: "Aula sobre APIs",
      language: "pt-BR",
      status: "CREATED",
      participants: [],
      metadata: {
        outputsRequested: ["Acoes"],
      },
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    };

    const materials = callMaterialsFromGeneratedPayload(
      session,
      {
        actionItems: [
          {
            task: "Refazer a explicacao sobre autenticacao usando um exemplo de login.",
            category: "COMMUNICATION",
            ownerOrAudience: "Professor",
            priority: "HIGH",
            reason: "A transcricao mencionou autenticacao, mas nao trouxe exemplo suficiente.",
            successCriterion: "O aluno consegue explicar token e login em duas frases.",
          },
        ],
      },
      "test:model",
      "2026-05-29T00:00:00.000Z",
    );

    assert.deepEqual(
      materials.items.map((item) => item.type),
      ["ACTION_ITEMS"],
    );
    const content = materials.items[0]?.content ?? "";
    assert.match(content, /\[HIGH \| COMMUNICATION\]/);
    assert.match(content, /Responsavel: Professor/);
    assert.match(content, /Criterio: O aluno consegue/);
  });

  it("formats lesson diagnosis with honest structure and response guidance", () => {
    const session: VoiceSession = {
      id: "ses_diagnosis",
      type: "SALES_CALL",
      title: "Conversa comercial",
      language: "pt-BR",
      status: "CREATED",
      participants: [],
      metadata: {
        outputsRequested: ["Diagnostico da aula"],
      },
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
    };

    const materials = callMaterialsFromGeneratedPayload(
      session,
      {
        lessonDiagnosis: {
          summary:
            "A conversa mostrou dor com perda de informacao e abertura para um fluxo mais confiavel.",
          painPoints: [
            {
              title: "Perda de historico depois das chamadas",
              evidence: "O cliente citou dificuldade para retomar pontos importantes.",
              impact: "Isso atrasa follow-up e enfraquece a tomada de decisao.",
            },
          ],
          recurringQuestions: [
            {
              question: "Como garantir que nada importante se perca depois da reuniao?",
              evidence: "A pergunta apareceu de formas diferentes ao longo da conversa.",
              whyItMatters: "A dor central ainda nao estava resolvida.",
            },
          ],
          objections: [],
          opportunities: [
            {
              title: "Conectar transcricao e follow-up automatico",
              evidence: "A conversa apontou valor em resumo e acoes praticas.",
              whyItMatters: "Pode acelerar a resposta apos a chamada.",
              nextStep: "Mostrar um exemplo de fluxo completo.",
            },
          ],
          attentionPoints: [],
          decisionsAndTasks: [
            {
              type: "TASK",
              item: "Montar uma demonstracao curta do fluxo fim a fim.",
              ownerOrAudience: "Equipe comercial",
              urgency: "HIGH",
              evidence: "A conversa pediu algo concreto para validar valor.",
            },
          ],
          actionableSummary: ["Priorizar uma demonstracao curta e objetiva."],
          practicalRecommendations: [
            "Responder a dor com exemplo pratico antes de aprofundar stack.",
          ],
          responseGuidance: [
            {
              scenario: "pain",
              relatedSignal: "Perda de historico depois das chamadas",
              recommendedResponse:
                "Faz sentido priorizar isso. Se resolvermos captura e follow-up com consistencia, o ganho aparece rapido sem aumentar a operacao.",
              reason: "A resposta acolhe a dor e ancora valor pratico.",
              confidence: "HIGH",
              tone: "CONSULTIVO",
              nextQuestion: "Hoje essa perda pesa mais em historico, tarefa ou decisao?",
            },
          ],
        },
      },
      "test:model",
      "2026-05-29T00:00:00.000Z",
    );

    assert.deepEqual(
      materials.items.map((item) => item.type),
      ["LESSON_DIAGNOSIS"],
    );
    const content = materials.items[0]?.content ?? "";
    assert.match(content, /## Dores identificadas/);
    assert.match(content, /## Duvidas recorrentes/);
    assert.match(content, /## Respostas sugeridas/);
    assert.match(content, /Resposta recomendada:/);
    assert.match(content, /Tom: CONSULTIVO/);
  });
});

describe("transcript speaker parsing", () => {
  it("preserves provider speaker labels as transcript segments", () => {
    const session: VoiceSession = {
      id: "ses_speakers",
      type: "CLASS",
      title: "Aula com debate",
      language: "pt-BR",
      status: "CREATED",
      participants: [{ name: "Professora Ana" }, { name: "Aluno Bruno" }],
      metadata: {},
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };

    const segments = transcriptSegmentsFromText(
      session,
      [
        "Speaker 1: Hoje vamos revisar fotossintese.",
        "",
        "Speaker 2: Qual e a funcao da clorofila?",
      ].join("\n"),
    );

    assert.equal(segments.length, 2);
    assert.equal(segments[0]?.speaker, "Professora Ana");
    assert.equal(segments[1]?.speaker, "Aluno Bruno");
    assert.match(segments[1]?.text ?? "", /clorofila/);
  });
});

describe("live assistant routing", () => {
  it("routes the main assistant intents without collisions", () => {
    const context = makeAssistantContext();

    assert.match(
      buildLiveAssistantResponse("Resuma o que foi explicado ate agora", "student", context),
      /Resumo até agora/,
    );
    assert.match(
      buildLiveAssistantResponse("Liste os pontos mais importantes", "student", context),
      /Pontos-chave/,
    );
    assert.match(
      buildLiveAssistantResponse("Quais termos tecnicos apareceram?", "student", context),
      /Termos técnicos/,
    );
    assert.match(
      buildLiveAssistantResponse("Que pergunta eu poderia fazer ao mentor?", "student", context),
      /Pergunte agora/,
    );
    assert.match(
      buildLiveAssistantResponse("Explique API de forma simples", "student", context),
      /API/i,
    );
  });

  it("routes doubts questions to the review list instead of the mentor prompt", () => {
    const response = buildLiveAssistantResponse(
      "Quais duvidas eu devo anotar para revisar?",
      "student",
      makeAssistantContext(),
    );

    assert.match(response, /Dúvidas para revisar/);
    assert.doesNotMatch(response, /Pergunte agora/);
  });

  it("keeps free-form asks working for definitions", () => {
    const response = buildLiveAssistantResponse(
      "o que e backend?",
      "student",
      makeAssistantContext(),
    );

    assert.match(response, /Backend/i);
    assert.match(response, /servidor|regras de negocio|banco de dados/i);
  });

  it("answers related concepts inferred from the lesson context", () => {
    const response = buildLiveAssistantResponse(
      "qual a relacao entre front end, back end e full stack?",
      "student",
      makeAssistantContext({
        transcriptSegments: [
          {
            speakerName: "Pessoa 1",
            text: "Falamos sobre frontend chamando a API e backend salvando dados.",
            confidence: 0.92,
            clarity: 0.86,
            conviction: 0.81,
            verbalQuality: "adequada",
            technicalTerms: ["frontend", "API", "backend"],
            createdAt: 1717200000000,
            offsetMs: 12000,
          },
        ],
        insights: {
          terms: ["frontend", "API", "backend"],
          transcriptionIssues: [],
          importantPoints: ["O frontend conversa com a API e o backend aplica regras."],
          languageIssues: [],
        },
      }),
    );

    assert.match(response, /Full stack/i);
    assert.match(response, /Front-end|Front end/i);
    assert.match(response, /Back-end|Back end/i);
    assert.match(response, /API/i);
  });

  it("extracts hands-free wake-word questions only from the beginning of speech", () => {
    assert.equal(matchWakeWord("Assistente, resuma a aula"), "resuma a aula");
    assert.equal(matchWakeWord("ok assistente explique API"), "explique API");
    assert.equal(matchWakeWord("O assistente foi mencionado no meio da aula"), null);
  });

  it("accepts natural hands-free assistant commands", () => {
    assert.equal(matchWakeWord("me ajuda com isso"), "me ajuda com isso");
    assert.equal(
      matchWakeWord("o que eu respondo para isso agora?"),
      "o que eu respondo para isso agora?",
    );
    assert.equal(matchWakeWord("qual o follow-up ideal agora"), "qual o follow-up ideal agora");
  });
});

describe("V1 API integration flow", () => {
  before(async () => {
    await fs.mkdir(recordingsDir, { recursive: true });
    process.env.EDUCAI_VOICE_STORE_PATH = storePath;
    process.env.EDUCAI_RECORDINGS_DIR = recordingsDir;
    process.env.EDUCAI_PROVIDER_SETTINGS_PATH = path.join(tempRoot, "provider-settings.json");
    process.env.EDUCAI_ENABLE_SIMULATED_PROVIDERS = "true";
    process.env.EDUCAI_TRANSCRIPTION_PROVIDER = "mock";
    delete process.env.EDUCAI_AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    setServerRuntimeEnv(undefined);

    const module = await import("./voice-api");
    handleVoiceApiRequest = module.handleVoiceApiRequest as ApiHandler;
  });

  after(async () => {
    delete process.env.EDUCAI_ENABLE_SIMULATED_PROVIDERS;
    setServerRuntimeEnv(undefined);
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("covers create->audio->status->transcript->materials->chat->overview", async () => {
    const created = await api("POST", "/api/v1/sessions", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Sessao V1",
        type: "MEETING",
        language: "pt-BR",
        summaryTemplate: "Para alunos",
        metadata: {
          theme: "Industrializacao",
          audience: "9 ano",
          level: "Intermediario",
          objectives: "Entender causas e impactos",
          aiInstructions: "Usar exemplos simples",
          outputsRequested: ["Resumo", "Topicos", "Mapa mental"],
        },
      }),
    });

    assert.equal(created.response.status, 201);
    const session = created.json.data as Record<string, unknown>;
    assert.ok(session.id);
    assert.equal(session.summaryTemplate, "Para alunos");
    assert.equal((session.metadata as Record<string, unknown>).theme, "Industrializacao");
    assert.deepEqual((session.metadata as Record<string, unknown>).outputsRequested, [
      "Resumo",
      "Topicos",
      "Mapa mental",
    ]);
    const sessionId = String(session.id);

    const form = new FormData();
    form.append("source", "UPLOAD");
    form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

    const uploaded = await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
      body: form,
    });
    assert.equal(uploaded.response.status, 201);

    const statusAfterAudio = await api("GET", `/api/v1/sessions/${sessionId}/status`);
    assert.equal(statusAfterAudio.response.status, 200);
    assert.equal((statusAfterAudio.json.data as Record<string, unknown>).status, "AUDIO_UPLOADED");

    const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);
    assert.equal(transcribed.response.status, 201);

    const transcript = await api("GET", `/api/v1/sessions/${sessionId}/transcript`);
    assert.equal(transcript.response.status, 200);
    assert.ok((transcript.json.data as Record<string, unknown>).text);

    const transcriptData = transcript.json.data as Record<string, unknown>;
    const transcriptSegments = (transcriptData.segments as Array<Record<string, unknown>>).map(
      (segment, index) => ({
        ...segment,
        speaker: index === 0 ? "Professora Ana" : segment.speaker,
        text: String(segment.text),
      }),
    );
    const patchedTranscript = await api("PATCH", `/api/v1/sessions/${sessionId}/transcript`, {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: transcriptSegments
          .map((segment) => `${segment.speaker}: ${segment.text}`)
          .join("\n\n"),
        segments: transcriptSegments,
        status: "EDITED",
        format: "TEXT",
      }),
    });

    assert.equal(patchedTranscript.response.status, 200);
    assert.equal((patchedTranscript.json.data as Record<string, unknown>).status, "EDITED");

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "mock",
      }),
    });

    const materialsGenerated = await api(
      "POST",
      `/api/v1/sessions/${sessionId}/materials/generate`,
    );
    assert.equal(materialsGenerated.response.status, 201);

    const materials = await api("GET", `/api/v1/sessions/${sessionId}/materials`);
    assert.equal(materials.response.status, 200);
    const materialsList = materials.json.data as Array<Record<string, unknown>>;
    assert.ok(materialsList.length > 0);

    const materialId = String(materialsList[0]?.id);
    const material = await api("GET", `/api/v1/sessions/${sessionId}/materials/${materialId}`);
    assert.equal(material.response.status, 200);

    const sentChat = await api("POST", `/api/v1/sessions/${sessionId}/chat/messages`, {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Quais os proximos passos?" }),
    });
    assert.equal(sentChat.response.status, 201);

    const history = await api("GET", `/api/v1/sessions/${sessionId}/chat/messages`);
    assert.equal(history.response.status, 200);
    const messages = history.json.data as Array<Record<string, unknown>>;
    assert.ok(messages.length >= 2);

    const overview = await api("GET", `/api/v1/sessions/${sessionId}/overview`);
    assert.equal(overview.response.status, 200);
    const overviewPayload = overview.json.data as Record<string, unknown>;
    assert.ok((overviewPayload.materialsCount as number) > 0);
    assert.equal(typeof overviewPayload.materialsJsonRepaired, "boolean");
  });

  it("rejects invalid payloads required by V1", async () => {
    const invalidSession = await api("POST", "/api/v1/sessions", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "", type: "MEETING", language: "pt-BR" }),
    });

    assert.equal(invalidSession.response.status, 400);
    assert.equal(invalidSession.json.error?.code, "INVALID_REQUEST");
  });

  it("rejects oversized audio uploads before persistence", async () => {
    const originalLimit = process.env.EDUCAI_MAX_AUDIO_UPLOAD_BYTES;
    process.env.EDUCAI_MAX_AUDIO_UPLOAD_BYTES = "5";

    try {
      const created = await api("POST", "/api/v1/sessions", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Upload limit test",
          type: "MEETING",
          language: "pt-BR",
        }),
      });
      const sessionId = String((created.json.data as Record<string, unknown>).id);
      const form = new FormData();
      form.append("source", "UPLOAD");
      form.append("file", new File(["audio-bytes"], "large.webm", { type: "audio/webm" }));

      const upload = await api("POST", `/api/v1/sessions/${sessionId}/audio`, { body: form });

      assert.equal(upload.response.status, 413);
      assert.equal(upload.json.error?.code, "AUDIO_UPLOAD_TOO_LARGE");
    } finally {
      if (originalLimit === undefined) {
        delete process.env.EDUCAI_MAX_AUDIO_UPLOAD_BYTES;
      } else {
        process.env.EDUCAI_MAX_AUDIO_UPLOAD_BYTES = originalLimit;
      }
    }
  });

  it("rejects unsafe provider URLs without partially applying the settings patch", async () => {
    const before = await api("GET", "/api/v1/settings/providers");
    const beforeSettings = (before.json.data as Record<string, unknown>).settings as Record<
      string,
      unknown
    >;

    const rejected = await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "ollama",
        ollamaBaseUrl: "https://example.com",
      }),
    });
    const after = await api("GET", "/api/v1/settings/providers");
    const afterSettings = (after.json.data as Record<string, unknown>).settings as Record<
      string,
      unknown
    >;

    assert.equal(rejected.response.status, 400);
    assert.match(rejected.json.error?.message ?? "", /localhost or a private network/i);
    assert.equal(afterSettings.generationProvider, beforeSettings.generationProvider);
    assert.equal(afterSettings.ollamaBaseUrl, beforeSettings.ollamaBaseUrl);
  });

  it("loads and updates provider runtime settings through the API", async () => {
    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcriptionProvider: "mock",
        generationProvider: "mock",
        assistantWebSearch: "auto",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "qwen3:8b",
        fasterWhisperBaseUrl: "http://localhost:8765",
        fasterWhisperModel: "small",
      }),
    });

    const current = await api("GET", "/api/v1/settings/providers");
    assert.equal(current.response.status, 200);

    const currentData = current.json.data as Record<string, unknown>;
    const currentSettings = currentData.settings as Record<string, unknown>;
    assert.equal(currentSettings.transcriptionProvider, "mock");
    assert.equal(currentSettings.generationProvider, "mock");

    const patched = await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "gemini",
        assistantWebSearch: "off",
        ollamaBaseUrl: "http://127.0.0.1:11434",
        ollamaModel: "gemma3:4b",
        fasterWhisperBaseUrl: "http://127.0.0.1:8765",
        fasterWhisperModel: "medium",
      }),
    });

    assert.equal(patched.response.status, 200);
    const patchedData = patched.json.data as Record<string, unknown>;
    const patchedSettings = patchedData.settings as Record<string, unknown>;
    assert.equal(patchedSettings.generationProvider, "gemini");
    assert.equal(patchedSettings.assistantWebSearch, "off");
    assert.equal(patchedSettings.ollamaBaseUrl, "http://127.0.0.1:11434");
    assert.equal(patchedSettings.ollamaModel, "gemma3:4b");
    assert.equal(patchedSettings.fasterWhisperBaseUrl, "http://127.0.0.1:8765");
    assert.equal(patchedSettings.fasterWhisperModel, "medium");

    const patchedCatalog = patchedData.catalog as Record<string, unknown>;
    const generationCatalog = patchedCatalog.generation as Array<Record<string, unknown>>;
    assert.ok(generationCatalog.some((item) => item.id === "ollama"));

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "mock",
        assistantWebSearch: "auto",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "qwen3:8b",
        fasterWhisperBaseUrl: "http://localhost:8765",
        fasterWhisperModel: "small",
      }),
    });
  });

  it("checks Faster-Whisper runtime status through the API", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "http://localhost:8765/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            service: "educAI Faster-Whisper Worker",
            backend: "command",
            commandConfigured: true,
            diarization: {
              backend: "command",
              commandConfigured: true,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/models") {
        return new Response(
          JSON.stringify({
            models: [{ id: "small" }, { id: "medium" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/smoke-test") {
        return new Response(
          JSON.stringify({
            ok: true,
            textPreview: "smoke ok",
            segmentsCount: 1,
            latencyMs: 12,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/diarize-smoke-test") {
        return new Response(
          JSON.stringify({
            ok: true,
            segmentsCount: 2,
            speakers: ["speaker_1", "speaker_2"],
            latencyMs: 16,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected fetch url during Faster-Whisper status test: ${url}`);
    }) as typeof fetch;

    try {
      const status = await api("GET", "/api/v1/settings/providers/faster-whisper/status");
      assert.equal(status.response.status, 200);
      const payload = status.json.data as Record<string, unknown>;
      assert.equal(payload.status, "ready");
      assert.equal(payload.reachable, true);
      assert.equal(payload.activeModelAvailable, true);
      assert.equal(payload.runtimeBackend, "command");
      assert.equal(payload.runtimeCommandConfigured, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reports mock mode when the Faster-Whisper worker is still simulated", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "http://localhost:8765/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            service: "educAI Faster-Whisper Worker",
            backend: "mock",
            commandConfigured: false,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/models") {
        return new Response(
          JSON.stringify({
            models: [{ id: "small" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected fetch url during Faster-Whisper mock status test: ${url}`);
    }) as typeof fetch;

    try {
      const status = await api("GET", "/api/v1/settings/providers/faster-whisper/status");
      assert.equal(status.response.status, 200);
      const payload = status.json.data as Record<string, unknown>;
      assert.equal(payload.status, "mock_mode");
      assert.equal(payload.runtimeBackend, "mock");
      assert.equal(payload.runtimeCommandConfigured, false);
      assert.match(String(payload.message), /modo mock/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("checks Ollama runtime status through the API", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "http://localhost:11434/api/generate") {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({ ok: true, provider: "ollama" }),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url !== "http://localhost:11434/api/tags") {
        throw new Error(`Unexpected fetch url during Ollama status test: ${url}`);
      }

      return new Response(
        JSON.stringify({
          models: [{ model: "qwen3:8b" }, { model: "gemma3:4b" }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      const status = await api("GET", "/api/v1/settings/providers/ollama/status");
      assert.equal(status.response.status, 200);
      const payload = status.json.data as Record<string, unknown>;
      assert.equal(payload.status, "ready");
      assert.equal(payload.reachable, true);
      assert.equal(payload.activeModelAvailable, true);
      assert.equal(payload.jsonGenerationReady, true);
      assert.equal(Array.isArray(payload.checks), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("summarizes effective provider capability health through the API", async () => {
    const originalFetch = globalThis.fetch;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalTranscriptionProvider = process.env.EDUCAI_TRANSCRIPTION_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.EDUCAI_TRANSCRIPTION_PROVIDER;

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcriptionProvider: "faster-whisper",
        generationProvider: "ollama",
        fasterWhisperBaseUrl: "http://localhost:8765",
        fasterWhisperModel: "small",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "qwen3:8b",
      }),
    });

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "http://localhost:8765/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            service: "educAI Faster-Whisper Worker",
            backend: "command",
            commandConfigured: true,
            diarization: {
              backend: "command",
              commandConfigured: true,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/models") {
        return new Response(
          JSON.stringify({
            models: [{ id: "small" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/smoke-test") {
        return new Response(
          JSON.stringify({
            ok: true,
            textPreview: "smoke ok",
            segmentsCount: 1,
            latencyMs: 12,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/diarize-smoke-test") {
        return new Response(
          JSON.stringify({
            ok: true,
            segmentsCount: 2,
            speakers: ["speaker_1", "speaker_2"],
            latencyMs: 16,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:11434/api/tags") {
        return new Response(
          JSON.stringify({
            models: [{ model: "qwen3:8b" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:11434/api/generate") {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({ ok: true, provider: "ollama" }),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected fetch url during provider runtime health test: ${url}`);
    }) as typeof fetch;

    try {
      const status = await api("GET", "/api/v1/settings/providers/runtime-status");
      assert.equal(status.response.status, 200);
      const payload = status.json.data as Record<string, unknown>;
      const capabilities = payload.capabilities as Array<Record<string, unknown>>;
      assert.equal(Array.isArray(capabilities), true);
      assert.equal(capabilities.length, 4);
      assert.equal(
        capabilities.some((item) => item.capability === "transcription" && item.status === "ready"),
        true,
      );
      assert.equal(
        capabilities.some(
          (item) => item.capability === "materials" && item.selectedProvider === "ollama",
        ),
        true,
      );
      const localProviders = payload.localProviders as Record<string, Record<string, unknown>>;
      assert.equal(localProviders.ollama?.status, "ready");
      assert.equal(localProviders.ollama?.jsonGenerationReady, true);
      assert.equal(localProviders.fasterWhisper?.status, "ready");
      assert.equal(localProviders.fasterWhisper?.smokeTranscriptionReady, true);
      assert.equal(localProviders.fasterWhisper?.smokeDiarizationReady, true);
      const offlineReadiness = payload.offlineReadiness as Record<string, unknown>;
      assert.equal(offlineReadiness.status, "partial");
      assert.match(String(offlineReadiness.summary), /offline/i);
      const setupGuide = payload.setupGuide as Array<Record<string, unknown>>;
      assert.ok(setupGuide.length >= 8);
      assert.equal(
        setupGuide.some(
          (step) => step.id === "select-local-transcription" && step.status === "done",
        ),
        true,
      );
      assert.equal(
        setupGuide.some((step) => step.id === "pull-ollama-model" && step.status === "done"),
        true,
      );
      assert.equal(
        setupGuide.some((step) => step.id === "disable-web-search" && step.status === "todo"),
        true,
      );
      assert.equal(
        setupGuide.some(
          (step) =>
            step.id === "start-faster-whisper-worker" &&
            String(step.command).includes("dev:faster-whisper-worker"),
        ),
        true,
      );
      assert.equal(
        setupGuide.some(
          (step) => step.id === "configure-faster-whisper-diarization" && step.status === "done",
        ),
        true,
      );
      assert.equal(
        setupGuide.some(
          (step) => step.id === "pull-ollama-model" && String(step.command).includes("qwen3:8b"),
        ),
        true,
      );
    } finally {
      globalThis.fetch = originalFetch;
      if (originalOpenAIKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAIKey;
      }
      if (originalTranscriptionProvider === undefined) {
        delete process.env.EDUCAI_TRANSCRIPTION_PROVIDER;
      } else {
        process.env.EDUCAI_TRANSCRIPTION_PROVIDER = originalTranscriptionProvider;
      }
      await api("PATCH", "/api/v1/settings/providers", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcriptionProvider: "mock",
          generationProvider: "mock",
        }),
      });
    }
  });

  it("answers assistant questions through the hybrid knowledge endpoint", async () => {
    const assistant = await api("POST", "/api/v1/assistant/respond", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "O que e porcentagem?",
        mode: "student",
        context: {
          recording: true,
          transcriptSegments: [],
          interimTranscript: "",
          insights: {
            terms: [],
            transcriptionIssues: [],
            importantPoints: [],
            languageIssues: [],
          },
        },
      }),
    });

    assert.equal(assistant.response.status, 200);
    const payload = assistant.json.data as Record<string, unknown>;
    assert.match(String(payload.content), /porcentagem/i);
    assert.equal((payload.meta as Record<string, unknown>).domain, "mathematics");
  });

  it("answers assistant questions through Ollama when selected as the generation provider", async () => {
    const originalFetch = globalThis.fetch;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalGeminiKey = process.env.GEMINI_API_KEY;

    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "ollama",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "qwen3:8b",
      }),
    });

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url !== "http://localhost:11434/api/generate") {
        throw new Error(`Unexpected fetch url during Ollama assistant test: ${url}`);
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      assert.equal(body.model, "qwen3:8b");

      return new Response(
        JSON.stringify({
          response: "Backend e a camada do sistema que processa regras, dados e integracoes.",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      const assistant = await api("POST", "/api/v1/assistant/respond", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Compare Qwen3 e Gemma para uso local no Ollama em uma arquitetura modular.",
          mode: "student",
          context: {
            recording: false,
            transcriptSegments: [],
            interimTranscript: "",
            insights: {
              terms: [],
              transcriptionIssues: [],
              importantPoints: [],
              languageIssues: [],
            },
          },
        }),
      });

      assert.equal(assistant.response.status, 200);
      const payload = assistant.json.data as Record<string, unknown>;
      const meta = payload.meta as Record<string, unknown>;
      assert.equal(meta.source, "provider");
      assert.match(String(payload.content), /backend|integracoes|dados/i);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalOpenAIKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAIKey;
      }
      if (originalGeminiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalGeminiKey;
      }

      await api("PATCH", "/api/v1/settings/providers", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          generationProvider: "mock",
        }),
      });
    }
  });

  it("uses OpenAI web search for freshness-sensitive assistant questions", async () => {
    const originalFetch = globalThis.fetch;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalWebSearch = process.env.EDUCAI_ASSISTANT_WEB_SEARCH;
    const requests: Array<Record<string, unknown>> = [];

    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.EDUCAI_ASSISTANT_WEB_SEARCH = "on";

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.startsWith("https://api.openai.com/v1/responses")) {
        throw new Error(`Unexpected fetch url during test: ${url}`);
      }

      requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return new Response(
        JSON.stringify({
          output_text:
            "Hoje, uma noticia positiva foi a queda da inflacao em um indicador recente.",
          output: [
            {
              type: "web_search_call",
              results: [
                {
                  title: "Indicador economico",
                  url: "https://example.com/indicador",
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      const assistant = await api("POST", "/api/v1/assistant/respond", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Qual foi uma noticia positiva de hoje na economia?",
          mode: "student",
          context: {
            recording: false,
            transcriptSegments: [],
            interimTranscript: "",
            insights: {
              terms: [],
              transcriptionIssues: [],
              importantPoints: [],
              languageIssues: [],
            },
          },
        }),
      });

      assert.equal(assistant.response.status, 200);
      const payload = assistant.json.data as Record<string, unknown>;
      const meta = payload.meta as Record<string, unknown>;
      assert.equal(meta.source, "provider");
      assert.equal(meta.usedWebSearch, true);
      assert.equal(Array.isArray(meta.sources), true);
      assert.match(String(payload.content), /noticia positiva/i);

      const body = requests[0] ?? {};
      const tools = body.tools as Array<Record<string, unknown>>;
      assert.equal(tools?.[0]?.type, "web_search");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalOpenAIKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAIKey;
      }
      if (originalWebSearch === undefined) {
        delete process.env.EDUCAI_ASSISTANT_WEB_SEARCH;
      } else {
        process.env.EDUCAI_ASSISTANT_WEB_SEARCH = originalWebSearch;
      }
    }
  });

  it("loads persisted sessions when the JSON file starts with a UTF-8 BOM", async () => {
    await savePersistedVoiceSessions([]);
    const current = await fs.readFile(storePath, "utf8");
    await fs.writeFile(storePath, `\uFEFF${current}`, "utf8");

    const loaded = await loadPersistedVoiceSessions();
    assert.deepEqual(loaded, []);
  });

  it("decouples material generation from the transcription provider", async () => {
    process.env.EDUCAI_TRANSCRIPTION_PROVIDER = "mock";
    delete process.env.OPENAI_API_KEY;

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "openai",
      }),
    });

    const created = await api("POST", "/api/v1/sessions", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Generation provider missing key",
        type: "MEETING",
        language: "pt-BR",
      }),
    });

    const session = created.json.data as Record<string, unknown>;
    const sessionId = String(session.id);

    const form = new FormData();
    form.append("source", "UPLOAD");
    form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

    await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
      body: form,
    });

    const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);
    assert.equal(transcribed.response.status, 201);

    const materials = await api("POST", `/api/v1/sessions/${sessionId}/materials/generate`);
    assert.equal(materials.response.status, 500);
    assert.equal(materials.json.error?.code, "MATERIAL_GENERATION_FAILED");
    assert.match(JSON.stringify(materials.json.error), /OPENAI_API_KEY/);

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "mock",
      }),
    });
  });

  it("transcribes audio through Faster-Whisper when selected as the transcription provider", async () => {
    const originalFetch = globalThis.fetch;
    const originalTranscriptionProvider = process.env.EDUCAI_TRANSCRIPTION_PROVIDER;

    delete process.env.EDUCAI_TRANSCRIPTION_PROVIDER;

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcriptionProvider: "faster-whisper",
        fasterWhisperBaseUrl: "http://localhost:8765",
        fasterWhisperModel: "small",
      }),
    });

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "http://localhost:8765/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            service: "educAI Faster-Whisper Worker",
            backend: "command",
            commandConfigured: true,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/models") {
        return new Response(
          JSON.stringify({
            models: [{ id: "small" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/smoke-test") {
        return new Response(
          JSON.stringify({
            ok: true,
            textPreview: "smoke ok",
            segmentsCount: 1,
            latencyMs: 12,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url !== "http://localhost:8765/transcribe") {
        throw new Error(`Unexpected fetch url during Faster-Whisper transcription test: ${url}`);
      }

      assert.ok(init?.body instanceof FormData);

      return new Response(
        JSON.stringify({
          text: "Professor: Hoje vamos revisar APIs locais.\n\nAluno: E como o worker local entra nesse fluxo?",
          language: "pt-BR",
          segments: [
            {
              speaker: "Professor",
              start_ms: 0,
              end_ms: 2100,
              text: "Hoje vamos revisar APIs locais.",
            },
            {
              speaker: "Aluno",
              start_ms: 2100,
              end_ms: 4600,
              text: "E como o worker local entra nesse fluxo?",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      const created = await api("POST", "/api/v1/sessions", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Faster whisper transcription",
          type: "MEETING",
          language: "pt-BR",
          participants: [{ name: "Professor" }, { name: "Aluno" }],
        }),
      });

      const session = created.json.data as Record<string, unknown>;
      const sessionId = String(session.id);

      const form = new FormData();
      form.append("source", "UPLOAD");
      form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

      await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
        body: form,
      });

      const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);
      assert.equal(transcribed.response.status, 201);

      const transcript = await api("GET", `/api/v1/sessions/${sessionId}/transcript`);
      assert.equal(transcript.response.status, 200);
      const payload = transcript.json.data as Record<string, unknown>;
      assert.match(String(payload.provider), /faster-whisper:small/);
      assert.match(String(payload.text), /APIs locais/i);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalTranscriptionProvider === undefined) {
        delete process.env.EDUCAI_TRANSCRIPTION_PROVIDER;
      } else {
        process.env.EDUCAI_TRANSCRIPTION_PROVIDER = originalTranscriptionProvider;
      }
      await api("PATCH", "/api/v1/settings/providers", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcriptionProvider: "mock",
          fasterWhisperBaseUrl: "http://localhost:8765",
          fasterWhisperModel: "small",
        }),
      });
    }
  });

  it("fails honestly when Faster-Whisper is selected but the worker is still simulated", async () => {
    const originalFetch = globalThis.fetch;
    const originalTranscriptionProvider = process.env.EDUCAI_TRANSCRIPTION_PROVIDER;

    delete process.env.EDUCAI_TRANSCRIPTION_PROVIDER;

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcriptionProvider: "faster-whisper",
        fasterWhisperBaseUrl: "http://localhost:8765",
        fasterWhisperModel: "small",
      }),
    });

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "http://localhost:8765/health") {
        return new Response(
          JSON.stringify({
            status: "ok",
            service: "educAI Faster-Whisper Worker",
            backend: "mock",
            commandConfigured: false,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url === "http://localhost:8765/models") {
        return new Response(
          JSON.stringify({
            models: [{ id: "small" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected fetch url during Faster-Whisper simulated worker test: ${url}`);
    }) as typeof fetch;

    try {
      const created = await api("POST", "/api/v1/sessions", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Faster whisper simulated worker",
          type: "MEETING",
          language: "pt-BR",
        }),
      });

      const session = created.json.data as Record<string, unknown>;
      const sessionId = String(session.id);

      const form = new FormData();
      form.append("source", "UPLOAD");
      form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

      await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
        body: form,
      });

      const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);
      assert.equal(transcribed.response.status, 500);
      assert.equal(transcribed.json.error?.code, "TRANSCRIPTION_FAILED");
      assert.match(JSON.stringify(transcribed.json.error), /simulated mode|backend=command/i);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalTranscriptionProvider === undefined) {
        delete process.env.EDUCAI_TRANSCRIPTION_PROVIDER;
      } else {
        process.env.EDUCAI_TRANSCRIPTION_PROVIDER = originalTranscriptionProvider;
      }
      await api("PATCH", "/api/v1/settings/providers", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcriptionProvider: "mock",
          fasterWhisperBaseUrl: "http://localhost:8765",
          fasterWhisperModel: "small",
        }),
      });
    }
  });

  it("generates materials through Ollama when selected as the AI provider", async () => {
    const originalFetch = globalThis.fetch;
    let generateCalls = 0;

    await api("PATCH", "/api/v1/settings/providers", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        generationProvider: "ollama",
        ollamaBaseUrl: "http://localhost:11434",
        ollamaModel: "qwen3:8b",
      }),
    });

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url !== "http://localhost:11434/api/generate") {
        throw new Error(`Unexpected fetch url during Ollama materials test: ${url}`);
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      assert.equal(body.model, "qwen3:8b");

      generateCalls += 1;
      if (generateCalls === 1) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({ ok: true }),
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      assert.match(String(body.prompt), /strict JSON repair engine/i);
      assert.match(String(body.prompt), /sem secoes reconheciveis/i);

      return new Response(
        JSON.stringify({
          response: JSON.stringify({
            summary: {
              coreMessage: "A sessao definiu a base do pipeline local.",
              overview: "A equipe alinhou a integracao de IA local com foco em modularidade.",
              keyTakeaways: ["Ollama entrou como provider local."],
              boundaries: "Ainda falta a camada local de transcricao.",
            },
            topics: [
              {
                title: "Ollama",
                explanation: "Provider local para geracao de respostas e materiais.",
                transcriptEvidence: "A sessao mencionou IA local e endpoint configuravel.",
                whyItMatters: "Reduz custo e aumenta flexibilidade offline.",
                examples: ["qwen3:8b"],
              },
            ],
            technicalReport: {
              generalSummary: "A sessao revisou a base dos providers e o papel do Ollama.",
              importantPoints: ["Separacao entre transcricao e geracao."],
              communicationAnalysis: "A conversa foi objetiva e focada em arquitetura.",
              languageAndInformalityIssues: [],
              improvementPoints: ["Implementar Faster-Whisper na proxima fase."],
              positivePoints: ["Boa modularidade para novos providers."],
            },
            actionItems: [
              {
                task: "Validar o modelo local com cenarios reais.",
                category: "NEXT_CLASS",
                ownerOrAudience: "Equipe tecnica",
                priority: "HIGH",
                reason: "A base do provider local ficou pronta.",
                successCriterion: "Gerar materiais sem fallback para cloud.",
              },
            ],
            questions: [
              {
                question: "Qual e o papel do Ollama nesta arquitetura?",
                expectedAnswer: "Servir como provider local de IA generativa.",
                difficulty: "BASIC",
                skillTarget: "conceitual",
                reviewTip: "Compare o provider local com OpenAI e Gemini.",
              },
            ],
            mindMap: {
              centralTheme: "IA local",
              branches: [
                {
                  title: "Providers",
                  children: [{ title: "Ollama", children: ["qwen3:8b"] }],
                },
              ],
            },
          }),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      const created = await api("POST", "/api/v1/sessions", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Ollama materials",
          type: "MEETING",
          language: "pt-BR",
        }),
      });

      const session = created.json.data as Record<string, unknown>;
      const sessionId = String(session.id);

      const form = new FormData();
      form.append("source", "UPLOAD");
      form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

      await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
        body: form,
      });

      const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);
      assert.equal(transcribed.response.status, 201);

      const materials = await api("POST", `/api/v1/sessions/${sessionId}/materials/generate`);
      assert.equal(materials.response.status, 201);

      const listed = await api("GET", `/api/v1/sessions/${sessionId}/materials`);
      const items = listed.json.data as Array<Record<string, unknown>>;
      assert.ok(items.length > 0);
      assert.match(JSON.stringify(items), /Ollama|IA local|provider local/i);
      assert.equal(generateCalls, 2);
    } finally {
      globalThis.fetch = originalFetch;
      await api("PATCH", "/api/v1/settings/providers", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          generationProvider: "mock",
        }),
      });
    }
  });

  it("does not fall back to mock transcript when real transcription is explicitly enabled without an API key", async () => {
    process.env.EDUCAI_TRANSCRIPTION_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;

    const created = await api("POST", "/api/v1/sessions", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Real transcription missing key",
        type: "MEETING",
        language: "pt-BR",
      }),
    });

    const session = created.json.data as Record<string, unknown>;
    const sessionId = String(session.id);

    const form = new FormData();
    form.append("source", "UPLOAD");
    form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

    await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
      body: form,
    });

    const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);

    assert.equal(transcribed.response.status, 500);
    assert.equal(transcribed.json.error?.code, "TRANSCRIPTION_FAILED");
    assert.match(JSON.stringify(transcribed.json.error), /OPENAI_API_KEY/);

    process.env.EDUCAI_TRANSCRIPTION_PROVIDER = "mock";
  });

  it("does not fall back to mock transcript when Gemini is explicitly enabled without an API key", async () => {
    process.env.EDUCAI_TRANSCRIPTION_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;

    const created = await api("POST", "/api/v1/sessions", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Gemini transcription missing key",
        type: "MEETING",
        language: "pt-BR",
      }),
    });

    const session = created.json.data as Record<string, unknown>;
    const sessionId = String(session.id);

    const form = new FormData();
    form.append("source", "UPLOAD");
    form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

    await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
      body: form,
    });

    const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);

    assert.equal(transcribed.response.status, 500);
    assert.equal(transcribed.json.error?.code, "TRANSCRIPTION_FAILED");
    assert.match(JSON.stringify(transcribed.json.error), /GEMINI_API_KEY/);

    process.env.EDUCAI_TRANSCRIPTION_PROVIDER = "mock";
  });

  it("reads transcription provider from server runtime env without falling back to mock", async () => {
    delete process.env.EDUCAI_TRANSCRIPTION_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    setServerRuntimeEnv({ EDUCAI_TRANSCRIPTION_PROVIDER: "gemini" });

    const created = await api("POST", "/api/v1/sessions", {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Runtime env Gemini missing key",
        type: "MEETING",
        language: "pt-BR",
      }),
    });

    const session = created.json.data as Record<string, unknown>;
    const sessionId = String(session.id);

    const form = new FormData();
    form.append("source", "UPLOAD");
    form.append("file", new File(["audio-bytes"], "sample.webm", { type: "audio/webm" }));

    await api("POST", `/api/v1/sessions/${sessionId}/audio`, {
      body: form,
    });

    const transcribed = await api("POST", `/api/v1/sessions/${sessionId}/transcribe`);

    assert.equal(transcribed.response.status, 500);
    assert.equal(transcribed.json.error?.code, "TRANSCRIPTION_FAILED");
    assert.match(JSON.stringify(transcribed.json.error), /GEMINI_API_KEY/);

    setServerRuntimeEnv(undefined);
    process.env.EDUCAI_TRANSCRIPTION_PROVIDER = "mock";
  });

  it("rejects mock providers when simulation mode is disabled", async () => {
    const originalSimulatedProviders = process.env.EDUCAI_ENABLE_SIMULATED_PROVIDERS;
    delete process.env.EDUCAI_ENABLE_SIMULATED_PROVIDERS;

    try {
      const transcriptionPatch = await api("PATCH", "/api/v1/settings/providers", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcriptionProvider: "mock",
        }),
      });

      assert.equal(transcriptionPatch.response.status, 400);
      assert.match(transcriptionPatch.json.error?.message ?? "", /development/i);

      const generationPatch = await api("PATCH", "/api/v1/settings/providers", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          generationProvider: "mock",
        }),
      });

      assert.equal(generationPatch.response.status, 400);
      assert.match(generationPatch.json.error?.message ?? "", /development/i);
    } finally {
      if (originalSimulatedProviders === undefined) {
        delete process.env.EDUCAI_ENABLE_SIMULATED_PROVIDERS;
      } else {
        process.env.EDUCAI_ENABLE_SIMULATED_PROVIDERS = originalSimulatedProviders;
      }
    }
  });
});
