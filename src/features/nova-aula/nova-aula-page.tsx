import { useNavigate } from "@tanstack/react-router";
import {
  Mic,
  ArrowRight,
  ChevronDown,
  FileAudio,
  FileVideo,
  Settings2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { uploadSessionAudio } from "@/services/audioService";
import { createSession } from "@/services/sessionService";
import type { SessionType } from "@/types/api";
import {
  formatFileSize,
  formatMediaDuration,
  MAX_MEDIA_UPLOAD_BYTES,
  mediaFileProblem,
  mediaKindOf,
  mimeTypeForMedia,
  PROVIDER_SAFE_MEDIA_BYTES,
  readMediaDuration,
  titleFromFileName,
  type MediaKind,
} from "./model/media-file";

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/60 transition placeholder:text-muted-foreground/60";
const textareaCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/60 transition placeholder:text-muted-foreground/60 resize-none";
const labelCls = "text-[11px] font-medium text-muted-foreground mb-1.5 block";

function cleanMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "string") return value.trim().length > 0;
      return value !== undefined && value !== null;
    }),
  );
}

type ChipsProps =
  | {
      options: string[];
      value: string;
      onChange: (v: string) => void;
      multi?: false;
    }
  | {
      options: string[];
      value: string[];
      onChange: (v: string[]) => void;
      multi: true;
    };

