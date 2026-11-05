import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, ArrowRight, Info, Sparkles, FileOutput, ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import { createSession } from "@/services/sessionService";
import type { SessionType } from "@/types/api";

export const Route = createFileRoute("/nova-aula")({ component: NovaAula });

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/60 transition placeholder:text-muted-foreground/60";
const textareaCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/60 transition placeholder:text-muted-foreground/60 resize-none";
const labelCls = "text-[11px] font-medium text-muted-foreground mb-1.5 block";

type SectionProps = {
  index: number;
  icon: React.ElementType;
  title: string;
  hint: string;
  children: React.ReactNode;
};

function Section({ index, icon: Icon, title, hint, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm shadow-soft overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        </div>
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

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

function NovaAula() {
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
  const [outputs, setOutputs] = useState<string[]>([
    "Resumo",
    "Relatório técnico",
    "Tópicos",
    "Mapa mental",
    "Diagnostico da aula",
    "Resumo executivo",
    "Respostas sugeridas",
  ]);
  const [summaryStyle, setSummaryStyle] = useState("Para alunos");
  const [tone, setTone] = useState("Didático");
  const [language, setLanguage] = useState(defaultLanguage);
  const [avoidTopics, setAvoidTopics] = useState("");
  const [expectedDuration, setExpectedDuration] = useState("");
  const [sessionFormat, setSessionFormat] = useState("Presencial");
  const [previousTasks, setPreviousTasks] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
      });

      const response = await createSession({
        title: trimmedTitle,
        type: sessionType,
        language,
        summaryTemplate: summaryStyle,
        metadata,
      });

      toast.success("Sessão criada com sucesso");
      navigate({ to: "/aula", search: { sessionId: response.data.id } as never });
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
          Ajude a IA a entender o contexto. Quanto mais claro, melhor o resultado.
        </p>
      </div>

      <div className="space-y-4">
        {/* 1. Informações básicas */}
        <Section
          index={1}
          icon={Info}
          title="Informações básicas"
          hint="O essencial para identificar a sessão."
        >
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

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Tema principal</span>
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className={inputCls}
                placeholder="Ex.: Industrialização na Europa"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Área ou disciplina</span>
              <select
                className={inputCls}
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
              >
                <option value="" disabled>
                  Selecione…
                </option>
                <option>História</option>
                <option>Matemática</option>
                <option>Biologia</option>
                <option>Física</option>
                <option>Literatura</option>
                <option>Tecnologia</option>
                <option>Negócios</option>
              </select>
            </label>
          </div>
        </Section>

        {/* 2. Contexto para IA */}
        <Section
          index={2}
          icon={Sparkles}
          title="Contexto para IA"
          hint="Detalhes que personalizam a análise."
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Público-alvo</span>
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={inputCls}
                placeholder="Ex.: 9º ano do ensino fundamental"
              />
            </label>
            <div>
              <span className={labelCls}>Nível da turma</span>
              <Chips
                options={["Iniciante", "Intermediário", "Avançado", "Misto"]}
                value={level}
                onChange={setLevel}
              />
            </div>
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

          <label className="block">
            <span className={labelCls}>Pontos importantes para a IA considerar</span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className={textareaCls}
              placeholder="Conceitos-chave, exemplos a destacar, contexto da turma…"
            />
          </label>
        </Section>

        {/* 3. Saída desejada */}
        <Section
          index={3}
          icon={FileOutput}
          title="Saída desejada"
          hint="O que gerar ao final da sessão."
        >
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
                options={["Didático", "Simples", "Técnico", "Motivador", "Formal", "Descontraído"]}
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
        </Section>

        {/* Configurações avançadas */}
        <div className="rounded-2xl border border-border/70 bg-card/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent/40 transition text-left"
          >
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium">Configurações avançadas</div>
              <div className="text-[11px] text-muted-foreground">
                Opcional — refine ainda mais o contexto.
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                advancedOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {advancedOpen && (
            <div className="p-5 pt-2 space-y-4 border-t border-border/60 animate-fade-in">
              <label className="block">
                <span className={labelCls}>Pontos que devem ser evitados</span>
                <textarea
                  value={avoidTopics}
                  onChange={(e) => setAvoidTopics(e.target.value)}
                  rows={2}
                  className={textareaCls}
                  placeholder="Tópicos, exemplos ou termos a evitar…"
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Duração prevista</span>
                  <input
                    value={expectedDuration}
                    onChange={(e) => setExpectedDuration(e.target.value)}
                    className={inputCls}
                    placeholder="Ex.: 50 minutos"
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Formato</span>
                  <select
                    className={inputCls}
                    value={sessionFormat}
                    onChange={(e) => setSessionFormat(e.target.value)}
                  >
                    <option>Presencial</option>
                    <option>Online</option>
                    <option>Híbrido</option>
                    <option>Gravação local</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className={labelCls}>Tarefas ou combinados anteriores</span>
                <textarea
                  value={previousTasks}
                  onChange={(e) => setPreviousTasks(e.target.value)}
                  rows={2}
                  className={textareaCls}
                  placeholder="O que foi pedido na sessão anterior…"
                />
              </label>

              <label className="block">
                <span className={labelCls}>Observações adicionais para IA</span>
                <textarea
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  rows={2}
                  className={textareaCls}
                  placeholder="Qualquer detalhe relevante…"
                />
              </label>
            </div>
          )}
        </div>

        <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[11px] text-muted-foreground">
            O microfone será solicitado ao iniciar.
          </div>
          <div className="flex flex-col items-end gap-2">
            {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
            <button
              onClick={() => void submitSession()}
              disabled={isSubmitting}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-brand text-white px-5 h-11 text-sm font-medium shadow-glow hover:opacity-95 active:scale-[0.98] transition disabled:opacity-70"
            >
              <Mic className="h-4 w-4" />
              {isSubmitting ? "Criando..." : "Iniciar sessão"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
