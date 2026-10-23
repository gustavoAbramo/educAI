import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FileText,
  GraduationCap,
  HelpCircle,
  ListChecks,
  type LucideIcon,
  Mic,
  Network,
  Plus,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { type CSSProperties, type RefObject, useRef } from "react";

export const Route = createFileRoute("/landing")({
  head: () => ({ meta: [{ title: "educAI — Sua aula vira material pronto" }] }),
  component: Landing,
});

// Paleta propria e fixa: a landing nao segue o tema claro/escuro do app.
const paleta = {
  "--l-ink": "#0b0b0c",
  "--l-osso": "#efede9",
  "--l-cinza": "#b7b7b7",
  "--l-cinza-texto": "#3a3a3d",
  "--l-linha": "#2a2a2e",
  "--l-texto-suave": "#a1a1a8",
  "--l-anil": "#2a2f8f",
  "--l-anil-escuro": "#10123d",
  "--l-anil-claro": "#8b93ff",
  "--l-lilas": "#cfd3ff",
} as CSSProperties;

const container = "mx-auto w-full max-w-[1200px] px-6 sm:px-10";
const titulo =
  "text-[clamp(2.25rem,6vw,4rem)] leading-[1.02] font-semibold tracking-[-.035em] text-balance";
const telaCheia = "flex min-h-svh flex-col justify-center";

const CARTAS: {
  titulo: string;
  texto: string;
  Icone: LucideIcon;
  fundo: string;
  clara: boolean;
}[] = [
  {
    titulo: "Transcrição",
    texto: "A fala vira texto enquanto a aula acontece.",
    Icone: Mic,
    fundo: "bg-(--l-anil)",
    clara: true,
  },
  {
    titulo: "Resumo",
    texto: "O essencial da sessão, pronto para revisar.",
    Icone: FileText,
    fundo: "bg-(--l-ink)",
    clara: true,
  },
  {
    titulo: "Perguntas",
    texto: "Questões para fixar o que foi ensinado.",
    Icone: HelpCircle,
    fundo: "bg-white",
    clara: false,
  },
  {
    titulo: "Mapas",
    texto: "Os tópicos da aula organizados e conectados.",
    Icone: Network,
    fundo: "bg-(--l-cinza)",
    clara: false,
  },
  {
    titulo: "Próximos passos",
    texto: "O que fazer depois que a aula termina.",
    Icone: ListChecks,
    fundo: "bg-(--l-anil-escuro)",
    clara: true,
  },
];

const ETAPAS = [
  { nome: "Grave", texto: "Abra uma nova aula e libere o microfone." },
  { nome: "Acompanhe", texto: "Transcrição e sinais de clareza em tempo real." },
  { nome: "Revise", texto: "Materiais prontos e um assistente que conhece a aula." },
];

const PERGUNTAS = [
  [
    "O que o educAI faz?",
    "Grava a sessão, transcreve com IA e gera resumo, tópicos, relatório e materiais automaticamente.",
  ],
  ["Serve só para aulas?", "Não. O mesmo fluxo funciona para aulas, reuniões e mentorias."],
  [
    "Posso tirar dúvidas sobre a aula depois?",
    "Sim. O assistente responde usando o contexto da sessão e a base local, e busca na web quando o assunto pede.",
  ],
  [
    "Onde ficam minhas sessões?",
    "No histórico. Cada sessão guarda a transcrição e os materiais para você retomar quando quiser.",
  ],
];

const TRANSCRICAO = [
  ["00:12", "Hoje vamos fechar o conteúdo de funções do segundo grau."],
  ["00:27", "O vértice da parábola indica o ponto de máximo ou de mínimo."],
  ["00:41", "Anotem: o sinal do coeficiente a define a concavidade."],
];

