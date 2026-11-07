export type FaqEntry = {
  question: string;
  answer: string[];
  keywords?: string;
  link?: { to: string; label: string };
};

export type FaqSection = { id: string; title: string; entries: FaqEntry[] };

export const faqSections: FaqSection[] = [
  {
    id: "gravar",
    title: "Gravar uma aula",
    entries: [
      {
        question: "Como começo a gravar uma aula?",
        answer: [
          "Clique em Nova aula, preencha pelo menos o título e escolha o que quer receber no final (resumo, mapa mental, perguntas...).",
          "Na tela seguinte, aperte o botão de gravar. Quando terminar, pare a gravação e o educAI envia o áudio para processar.",
        ],
        keywords: "iniciar começar gravacao",
        link: { to: "/nova-aula", label: "Criar nova aula" },
      },
      {
        question: "O navegador não deixa usar o microfone. O que fazer?",
        answer: [
          "Clique no ícone de cadeado ao lado do endereço do site e permita o microfone. Depois recarregue a página.",
          "Em Configurações → Geral você escolhe qual microfone usar por padrão.",
        ],
        keywords: "permissao microfone bloqueado audio",
        link: { to: "/configuracoes", label: "Abrir Configurações" },
      },
      {
        question: "Por que a legenda ao vivo não aparece?",
        answer: [
          "A legenda durante a gravação usa o reconhecimento de voz do próprio navegador, disponível no Chrome e no Edge. Em outros navegadores a gravação funciona, só sem a legenda ao vivo.",
        ],
        keywords: "transcricao ao vivo legenda chrome edge firefox safari",
      },
    ],
  },
  {
    id: "ia",
    title: "Configurar a IA",
    entries: [
      {
        question: "Preciso de IA para usar o educAI?",
        answer: [
          "Para transcrever o áudio e gerar os materiais, sim. Gravar, organizar, buscar e exportar funcionam sem IA.",
          "Para testar ou apresentar sem IA, ligue o Modo demonstração em Configurações → IA: o fluxo inteiro funciona com resultados de exemplo.",
        ],
        keywords: "sem ia offline demo demonstracao simulado",
        link: { to: "/configuracoes", label: "Abrir Configurações" },
      },
      {
        question: "Como ligo o Gemini ou a OpenAI?",
        answer: [
          "Em Configurações → IA, cole a chave de API em Chaves de API e salve. A chave fica criptografada no servidor e não volta para o navegador.",
          "Depois escolha o provedor em Provedor de IA e use Testar conexões para conferir.",
        ],
        keywords: "chave api key gemini openai google",
      },
      {
        question: "Dá para usar IA local e gratuita?",
        answer: [
          "Sim. Para gerar materiais, instale o Ollama e um modelo (por exemplo qwen3:8b). Para transcrever, use o worker Faster-Whisper.",
          "Os dois rodam no seu computador; configure os endereços em Configurações → IA e Configurações → Áudio.",
        ],
        keywords: "ollama whisper faster-whisper local gratis offline",
      },
      {
        question: "Apareceu “Cota excedida” ou “Alta demanda”. E agora?",
        answer: [
          "O provedor de IA recusou o pedido por limite de uso ou sobrecarga. Espere alguns minutos e use Tentar novamente no Histórico, ou troque de provedor nas Configurações.",
        ],
        keywords: "erro 429 503 quota falhou",
      },
    ],
  },
  {
    id: "resultados",
    title: "Materiais e organização",
    entries: [
      {
        question: "Como baixo o resumo e a transcrição?",
        answer: [
          "Na tela de resultado, use Exportar para baixar em PDF, Markdown (.md) ou texto simples (.txt). Copiar tudo coloca o conteúdo na área de transferência.",
          "No PDF, o navegador abre a janela de impressão: escolha “Salvar como PDF”.",
        ],
        keywords: "exportar baixar pdf txt markdown copiar download",
      },
      {
        question: "Como acho um trecho específico da aula?",
        answer: [
          "Na aba Transcrição do resultado, use a busca: os trechos com a palavra ficam destacados. A busca ignora acentos e maiúsculas.",
        ],
        keywords: "buscar procurar palavra transcricao",
      },
      {
        question: "Como fixo uma aula no Início?",
        answer: [
          "No Histórico, clique na estrela da aula. Ela aparece em Favoritas no Início e pode ser filtrada no Histórico.",
        ],
        keywords: "favorita fixar estrela",
        link: { to: "/historico", label: "Abrir Histórico" },
      },
      {
        question: "Onde vejo as aulas de um dia específico?",
        answer: [
          "No Calendário. Os dias com aula mostram um número; clique no dia para listar as aulas dele.",
        ],
        keywords: "calendario data dia mes",
        link: { to: "/calendario", label: "Abrir Calendário" },
      },
      {
        question: "Editei a transcrição. Os materiais atualizam sozinhos?",
        answer: [
          "Não. O resultado avisa que os materiais estão desatualizados; use Regenerar materiais para refazer com a transcrição nova.",
        ],
        keywords: "editar regenerar atualizar",
      },
    ],
  },
  {
    id: "conta",
    title: "Conta e privacidade",
    entries: [
      {
        question: "Como troco minha senha, nome ou foto?",
        answer: [
          "Em Perfil você muda nome, foto e senha. A senha precisa ter pelo menos 12 caracteres.",
        ],
        keywords: "perfil senha nome foto avatar",
        link: { to: "/perfil", label: "Abrir Perfil" },
      },
      {
        question: "Como excluo minha conta?",
        answer: [
          "Em Perfil → Excluir conta. É preciso digitar a senha. A conta e todas as suas aulas, áudios e materiais são apagados de vez.",
        ],
        keywords: "excluir apagar deletar conta",
      },
      {
        question: "Por que pediu para entrar de novo?",
        answer: ["Por segurança, a sessão expira depois de 4 horas. É só entrar de novo."],
        keywords: "login sessao expirou sair",
      },
      {
        question: "Quem vê minhas aulas?",
        answer: [
          "Só a sua conta. Cada aula fica ligada a quem criou. Os áudios ficam guardados no servidor do educAI; o provedor de IA escolhido recebe o áudio e o texto apenas para transcrever e gerar os materiais.",
        ],
        keywords: "privacidade dados seguranca",
        link: { to: "/termos", label: "Ler termos e privacidade" },
      },
    ],
  },
  {
    id: "acessibilidade",
    title: "Acessibilidade",
    entries: [
      {
        question: "Dá para aumentar o texto ou ouvir a página?",
        answer: [
          "Sim. Em Acessibilidade você ajusta tamanho do texto, contraste, leitura em voz alta, linguagem simples e Libras (VLibras).",
        ],
        keywords: "fonte tamanho contraste voz libras leitor",
        link: { to: "/acessibilidade", label: "Abrir Acessibilidade" },
      },
    ],
  },
];
