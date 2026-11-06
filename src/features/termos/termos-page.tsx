import { Link } from "@tanstack/react-router";
import { ArrowLeft, GraduationCap } from "lucide-react";
import type { ReactNode } from "react";

// Ao mudar o texto, atualize tambem TERMS_VERSION em components/consent-banner.tsx
// para o aviso de aceite reaparecer.
const ATUALIZADO_EM = "3 de outubro de 2026";

const TERMOS: [string, ReactNode][] = [
  [
    "O que é o educAI",
    "O educAI é um assistente que grava sessões como aulas, reuniões e mentorias, transcreve o áudio com inteligência artificial e gera materiais a partir dele: resumo, tópicos, perguntas e relatório. Ao usar o sistema, você concorda com estes termos.",
  ],
  [
    "Gravação de outras pessoas",
    "Antes de gravar, avise todos os participantes e tenha a autorização deles. Quem inicia a gravação é responsável por ter esse consentimento, em especial quando houver menores de idade na sessão.",
  ],
  [
    "Conteúdo gerado por IA",
    "Transcrições, resumos e respostas do assistente são gerados automaticamente e podem conter erros ou omissões. Revise o material antes de usar, distribuir ou tomar decisões com base nele.",
  ],
  [
    "Seu conteúdo",
    "As gravações, as transcrições e os materiais das suas sessões continuam sendo seus. O educAI só os utiliza para entregar as funções do próprio sistema.",
  ],
  [
    "Uso adequado",
    "Não use o educAI para gravar pessoas sem que elas saibam, para violar direitos de terceiros ou para qualquer atividade proibida por lei.",
  ],
  [
    "Disponibilidade",
    "O sistema é oferecido como está. Transcrição e geração de materiais dependem de serviços de IA que podem ficar indisponíveis; nesses casos o educAI informa a falha em vez de entregar um resultado simulado.",
  ],
  [
    "Mudanças nestes termos",
    "Estes termos podem ser atualizados. Quando isso acontecer, a data no topo desta página muda e o aviso de aceite volta a aparecer.",
  ],
];

const PRIVACIDADE: [string, ReactNode][] = [
  [
    "Dados que o educAI trata",
    <ul key="dados" className="list-disc space-y-2 pl-5">
      <li>O áudio das sessões que você grava ou envia.</li>
      <li>A transcrição desse áudio e os materiais gerados a partir dela.</li>
      <li>O título e o tipo de cada sessão, e as perguntas que você faz ao assistente.</li>
      <li>
        Preferências guardadas no seu navegador: tema, idioma, microfone escolhido, opções de
        acessibilidade e o aceite destes termos.
      </li>
    </ul>,
  ],
  [
    "Para que usamos",
    "Somente para o sistema funcionar: transcrever a sessão, gerar os materiais, responder às suas perguntas e manter o histórico. O educAI não usa cookies de publicidade nem de rastreamento e não vende dados.",
  ],
  [
    "Serviços de IA",
    "Conforme a configuração da instalação, o áudio e o texto das sessões podem ser processados no próprio computador ou enviados a provedores externos de IA, como OpenAI e Google Gemini, para transcrição e geração dos materiais. O assistente também pode consultar a web quando a pergunta exige. O provedor em uso aparece na tela de Configurações.",
  ],
  [
    "Onde ficam os dados",
    "As sessões ficam no armazenamento configurado na instalação do educAI. As preferências ficam apenas no seu navegador e somem se você limpar os dados do site.",
  ],
  [
    "Seus direitos",
    "A Lei Geral de Proteção de Dados (LGPD) garante a você confirmar se seus dados são tratados, acessá-los, corrigi-los e pedir a exclusão. Para exercer esses direitos, fale com o responsável pela instalação do educAI que você utiliza.",
  ],
];

export function Termos() {
  return (
    <div className="min-h-svh bg-[#efede9] font-sans text-[#0b0b0c]">
      <header className="border-b border-[#0b0b0c]/10">
        <div className="mx-auto flex h-20 w-full max-w-[820px] items-center justify-between px-6 sm:px-10">
          <Link
            to="/"
            aria-label="educAI, início"
            className="flex items-center gap-3 text-[17px] font-semibold tracking-[-.02em]"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#2a2f8f] text-white">
              <GraduationCap className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            educAI
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[14px] font-medium underline-offset-4 hover:underline"
          >
            <ArrowLeft size={16} aria-hidden /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[820px] px-6 py-16 sm:px-10 sm:py-24">
        <h1 className="text-[clamp(2.5rem,7vw,4.5rem)] leading-[.98] font-bold tracking-[-.04em] text-balance">
          Termos de Uso e Privacidade
        </h1>
        <p className="mt-6 text-[15px] text-[#3a3a3d]">Última atualização: {ATUALIZADO_EM}</p>
        <nav className="mt-8 flex flex-wrap gap-3 text-[14px] font-medium">
          <a
            href="#termos"
            className="rounded-full border border-[#0b0b0c]/25 px-4 py-2 transition-colors hover:border-[#0b0b0c]"
          >
            Termos de Uso
          </a>
          <a
            href="#privacidade"
            className="rounded-full border border-[#0b0b0c]/25 px-4 py-2 transition-colors hover:border-[#0b0b0c]"
          >
            Política de Privacidade
          </a>
        </nav>

        <Parte id="termos" titulo="Termos de Uso" itens={TERMOS} />
        <Parte id="privacidade" titulo="Política de Privacidade" itens={PRIVACIDADE} />
      </main>

      <footer className="bg-[#10123d] py-10 text-[14px] text-[#cfd3ff]">
        <div className="mx-auto w-full max-w-[820px] px-6 sm:px-10">
          educAI · Assistente para aulas, reuniões e mentorias
        </div>
      </footer>
    </div>
  );
}

function Parte({
  id,
  titulo,
  itens,
}: {
  id: string;
  titulo: string;
  itens: [string, ReactNode][];
}) {
  return (
    <section id={id} className="mt-20 scroll-mt-8">
      <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] leading-none font-semibold tracking-[-.03em] text-[#2a2f8f]">
        {titulo}
      </h2>
      <ol className="mt-8 border-b border-[#0b0b0c]/15">
        {itens.map(([nome, texto], i) => (
          <li
            key={nome}
            className="grid gap-x-8 gap-y-2 border-t border-[#0b0b0c]/15 py-7 sm:grid-cols-[2.5rem_1fr]"
          >
            <span aria-hidden className="text-[15px] font-semibold text-[#2a2f8f] tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="text-[19px] font-semibold tracking-[-.01em]">{nome}</h3>
              <div className="mt-2 text-[16px] leading-relaxed text-[#3a3a3d]">{texto}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