// Animacoes da landing (GSAP). Os elementos sao marcados no JSX com atributos data-*:
//   data-hero        entra no carregamento; ja nasce invisivel no HTML para nao piscar antes do JS
//   data-titulo      titulo de secao: as palavras sobem uma a uma quando a secao aparece
//   data-sobe        bloco que sobe e aparece ao entrar na tela
//   data-parallax    desloca N px ao longo da passagem da secao (data-cena) mais proxima;
//                    com data-decor vale tambem no celular, sem ele so no desktop
// Com "reduzir movimento" ligado nada anima: o conteudo so aparece.
function useAnimacoes(raiz: RefObject<HTMLDivElement | null>) {
  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger, SplitText);
      const q = gsap.utils.selector(raiz);
      const mm = gsap.matchMedia(raiz);

      mm.add(
        { movimento: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 1024px)" },
        (contexto) => {
          const { movimento, desktop } = contexto.conditions as Record<string, boolean>;
          if (!movimento) {
            gsap.set(q("[data-hero]"), { autoAlpha: 1 });
            return;
          }

          // Topo: o titulo sobe linha a linha de tras de uma mascara; o resto vem em cascata.
          gsap.set(q("[data-hero-titulo]"), { autoAlpha: 1 });
          SplitText.create(q("[data-hero-titulo]"), {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (split) =>
              gsap.from(split.lines, {
                yPercent: 110,
                duration: 1.1,
                stagger: 0.12,
                ease: "power4.out",
              }),
          });
          gsap.fromTo(
            q("[data-hero-cabecalho]"),
            { autoAlpha: 0, y: -24 },
            { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" },
          );
          gsap.fromTo(
            q("[data-hero-sobe]"),
            { autoAlpha: 0, y: 28 },
            { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12, delay: 0.45, ease: "power3.out" },
          );
          gsap.fromTo(
            q("[data-hero-cartao]"),
            { autoAlpha: 0, x: 90, rotation: 9 },
            {
              autoAlpha: 1,
              x: 0,
              rotation: desktop ? 2 : 0,
              duration: 1.2,
              delay: 0.3,
              ease: "power3.out",
            },
          );
          gsap.from(q("[data-hero-fala]"), {
            autoAlpha: 0,
            x: 28,
            duration: 0.7,
            stagger: 0.2,
            delay: 0.9,
            ease: "power2.out",
          });

          for (const el of q("[data-titulo]")) {
            const split = SplitText.create(el, { type: "words" });
            gsap.from(split.words, {
              yPercent: 60,
              autoAlpha: 0,
              rotation: 5,
              transformOrigin: "0% 100%",
              duration: 0.8,
              stagger: 0.07,
              ease: "back.out(1.6)",
              scrollTrigger: { trigger: el, start: "top 82%" },
            });
          }

          for (const el of q("[data-sobe]")) {
            gsap.from(el, {
              y: 32,
              autoAlpha: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 88%" },
            });
          }

          gsap.from(q("[data-carta]"), {
            y: 90,
            autoAlpha: 0,
            rotation: (i) => (i % 2 ? 5 : -5),
            duration: 0.9,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: { trigger: q("[data-cartas]"), start: "top 78%" },
          });

          for (const linha of q("[data-etapa]")) {
            gsap.from(linha.children, {
              y: 40,
              autoAlpha: 0,
              duration: 0.7,
              stagger: 0.09,
              ease: "power3.out",
              scrollTrigger: { trigger: linha, start: "top 86%" },
            });
          }

          gsap.from(q("[data-pergunta]"), {
            y: 24,
            autoAlpha: 0,
            duration: 0.6,
            stagger: 0.09,
            ease: "power2.out",
            scrollTrigger: { trigger: q("[data-perguntas]"), start: "top 80%" },
          });

          for (const el of q("[data-parallax]") as HTMLElement[]) {
            if (!desktop && !el.hasAttribute("data-decor")) continue;
            const distancia = Number(el.dataset.parallax);
            gsap.fromTo(
              el,
              { y: -distancia },
              {
                y: distancia,
                ease: "none",
                scrollTrigger: {
                  trigger: el.closest("[data-cena]"),
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              },
            );
          }
        },
      );
    },
    { scope: raiz },
  );
}