function Chips(props: ChipsProps) {
  const { options } = props;
  const isActive = (o: string) => (props.multi ? props.value.includes(o) : props.value === o);
  const toggle = (o: string) => {
    if (props.multi) {
      const arr = props.value;
      props.onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    } else {
      props.onChange(o);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={`text-xs px-2.5 h-7 rounded-md border transition active:scale-[0.97] ${
            isActive(o)
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-card hover:bg-accent hover:border-border/80 text-foreground/80"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function NovaAula() {
  const navigate = useNavigate();
  const defaultLanguage =
    typeof window !== "undefined"
      ? window.localStorage.getItem("educai-transcription-language") || "pt-BR"
      : "pt-BR";
  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("CLASS");
  const [theme, setTheme] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState("Intermediário");
  const [objectives, setObjectives] = useState("");
  const [context, setContext] = useState("");
  const [outputs, setOutputs] = useState<string[]>([]);
  const [summaryStyle, setSummaryStyle] = useState("");
  const [tone, setTone] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [avoidTopics, setAvoidTopics] = useState("");
  const [expectedDuration, setExpectedDuration] = useState("");
  const [sessionFormat, setSessionFormat] = useState("Presencial");
  const [previousTasks, setPreviousTasks] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<MediaKind>("audio");
  const [mediaDuration, setMediaDuration] = useState<number | undefined>();
  const [mediaError, setMediaError] = useState("");
  const [draggingMedia, setDraggingMedia] = useState(false);
  // Guarda a sessao ja criada quando so o envio do arquivo falhou, para o
  // "tentar novamente" nao duplicar a sessao no historico.
  const [createdSession, setCreatedSession] = useState<{ id: string; formKey: string } | null>(
    null,
  );
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const mediaSelectionRef = useRef(0);

  const pickMedia = async (file: File | undefined) => {
    if (!file) return;

    const problem = mediaFileProblem(file);
    if (problem) {
      setMediaError(problem);
      return;
    }

    const selection = mediaSelectionRef.current + 1;
    mediaSelectionRef.current = selection;
    const kind = mediaKindOf(file);

    setMediaError("");
    setMediaFile(file);
    setMediaKind(kind);
    setMediaDuration(undefined);
    setCreatedSession(null);

    if (!title.trim()) setTitle(titleFromFileName(file.name));

    const duration = await readMediaDuration(file, kind);
    if (selection === mediaSelectionRef.current) setMediaDuration(duration);
  };

  const clearMedia = () => {
    mediaSelectionRef.current += 1;
    setMediaFile(null);
    setMediaKind("audio");
    setMediaDuration(undefined);
    setMediaError("");
    setCreatedSession(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const typeMap: Record<string, SessionType> = {
    Aula: "CLASS",
    Mentoria: "MENTORING",
    Reunião: "MEETING",
    Workshop: "WORKSHOP",
    Treinamento: "TRAINING",
    Revisão: "OTHER",
  };

  const typeLabelMap: Record<SessionType, string> = {
    CLASS: "Aula",
    MENTORING: "Mentoria",
    MEETING: "Reunião",
    TRAINING: "Treinamento",
    WORKSHOP: "Workshop",
    CONSULTING: "Consultoria",
    SALES_CALL: "Reunião comercial",
    PRESENTATION: "Apresentação",
    OTHER: "Revisão",
  };

  const submitSession = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setSubmitError("Informe um título para a sessão.");
      return;
    }

    if (mediaFile) {
      const problem = mediaFileProblem(mediaFile);
      if (problem) {
        setMediaError(problem);
        setSubmitError("O arquivo escolhido precisa ser corrigido antes de continuar.");
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const metadata = cleanMetadata({
        theme: theme.trim(),
        discipline: discipline.trim(),
        audience: audience.trim(),
        level,
        objectives: objectives.trim(),
        context: context.trim(),
        outputsRequested: outputs,
        summaryStyle,
        tone,
        avoidTopics: avoidTopics.trim(),
        expectedDuration: expectedDuration.trim(),
        sessionFormat,
        previousTasks: previousTasks.trim(),
        aiInstructions: aiInstructions.trim(),
        inputMode: mediaFile ? "upload" : "live",
        ...(mediaFile
          ? {
              uploadedMedia: {
                fileName: mediaFile.name,
                mediaKind,
                sizeBytes: mediaFile.size,
                durationSeconds: mediaDuration,
              },
            }
          : {}),
      });
      const summaryTemplate = summaryStyle || undefined;
      const formKey = JSON.stringify([
        trimmedTitle,
        sessionType,
        language,
        summaryTemplate,
        metadata,
        mediaFile ? `${mediaFile.name}:${mediaFile.size}:${mediaFile.lastModified}` : "",
      ]);

      let sessionId = createdSession && createdSession.formKey === formKey ? createdSession.id : "";

      if (!sessionId) {
        const response = await createSession({
          title: trimmedTitle,
          type: sessionType,
          language,
          summaryTemplate,
          metadata,
        });
        sessionId = response.data.id;
        setCreatedSession({ id: sessionId, formKey });
      }

      if (mediaFile) {
        try {
          await uploadSessionAudio(sessionId, mediaFile, {
            source: "UPLOAD",
            fileName: mediaFile.name,
            mimeType: mimeTypeForMedia(mediaFile),
            durationSeconds: mediaDuration ? Math.max(1, Math.round(mediaDuration)) : undefined,
            metadata: {
              sourceTrack: "upload",
              mediaKind,
              originalFileName: mediaFile.name,
              ...(mediaDuration ? { durationSeconds: Math.round(mediaDuration) } : {}),
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao enviar o arquivo.";
          setSubmitError(
            `A sessão foi criada, mas o arquivo não foi enviado: ${message} Tente novamente.`,
          );
          toast.error("Falha no envio do arquivo", { description: message });
          return;
        }

        toast.success("Arquivo enviado", {
          description: "Transcrevendo e gerando os materiais...",
        });
        navigate({ to: "/processando", search: { sessionId } as never });
        return;
      }

      toast.success("Sessão criada com sucesso");
      navigate({ to: "/aula", search: { sessionId } as never });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar sessão.";
      setSubmitError(message);
      toast.error("Não foi possível criar a sessão", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/painel" label="Início" />
      </div>

      <div className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Nova sessão
        </div>
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight mt-2">
          Antes de começar
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Só o título é obrigatório. O resto ajuda a IA, mas é opcional.
        </p>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm shadow-soft p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10">
              <UploadCloud className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Já tem o áudio ou vídeo da aula?</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Envie um arquivo pronto em vez de gravar agora. A transcrição e os materiais são
                gerados automaticamente.
              </p>
            </div>
          </div>

          <input
            ref={mediaInputRef}
            type="file"
            aria-label="Escolher áudio ou vídeo"
            className="hidden"
            accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.webm,.mp4,.m4v,.mov,.mkv,.avi,.mpeg,.mpg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void pickMedia(file);
            }}
          />

          {mediaFile ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                {mediaKind === "video" ? (
                  <FileVideo className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{mediaFile.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {mediaKind === "video" ? "Vídeo" : "Áudio"} · {formatFileSize(mediaFile.size)}
                  {mediaDuration ? ` · ${formatMediaDuration(mediaDuration)}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                className="h-8 shrink-0 rounded-lg border border-border px-2.5 text-[11px] font-medium transition hover:bg-muted"
              >
                Trocar
              </button>
              <button
                type="button"
                onClick={clearMedia}
                aria-label="Remover arquivo"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDraggingMedia(true);
              }}
              onDragLeave={() => setDraggingMedia(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDraggingMedia(false);
                void pickMedia(event.dataTransfer.files?.[0]);
              }}
              className={`mt-4 flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition ${
                draggingMedia
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background/40 hover:border-primary/40 hover:bg-accent/30"
              }`}
            >
              <UploadCloud className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Escolher arquivo</span>
              <span className="text-[11px] text-muted-foreground">
                ou arraste aqui · até {formatFileSize(MAX_MEDIA_UPLOAD_BYTES)}
              </span>
            </button>
          )}

          {mediaError ? <p className="mt-2 text-xs text-destructive">{mediaError}</p> : null}

          {mediaFile && mediaFile.size > PROVIDER_SAFE_MEDIA_BYTES ? (
            <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
              Arquivos acima de {formatFileSize(PROVIDER_SAFE_MEDIA_BYTES)} podem exceder o limite
              do provedor de IA. Para aulas longas, envie apenas o áudio.
            </div>
          ) : null}

          <p className="mt-2 text-[10px] text-muted-foreground">
            Áudio (mp3, m4a, wav, ogg, webm) ou vídeo (mp4, mov, mkv). Arquivos grandes podem
            demorar; o áudio costuma ser mais rápido.
          </p>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm shadow-soft p-5 space-y-4">
          <label className="block">
            <span className={labelCls}>Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Ex.: Revolução Industrial"
            />
          </label>

          <div>
            <span className={labelCls}>Tipo de sessão</span>
            <Chips
              options={["Aula", "Mentoria", "Reunião", "Workshop", "Treinamento", "Revisão"]}
              value={typeLabelMap[sessionType]}
              onChange={(value) => setSessionType(typeMap[value] ?? "CLASS")}
            />
          </div>

          <label className="block">
            <span className={labelCls}>O que a IA precisa saber? (opcional)</span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className={textareaCls}
              placeholder="Turma, objetivo, conceitos-chave, o que destacar ou evitar…"
            />
          </label>
        </section>

        <div className="rounded-2xl border border-border/70 bg-card/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent/40 transition text-left"
          >
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium">Mais opções</div>
              <div className="text-[11px] text-muted-foreground">
                Opcional — disciplina, público, materiais, tom e idioma.
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {advancedOpen && (
            <div className="p-5 pt-4 space-y-4 border-t border-border/60 animate-fade-in">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Área ou disciplina</span>
                  <select
                    className={inputCls}
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                  >
                    <option value="">Não informar</option>
                    <option>História</option>
                    <option>Matemática</option>
                    <option>Biologia</option>
                    <option>Física</option>
                    <option>Literatura</option>
                    <option>Tecnologia</option>
                    <option>Negócios</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Público-alvo</span>
                  <input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className={inputCls}
                    placeholder="Ex.: 9º ano do ensino fundamental"
                  />
                </label>
              </div>

              <div>
                <span className={labelCls}>Nível da turma</span>
                <Chips
                  options={["Iniciante", "Intermediário", "Avançado", "Misto"]}
                  value={level}
                  onChange={setLevel}
                />
              </div>

              <label className="block">
                <span className={labelCls}>Objetivo da sessão</span>
                <input
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  className={inputCls}
                  placeholder="O que os alunos devem entender ao final?"
                />
              </label>

              <div>
                <span className={labelCls}>Materiais a gerar</span>
                <Chips
                  options={[
                    "Resumo",
                    "Relatório técnico",
                    "Tópicos",
                    "Mapa mental",
                    "Diagnostico da aula",
                    "Atividades",
                    "Perguntas e respostas",
                    "Flashcards",
                    "Próximos passos",
                  ]}
                  value={outputs}
                  onChange={setOutputs}
                  multi
                />
              </div>

              <div>
                <span className={labelCls}>Estilo do resumo</span>
                <Chips
                  options={["Curto", "Detalhado", "Para alunos", "Para professor", "Em tópicos"]}
                  value={summaryStyle}
                  onChange={setSummaryStyle}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <span className={labelCls}>Tom da IA</span>
                  <Chips
                    options={[
                      "Didático",
                      "Simples",
                      "Técnico",
                      "Motivador",
                      "Formal",
                      "Descontraído",
                    ]}
                    value={tone}
                    onChange={setTone}
                  />
                </div>
                <label className="block">
                  <span className={labelCls}>Idioma da transcrição</span>
                  <select
                    className={inputCls}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="pt-BR">Português (BR)</option>
                    <option value="pt-PT">Português (PT)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            {mediaFile
              ? "O arquivo será enviado e processado automaticamente."
              : "O microfone será solicitado ao iniciar."}
          </div>
          <div className="flex flex-col items-end gap-2">
            {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
            <button
              onClick={() => void submitSession()}
              disabled={isSubmitting}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand text-white px-5 h-11 text-sm font-medium shadow-glow hover:opacity-95 active:scale-[0.98] transition disabled:opacity-70"
            >
              {mediaFile ? <UploadCloud className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isSubmitting
                ? mediaFile
                  ? "Enviando..."
                  : "Criando..."
                : mediaFile
                  ? "Enviar e processar"
                  : "Iniciar sessão"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