function Landing() {
  const raiz = useRef<HTMLDivElement>(null);
  useAnimacoes(raiz);

  return (
    <div ref={raiz} style={paleta} className="landing min-h-svh bg-(--l-ink) font-sans text-white">
      <Topo />

      <main>
        <section
          id="como-funciona"
          data-cena
          className={`${telaCheia} bg-(--l-osso) py-28 text-(--l-ink)`}
        >
          <div className={container}>
            <h2 data-titulo className={`${titulo} max-w-[14ch]`}>
              Uma gravação. Cinco entregas.
            </h2>
            <div data-cartas className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {CARTAS.map((c, i) => (
                // Cada carta corre numa velocidade diferente no scroll (so no desktop).
                <div key={c.titulo} data-parallax={[0, 44, 16, 56, 28][i]}>
                  <div
                    data-carta
                    className={`flex h-[240px] flex-col justify-between rounded-2xl p-6 shadow-[0_24px_40px_-16px_rgb(16_18_61/.35)] ${c.fundo} ${c.clara ? "text-white" : "text-(--l-ink)"}`}
                  >
                    <span
                      className={`grid size-11 place-items-center rounded-xl ${c.clara ? "bg-white/12" : "bg-(--l-ink)/8"}`}
                    >
                      <c.Icone size={20} aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-.02em]">{c.titulo}</h3>
                      <p className="mt-2 text-[14px] leading-snug opacity-85">{c.texto}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${telaCheia} bg-(--l-cinza) py-28 text-(--l-ink)`}>
          <div className={container}>
            <h2 data-titulo className={`${titulo} max-w-[14ch]`}>
              Do microfone ao material pronto.
            </h2>
            <ol className="mt-20">
              {ETAPAS.map((e, i) => (
                <li
                  key={e.nome}
                  data-etapa
                  className="group grid items-baseline gap-x-8 gap-y-1 border-t border-(--l-ink)/20 py-9 last:border-b sm:grid-cols-[1fr_1.4fr_auto] sm:py-12"
                >
                  <h3 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-none font-semibold tracking-[-.03em]">
                    {e.nome}
                  </h3>
                  <p className="text-(--l-cinza-texto)">{e.texto}</p>
                  <p
                    aria-hidden
                    className="text-[clamp(1.75rem,4vw,2.75rem)] leading-none font-semibold tracking-[-.03em] tabular-nums transition-colors duration-300 group-hover:text-(--l-anil) sm:text-right"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section data-cena className={`${telaCheia} relative overflow-hidden bg-(--l-ink) py-20`}>
          <div
            aria-hidden
            data-parallax="160"
            data-decor
            className="pointer-events-none absolute top-1/4 -left-40 size-[520px] rounded-full bg-(--l-anil)/45 blur-3xl"
          />
          <div className={`${container} relative grid gap-14 lg:grid-cols-[5fr_7fr]`}>
            <h2 data-titulo className={`${titulo} max-w-[10ch]`}>
              Perguntas frequentes.
            </h2>
            <div data-perguntas className="border-b border-(--l-linha)">
              {PERGUNTAS.map(([pergunta, resposta]) => (
                <details key={pergunta} data-pergunta className="group border-t border-(--l-linha)">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-8 text-[20px] font-medium tracking-[-.01em] transition-colors hover:text-(--l-anil-claro) [&::-webkit-details-marker]:hidden">
                    {pergunta}
                    <Plus
                      size={20}
                      aria-hidden
                      className="flex-none text-(--l-texto-suave) transition-transform duration-300 group-open:rotate-45"
                    />
                  </summary>
                  <p className="-mt-2 max-w-[60ch] pb-8 text-[16px] text-(--l-texto-suave)">
                    {resposta}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section
          data-cena
          className="relative overflow-hidden bg-(--l-osso) py-32 text-(--l-ink) sm:py-44"
        >
          <span
            aria-hidden
            data-parallax="-130"
            data-decor
            className="pointer-events-none absolute top-1/2 right-[3vw] -mt-[.5em] text-[clamp(6rem,27vw,26rem)] whitespace-nowrap leading-none font-bold tracking-[-.06em] text-(--l-ink)/6 select-none"
          >
            educAI
          </span>
          <div className={`${container} relative`}>
            <h2 data-titulo className={`${titulo} max-w-[12ch]`}>
              Comece pela próxima aula.
            </h2>
            <p data-sobe className="mt-6 max-w-[36ch] text-[17px] text-(--l-cinza-texto)">
              Abra uma sessão, deixe o educAI ouvir e receba o material organizado no final.
            </p>
            <div data-sobe className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                to="/nova-aula"
                className="inline-flex items-center gap-2 rounded-full bg-(--l-anil) px-7 py-4 text-[15px] font-semibold text-white shadow-[0_12px_28px_-10px_rgb(42_47_143/.6)] transition-[gap,background-color] duration-200 hover:gap-3 hover:bg-[#3339a8]"
              >
                Iniciar nova aula <ArrowRight size={18} aria-hidden />
              </Link>
              <Link to="/" className="text-[15px] font-medium underline-offset-4 hover:underline">
                Abrir o painel
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-(--l-anil-escuro) py-10 text-(--l-lilas)">
        <div
          className={`${container} flex flex-wrap items-center justify-between gap-4 text-[14px]`}
        >
          <span className="flex items-center gap-3 font-medium text-white">
            <Logo tamanho="size-8" />
            educAI
          </span>
          <span className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/termos" className="underline underline-offset-4 hover:text-white">
              Termos de Uso
            </Link>
            <Link
              to="/termos"
              hash="privacidade"
              className="underline underline-offset-4 hover:text-white"
            >
              Política de Privacidade
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Logo({ tamanho }: { tamanho: string }) {
  return (
    <span
      className={`grid ${tamanho} flex-none place-items-center rounded-xl bg-white text-(--l-anil) shadow-[0_6px_16px_-6px_rgb(0_0_0/.4)]`}
    >
      <GraduationCap className="size-[60%]" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

function Topo() {
  return (
    <div data-cena className="relative overflow-hidden">
      <div
        aria-hidden
        data-parallax="180"
        data-decor
        className="pointer-events-none absolute -top-40 -right-40 size-[640px] rounded-full bg-(--l-anil)/50 blur-3xl"
      />
      <div
        aria-hidden
        data-parallax="-110"
        data-decor
        className="pointer-events-none absolute bottom-0 -left-52 size-[460px] rounded-full bg-(--l-lilas)/12 blur-3xl"
      />

      <header data-hero data-hero-cabecalho className="invisible absolute inset-x-0 top-0 z-10">
        <div className={`${container} flex h-24 items-center justify-between`}>
          <Link
            to="/landing"
            aria-label="educAI, início"
            className="flex items-center gap-3 text-[17px] font-semibold tracking-[-.02em]"
          >
            <Logo tamanho="size-10" />
            <span>educAI</span>
          </Link>
          <nav className="flex items-center gap-5 text-[14px] font-medium sm:gap-6">
            <a
              href="#como-funciona"
              className="hidden underline-offset-4 hover:underline sm:inline"
            >
              Como funciona
            </a>
            <Link
              to="/"
              className="rounded-full border border-white/35 px-4 py-2 transition-colors hover:border-white"
            >
              Abrir o painel
            </Link>
          </nav>
        </div>
      </header>

      <section
        className={`${container} relative grid min-h-svh items-center gap-x-10 gap-y-12 pt-32 pb-14 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:pt-24`}
      >
        {/* No scroll o texto fica para tras e o cartao sobe mais rapido: as duas colunas se descolam. */}
        <div data-parallax="110" className="max-w-[560px]">
          <h1
            data-hero
            data-hero-titulo
            className="invisible text-[clamp(3.25rem,8.5vw,6rem)] leading-[.94] font-bold tracking-[-.04em] text-balance"
          >
            Cada aula vira material.
          </h1>
          <p
            data-hero
            data-hero-sobe
            className="invisible mt-7 max-w-[40ch] text-[clamp(1.05rem,1.5vw,1.2rem)] text-white/85"
          >
            O educAI grava a sessão, transcreve com IA e entrega resumo, perguntas e próximos passos
            sem você parar de ensinar.
          </p>
          <div
            data-hero
            data-hero-sobe
            className="invisible mt-10 flex flex-wrap items-center gap-x-8 gap-y-4"
          >
            <Link
              to="/nova-aula"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-semibold text-(--l-ink) shadow-[0_12px_28px_-10px_rgb(0_0_0/.45)] transition-[gap] duration-200 hover:gap-3"
            >
              Iniciar nova aula <ArrowRight size={18} aria-hidden />
            </Link>
            <a
              href="#como-funciona"
              className="text-[15px] font-medium underline-offset-4 hover:underline"
            >
              Como funciona
            </a>
          </div>
        </div>

        <div aria-hidden data-parallax="-70">
          <div
            data-hero
            data-hero-cartao
            className="invisible rounded-3xl bg-(--l-anil) p-7 shadow-[0_40px_80px_-30px_rgb(42_47_143/.8)] sm:p-9"
          >
            <div className="flex items-center gap-2 text-[13px] font-medium text-(--l-lilas)">
              <span className="size-2 rounded-full bg-white animate-pulse-rec" />
              Transcrição ao vivo
            </div>
            <ul className="mt-7 space-y-5">
              {TRANSCRICAO.map(([tempo, fala]) => (
                <li key={tempo} data-hero-fala className="grid grid-cols-[auto_1fr] gap-4">
                  <span className="pt-1 text-[13px] text-(--l-lilas) tabular-nums">{tempo}</span>
                  <span className="text-[clamp(1.05rem,1.7vw,1.35rem)] leading-snug font-medium">
                    {fala}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
