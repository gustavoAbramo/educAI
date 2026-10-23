import type { LiveAssistantContext, LiveAssistantMode } from "./live-assistant";

export type AssistantKnowledgeDomain =
  | "educai"
  | "general"
  | "technology"
  | "programming"
  | "ai"
  | "business"
  | "marketing"
  | "sales"
  | "entrepreneurship"
  | "education"
  | "study"
  | "language"
  | "science"
  | "history"
  | "geography"
  | "mathematics"
  | "career"
  | "psychology"
  | "health_basic"
  | "legal_basic"
  | "productivity"
  | "finance"
  | "news"
  | "entertainment"
  | "gaming";

export type AssistantConfidence = "high" | "medium" | "low";

export type AssistantKnowledgeRoute = {
  domain: AssistantKnowledgeDomain;
  confidence: AssistantConfidence;
  matchedTerms: string[];
  requiresFreshSources: boolean;
  shouldUseProvider: boolean;
  suggestedAgents: string[];
};

type KnowledgeEntry = {
  term: string;
  aliases?: string[];
  domain: AssistantKnowledgeDomain;
  definition: string;
  practicalExample?: string;
};

const knowledgeEntries: KnowledgeEntry[] = [
  {
    term: "algoritmo",
    domain: "programming",
    definition: "uma sequencia de passos para resolver um problema ou executar uma tarefa",
    practicalExample: "uma receita de bolo ou a ordem usada para validar um formulario",
  },
  {
    term: "api",
    aliases: ["apis"],
    domain: "technology",
    definition:
      "uma interface que permite a comunicacao entre sistemas por regras e formatos definidos",
    practicalExample: "um app pedir dados de usuarios para um servidor",
  },
  {
    term: "autenticacao",
    aliases: ["autenticacao de usuario"],
    domain: "technology",
    definition: "o processo de confirmar a identidade de quem esta acessando um sistema",
    practicalExample: "entrar com email e senha para abrir uma conta",
  },
  {
    term: "autorizacao",
    domain: "technology",
    definition: "a etapa que decide o que cada usuario pode fazer depois de estar autenticado",
    practicalExample: "um aluno poder ver materiais, mas nao alterar configuracoes do sistema",
  },
  {
    term: "backend",
    aliases: ["back end", "back-end"],
    domain: "technology",
    definition:
      "a camada do sistema responsavel por regras de negocio, banco de dados e integracoes",
    practicalExample: "salvar uma aula, validar dados e gerar materiais no servidor",
  },
  {
    term: "banco de dados",
    aliases: ["database", "db"],
    domain: "technology",
    definition: "o lugar onde os dados ficam organizados e persistidos para consulta posterior",
    practicalExample: "guardar sessoes, transcricoes e historico do assistente",
  },
  {
    term: "cloud",
    aliases: ["nuvem", "computacao em nuvem"],
    domain: "technology",
    definition:
      "uso de servidores e servicos remotos para armazenar, processar e distribuir sistemas",
    practicalExample: "hospedar um app em vez de rodar tudo no computador local",
  },
  {
    term: "crm",
    domain: "business",
    definition:
      "um sistema para organizar relacionamento com clientes, oportunidades e atendimentos",
    practicalExample: "acompanhar leads, contatos e propostas comerciais",
  },
  {
    term: "deploy",
    domain: "technology",
    definition:
      "o processo de publicar uma aplicacao em um ambiente onde outras pessoas possam usa-la",
    practicalExample: "enviar um site para producao na Vercel",
  },
  {
    term: "devops",
    domain: "technology",
    definition:
      "um conjunto de praticas para integrar desenvolvimento, operacao e entrega continua",
    practicalExample: "automatizar testes, build e publicacao do sistema",
  },
  {
    term: "equacao",
    domain: "mathematics",
    definition: "uma igualdade com valores desconhecidos que precisam ser encontrados",
    practicalExample: "resolver x + 3 = 10 para descobrir o valor de x",
  },
  {
    term: "frontend",
    aliases: ["front end", "front-end"],
    domain: "technology",
    definition: "a parte visual com a qual a pessoa usuaria interage",
    practicalExample: "telas, botoes, formularios e feedback visual do sistema",
  },
  {
    term: "fotossintese",
    domain: "science",
    definition: "o processo em que plantas usam luz, agua e gas carbonico para produzir energia",
    practicalExample: "a planta transforma recursos do ambiente em glicose e libera oxigenio",
  },
  {
    term: "fluxo de caixa",
    domain: "finance",
    definition: "o controle de entradas e saidas de dinheiro ao longo do tempo",
    practicalExample: "acompanhar quanto uma empresa recebe e quanto paga por mes",
  },
  {
    term: "fracao",
    domain: "mathematics",
    definition: "uma forma de representar partes de um todo",
    practicalExample: "metade de uma pizza pode ser escrita como 1/2",
  },
  {
    term: "funil de vendas",
    domain: "business",
    definition: "a jornada que leva uma pessoa de interesse inicial ate a decisao de compra",
    practicalExample: "lead, contato, proposta e fechamento",
  },
  {
    term: "globalizacao",
    domain: "geography",
    definition: "o aumento da conexao entre paises em economia, cultura, tecnologia e informacao",
    practicalExample:
      "uma empresa vender para varios paises usando internet e logistica internacional",
  },
  {
    term: "gravidade",
    domain: "science",
    definition: "a forca que atrai corpos com massa uns aos outros",
    practicalExample: "o motivo de objetos cairem em direcao ao chao",
  },
  {
    term: "inflacao",
    domain: "finance",
    definition: "o aumento geral dos precos ao longo do tempo, reduzindo o poder de compra",
    practicalExample: "comprar menos itens hoje com o mesmo valor de dinheiro de antes",
  },
  {
    term: "inteligencia artificial",
    aliases: ["ia", "ai"],
    domain: "ai",
    definition:
      "a area que cria sistemas capazes de executar tarefas que normalmente exigem inteligencia humana",
    practicalExample: "classificar texto, transcrever audio e responder perguntas",
  },
  {
    term: "javascript",
    aliases: ["js"],
    domain: "programming",
    definition:
      "uma linguagem muito usada para criar interatividade na web e tambem sistemas no servidor",
    practicalExample: "fazer um botao reagir ao clique ou processar uma API no Node.js",
  },
  {
    term: "lideranca",
    domain: "business",
    definition: "a capacidade de orientar pessoas e alinhar esforcos em torno de objetivos claros",
    practicalExample: "dar direcao, remover bloqueios e acompanhar resultados do time",
  },
  {
    term: "llm",
    aliases: ["large language model", "modelo de linguagem"],
    domain: "ai",
    definition: "um modelo treinado em grandes volumes de texto para compreender e gerar linguagem",
    practicalExample: "responder perguntas, resumir conteudo ou sugerir codigo",
  },
  {
    term: "machine learning",
    aliases: ["aprendizado de maquina"],
    domain: "ai",
    definition: "uma abordagem em que modelos aprendem padroes a partir de dados",
    practicalExample: "prever categorias, detectar anomalias ou recomendar conteudos",
  },
  {
    term: "mapa mental",
    domain: "education",
    definition: "uma forma visual de organizar ideias a partir de um tema central e seus ramos",
    practicalExample: "ligar um assunto principal a conceitos, exemplos e revisoes",
  },
  {
    term: "margem de lucro",
    domain: "finance",
    definition: "a parte da receita que sobra depois de descontar custos e despesas",
    practicalExample: "vender por 100 e ficar com 20 de ganho liquido",
  },
  {
    term: "node.js",
    aliases: ["nodejs", "node"],
    domain: "programming",
    definition: "um ambiente que permite rodar JavaScript fora do navegador",
    practicalExample: "criar APIs, scripts e automacoes no servidor",
  },
  {
    term: "oferta e demanda",
    domain: "finance",
    definition: "a relacao entre quantidade disponivel de algo e interesse de compra por esse algo",
    practicalExample: "quando a procura sobe e a oferta nao acompanha, o preco tende a subir",
  },
  {
    term: "porcentagem",
    domain: "mathematics",
    definition: "uma maneira de representar uma parte em cada cem",
    practicalExample: "20% significa 20 de cada 100",
  },
  {
    term: "pomodoro",
    domain: "productivity",
    definition: "uma tecnica de foco que alterna blocos curtos de trabalho com pequenas pausas",
    practicalExample: "25 minutos de foco e 5 minutos de descanso",
  },
  {
    term: "probabilidade",
    domain: "mathematics",
    definition: "a medida da chance de um evento acontecer",
    practicalExample: "ao jogar uma moeda, cada lado tem chance de 50%",
  },
  {
    term: "prompt engineering",
    aliases: ["engenharia de prompt", "prompt"],
    domain: "ai",
    definition: "a pratica de estruturar pedidos para obter respostas melhores de modelos de IA",
    practicalExample: "dar contexto, objetivo, formato de saida e criterio de aceite",
  },
  {
    term: "react",
    domain: "programming",
    definition: "uma biblioteca para construir interfaces em componentes reutilizaveis",
    practicalExample: "criar uma tela com cards, botoes e estados separados",
  },
  {
    term: "revisao espaciada",
    aliases: ["revisao espaçada"],
    domain: "education",
    definition: "uma tecnica de estudo que revisa o conteudo em intervalos crescentes",
    practicalExample: "rever hoje, depois em dois dias, uma semana e duas semanas",
  },
  {
    term: "roi",
    aliases: ["retorno sobre investimento"],
    domain: "business",
    definition: "uma medida para comparar o retorno obtido com o valor investido",
    practicalExample: "investir 1000 e gerar 1500 de retorno",
  },
  {
    term: "sistema solar",
    domain: "science",
    definition: "o conjunto formado pelo Sol e pelos corpos que orbitam ao seu redor",
    practicalExample: "planetas, luas, asteroides e cometas influenciados pela gravidade solar",
  },
  {
    term: "substantivo",
    domain: "language",
    definition: "a palavra usada para nomear seres, objetos, lugares, ideias ou sentimentos",
    practicalExample: "escola, alegria, Brasil e estudante",
  },
  {
    term: "typescript",
    aliases: ["ts"],
    domain: "programming",
    definition: "uma extensao do JavaScript que adiciona tipos e ajuda a prevenir erros",
    practicalExample: "declarar que um parametro precisa ser string ou numero",
  },
  {
    term: "verbo",
    domain: "language",
    definition: "a palavra que indica acao, estado ou fenomeno",
    practicalExample: "estudar, correr, ser e chover",
  },
  {
    term: "branding",
    domain: "marketing",
    definition: "a construcao da identidade e da percepcao de uma marca na mente do publico",
    practicalExample: "definir tom de voz, cores, promessa e posicionamento da empresa",
  },
  {
    term: "cac",
    aliases: ["custo de aquisicao de cliente"],
    domain: "marketing",
    definition: "o valor medio gasto para conquistar um novo cliente",
    practicalExample:
      "somar investimento em marketing e vendas e dividir pela quantidade de clientes ganhos",
  },
  {
    term: "capital de giro",
    domain: "entrepreneurship",
    definition: "o dinheiro necessario para manter a operacao funcionando no dia a dia",
    practicalExample: "pagar equipe, fornecedores e contas antes de receber todas as vendas",
  },
  {
    term: "clt",
    domain: "career",
    definition: "o regime formal de trabalho no Brasil com regras trabalhistas previstas em lei",
    practicalExample: "emprego com carteira assinada, ferias e decimo terceiro",
  },
  {
    term: "conversao",
    aliases: ["taxa de conversao"],
    domain: "sales",
    definition: "a proporcao de pessoas que realizam a acao desejada em relacao ao total abordado",
    practicalExample: "100 visitas em uma pagina e 5 compras resultam em 5% de conversao",
  },
  {
    term: "copywriting",
    aliases: ["copy"],
    domain: "marketing",
    definition: "a escrita persuasiva usada para gerar atencao, interesse e acao",
    practicalExample: "texto de anuncio, pagina de vendas ou chamada para clique",
  },
  {
    term: "dopamina",
    domain: "psychology",
    definition: "um neurotransmissor ligado a motivacao, recompensa e expectativa",
    practicalExample: "sensacao de antecipacao ao concluir uma tarefa importante",
  },
  {
    term: "empatia",
    domain: "psychology",
    definition: "a capacidade de compreender sentimentos e perspectivas de outra pessoa",
    practicalExample: "adaptar a explicacao ao nivel de quem esta aprendendo",
  },
  {
    term: "escalabilidade",
    domain: "entrepreneurship",
    definition: "a capacidade de crescer sem aumentar custos na mesma proporcao",
    practicalExample: "um software atender mais clientes com pouca ampliacao de equipe",
  },
  {
    term: "feedback",
    domain: "career",
    definition:
      "o retorno dado sobre comportamento, entrega ou desempenho para promover ajuste e crescimento",
    practicalExample: "comentar o que foi bem feito e o que precisa melhorar em uma apresentacao",
  },
  {
    term: "gatilho mental",
    domain: "marketing",
    definition:
      "um estimulo que influencia a decisao com base em percepcoes e padroes de comportamento",
    practicalExample: "usar prova social, urgencia ou autoridade em uma oferta",
  },
  {
    term: "lead",
    domain: "sales",
    definition: "uma pessoa ou empresa que demonstrou interesse inicial no que voce oferece",
    practicalExample: "alguem que preencheu um formulario para receber contato",
  },
  {
    term: "lifetime value",
    aliases: ["ltv"],
    domain: "sales",
    definition:
      "a receita total estimada que um cliente gera durante o relacionamento com a empresa",
    practicalExample: "somar assinaturas e compras recorrentes ao longo do tempo",
  },
  {
    term: "marca pessoal",
    domain: "career",
    definition: "a percepcao profissional que outras pessoas constroem sobre voce",
    practicalExample: "ser lembrado por clareza, confiabilidade e dominio tecnico",
  },
  {
    term: "mindset de crescimento",
    domain: "psychology",
    definition: "a crenca de que habilidades podem ser desenvolvidas com pratica e estrategia",
    practicalExample: "tratar erro como feedback em vez de prova de incapacidade",
  },
  {
    term: "mvp",
    aliases: ["produto minimo viavel"],
    domain: "entrepreneurship",
    definition: "a versao mais simples de um produto capaz de validar valor com usuarios reais",
    practicalExample: "lançar a funcao principal antes de construir tudo ao redor",
  },
  {
    term: "negociacao",
    domain: "sales",
    definition:
      "o processo de alinhar interesses para chegar a um acordo aceitavel entre as partes",
    practicalExample: "ajustar preco, escopo e prazo de uma proposta comercial",
  },
  {
    term: "okr",
    aliases: ["okrs"],
    domain: "business",
    definition: "uma forma de definir objetivos claros e medir resultados-chave",
    practicalExample: "aumentar a retencao e acompanhar metricas que mostram progresso",
  },
  {
    term: "persona",
    domain: "marketing",
    definition: "um perfil semificticio que representa o publico ideal",
    practicalExample: "descrever dores, objetivos e contexto de quem compraria o produto",
  },
  {
    term: "pitch",
    domain: "entrepreneurship",
    definition: "uma apresentacao curta para explicar valor, problema e oportunidade de um negocio",
    practicalExample: "mostrar em poucos minutos o que a startup faz e por que importa",
  },
  {
    term: "portifolio",
    aliases: ["portfolio", "portfólio"],
    domain: "career",
    definition: "uma selecao de trabalhos usada para demonstrar experiencia e capacidade",
    practicalExample: "listar projetos, contexto, decisao tecnica e resultado obtido",
  },
  {
    term: "posicionamento",
    domain: "marketing",
    definition: "a forma como uma marca quer ser percebida em relacao aos concorrentes",
    practicalExample: "ser vista como a opcao mais simples, premium ou especializada",
  },
  {
    term: "procrastinacao",
    domain: "productivity",
    definition: "o adiamento recorrente de tarefas importantes mesmo sabendo da necessidade delas",
    practicalExample: "trocar uma entrega relevante por atividades menores e menos desconfortaveis",
  },
  {
    term: "prova social",
    domain: "marketing",
    definition: "o uso de exemplos de outras pessoas para aumentar confianca em uma decisao",
    practicalExample: "depoimentos, numeros de clientes e estudos de caso",
  },
  {
    term: "rapport",
    domain: "sales",
    definition: "a conexao de confianca e sintonia criada em uma conversa",
    practicalExample: "ouvir bem, adaptar linguagem e mostrar entendimento real do contexto",
  },
  {
    term: "resiliencia",
    domain: "psychology",
    definition: "a capacidade de se reorganizar diante de pressao, erro ou mudanca",
    practicalExample: "replanejar depois de um resultado ruim sem desistir do objetivo",
  },
  {
    term: "ritmo de estudo",
    domain: "study",
    definition: "a cadencia sustentavel de estudo que equilibra intensidade, descanso e revisao",
    practicalExample: "definir blocos semanais realistas em vez de estudar tudo de uma vez",
  },
  {
    term: "roteiro de estudo",
    domain: "study",
    definition: "uma sequencia planejada de temas, objetivos e revisoes para aprender melhor",
    practicalExample: "dividir uma materia em topicos, exercicios e datas de revisao",
  },
  {
    term: "scrum",
    domain: "career",
    definition:
      "um framework de trabalho iterativo com ciclos curtos, prioridades claras e revisao constante",
    practicalExample: "planejar uma sprint, executar, revisar e ajustar o proximo ciclo",
  },
  {
    term: "seo",
    aliases: ["search engine optimization"],
    domain: "marketing",
    definition:
      "o conjunto de praticas para melhorar a visibilidade organica em mecanismos de busca",
    practicalExample: "otimizar conteudo, estrutura e palavras-chave de uma pagina",
  },
  {
    term: "soft skills",
    domain: "career",
    definition: "habilidades comportamentais que afetam colaboracao, comunicacao e adaptacao",
    practicalExample: "clareza, escuta, organizacao e trabalho em equipe",
  },
  {
    term: "startup",
    domain: "entrepreneurship",
    definition: "uma empresa criada para buscar um modelo de negocio repetivel e escalavel",
    practicalExample: "testar rapidamente hipoteses de produto e mercado com poucos recursos",
  },
  {
    term: "storytelling",
    domain: "marketing",
    definition: "o uso de narrativa para organizar ideias e gerar conexao emocional",
    practicalExample:
      "explicar um produto a partir do problema, conflito e transformacao do cliente",
  },
  {
    term: "vies cognitivo",
    aliases: ["viés cognitivo"],
    domain: "psychology",
    definition: "um atalho mental que influencia julgamento e decisao de forma previsivel",
    practicalExample: "dar peso exagerado a uma primeira impressao",
  },
];

const domainCatalog: Record<
  AssistantKnowledgeDomain,
  { keywords: string[]; agents: string[]; label: string }
> = {
  educai: {
    label: "EducAI",
    keywords: [
      "educai",
      "aula",
      "sessao",
      "transcricao",
      "mentor",
      "material",
      "painel",
      "assistente",
      "alexa",
      "sistema",
      "plataforma",
    ],
    agents: ["educai-agent", "faq-agent", "conversation-agent"],
  },
  general: {
    label: "Conhecimento geral",
    keywords: ["conceito", "definicao", "explicar", "duvida", "duvida geral"],
    agents: ["general-knowledge", "reasoning-agent", "conversation-agent"],
  },
  technology: {
    label: "Tecnologia",
    keywords: [
      "api",
      "frontend",
      "backend",
      "deploy",
      "cloud",
      "sistema",
      "software",
      "infra",
      "seguranca",
    ],
    agents: ["technology-agent", "internet-search-agent", "reasoning-agent"],
  },
  programming: {
    label: "Programacao",
    keywords: [
      "codigo",
      "programacao",
      "javascript",
      "typescript",
      "react",
      "node",
      "funcao",
      "algoritmo",
    ],
    agents: ["programming-agent", "technology-agent", "reasoning-agent"],
  },
  ai: {
    label: "IA",
    keywords: ["ia", "inteligencia artificial", "modelo", "llm", "prompt", "machine learning"],
    agents: ["ai-agent", "reasoning-agent", "internet-search-agent"],
  },
  business: {
    label: "Negocios",
    keywords: [
      "negocio",
      "empresa",
      "gestao",
      "lideranca",
      "vendas",
      "marketing",
      "cliente",
      "crm",
    ],
    agents: ["business-agent", "sales-agent", "marketing-agent"],
  },
  marketing: {
    label: "Marketing",
    keywords: [
      "marketing",
      "marca",
      "branding",
      "copy",
      "copywriting",
      "seo",
      "campanha",
      "anuncio",
      "persona",
    ],
    agents: ["marketing-agent", "sales-agent", "business-agent"],
  },
  sales: {
    label: "Vendas",
    keywords: [
      "vendas",
      "lead",
      "conversao",
      "fechamento",
      "pitch",
      "negociacao",
      "proposta",
      "cliente",
    ],
    agents: ["sales-agent", "business-agent", "marketing-agent"],
  },
  entrepreneurship: {
    label: "Empreendedorismo",
    keywords: [
      "startup",
      "mvp",
      "escalabilidade",
      "modelo de negocio",
      "empreendedorismo",
      "capital de giro",
    ],
    agents: ["entrepreneurship-agent", "business-agent", "finance-agent"],
  },
  education: {
    label: "Educacao",
    keywords: [
      "estudo",
      "aprender",
      "ensino",
      "didatica",
      "resumo",
      "mapa mental",
      "revisao",
      "metodologia",
    ],
    agents: ["education-agent", "study-agent", "conversation-agent"],
  },
  study: {
    label: "Estudo",
    keywords: [
      "revisao espaciada",
      "estudar",
      "estudo",
      "roteiro de estudo",
      "ritmo de estudo",
      "memorizacao",
    ],
    agents: ["study-agent", "education-agent", "productivity-agent"],
  },
  language: {
    label: "Linguagem",
    keywords: ["gramatica", "verbo", "substantivo", "texto", "redacao", "escrita", "idioma"],
    agents: ["language-agent", "writing-agent", "conversation-agent"],
  },
  science: {
    label: "Ciencias",
    keywords: ["ciencia", "biologia", "quimica", "fisica", "fotossintese", "gravidade", "energia"],
    agents: ["science-agent", "reasoning-agent", "education-agent"],
  },
  history: {
    label: "Historia",
    keywords: ["historia", "revolucao", "imperio", "idade media", "guerra", "colonizacao"],
    agents: ["history-agent", "general-knowledge", "education-agent"],
  },
  geography: {
    label: "Geografia",
    keywords: ["geografia", "pais", "regiao", "territorio", "globalizacao", "clima", "mapa"],
    agents: ["geography-agent", "general-knowledge", "education-agent"],
  },
  mathematics: {
    label: "Matematica",
    keywords: ["matematica", "equacao", "porcentagem", "probabilidade", "fracao", "calculo"],
    agents: ["mathematics-agent", "reasoning-agent", "study-agent"],
  },
  career: {
    label: "Carreira",
    keywords: [
      "carreira",
      "curriculo",
      "portfolio",
      "clt",
      "entrevista",
      "feedback",
      "soft skills",
      "scrum",
    ],
    agents: ["career-agent", "productivity-agent", "conversation-agent"],
  },
  psychology: {
    label: "Psicologia",
    keywords: ["psicologia", "empatia", "resiliencia", "motivacao", "dopamina", "mindset", "vies"],
    agents: ["psychology-agent", "conversation-agent", "study-agent"],
  },
  health_basic: {
    label: "Saude basica",
    keywords: ["saude", "sintoma", "febre", "dor", "medicamento", "alimentacao"],
    agents: ["health-basic-agent", "conversation-agent", "internet-search-agent"],
  },
  legal_basic: {
    label: "Direito basico",
    keywords: ["lei", "juridico", "direito", "contrato", "regra", "processo"],
    agents: ["legal-basic-agent", "conversation-agent", "internet-search-agent"],
  },
  productivity: {
    label: "Produtividade",
    keywords: ["foco", "produtividade", "pomodoro", "organizacao", "rotina", "prioridade"],
    agents: ["productivity-agent", "study-agent", "career-agent"],
  },
  finance: {
    label: "Financas",
    keywords: ["dinheiro", "fluxo de caixa", "lucro", "inflacao", "orcamento", "investimento"],
    agents: ["finance-agent", "business-agent", "internet-search-agent"],
  },
  news: {
    label: "Noticias",
    keywords: ["noticia", "noticias", "hoje", "atualidade", "recente", "aconteceu"],
    agents: ["news-agent", "internet-search-agent", "reasoning-agent"],
  },
  entertainment: {
    label: "Entretenimento",
    keywords: ["filme", "serie", "musica", "entretenimento", "celebridade", "cultura pop"],
    agents: ["entertainment-agent", "conversation-agent", "internet-search-agent"],
  },
  gaming: {
    label: "Games",
    keywords: ["game", "jogo", "gaming", "console", "rpg", "fps"],
    agents: ["gaming-agent", "conversation-agent", "internet-search-agent"],
  },
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function titleCase(value: string) {
  const clean = value.trim();
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesKnowledgeTerm(text: string, term: string) {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term).trim();
  if (!normalizedTerm) return false;

  const isShortToken = normalizedTerm.length <= 3 && !normalizedTerm.includes(" ");
  if (isShortToken) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i").test(normalizedText);
  }

  return normalizedText.includes(normalizedTerm);
}

function transcriptSummary(context?: LiveAssistantContext) {
  if (!context) return "";
  return [...context.transcriptSegments.map((segment) => segment.text), context.interimTranscript]
    .filter(Boolean)
    .join(" ");
}

function allAliases(entry: KnowledgeEntry) {
  return [entry.term, ...(entry.aliases ?? [])].map(normalizeText);
}

function findKnowledgeEntries(question: string) {
  return knowledgeEntries.filter((entry) =>
    allAliases(entry).some((alias) => includesKnowledgeTerm(question, alias)),
  );
}

function compareResponse(entries: KnowledgeEntry[]) {
  const [first, second] = entries;
  return [
    `**${titleCase(first.term)} x ${titleCase(second.term)}**`,
    `${titleCase(first.term)}: ${first.definition}.`,
    `${titleCase(second.term)}: ${second.definition}.`,
  ].join("\n");
}

function termResponse(question: string, entry: KnowledgeEntry) {
  const wantsExample = /(exemplo|na pratica|como funciona|como usar|aplicacao)/i.test(question);
  const lines = [`**${titleCase(entry.term)}**`, `${entry.definition}.`];
  if (wantsExample && entry.practicalExample) {
    lines.push(`Exemplo pratico: ${entry.practicalExample}.`);
  }
  return lines.join("\n");
}

function confidenceFromScore(score: number): AssistantConfidence {
  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

export function routeAssistantQuestion(
  question: string,
  context?: LiveAssistantContext,
): AssistantKnowledgeRoute {
  const normalized = normalizeText(question);
  const matchedEntries = findKnowledgeEntries(question);
  const domainScores = new Map<AssistantKnowledgeDomain, number>();

  for (const [domain, config] of Object.entries(domainCatalog) as Array<
    [AssistantKnowledgeDomain, (typeof domainCatalog)[AssistantKnowledgeDomain]]
  >) {
    const keywordHits = config.keywords.filter((keyword) =>
      includesKnowledgeTerm(question, keyword),
    );
    if (keywordHits.length) {
      domainScores.set(domain, (domainScores.get(domain) ?? 0) + keywordHits.length);
    }
  }

  for (const entry of matchedEntries) {
    domainScores.set(entry.domain, (domainScores.get(entry.domain) ?? 0) + 4);
  }

  if (context) {
    const transcript = normalizeText(transcriptSummary(context));
    if (
      transcript &&
      matchedEntries.some((entry) => includesKnowledgeTerm(transcript, entry.term))
    ) {
      domainScores.set("educai", (domainScores.get("educai") ?? 0) + 2);
    }
  }

  const sorted = [...domainScores.entries()].sort((a, b) => b[1] - a[1]);
  const domain = sorted[0]?.[0] ?? "general";
  const score = sorted[0]?.[1] ?? 0;
  const requiresFreshSources =
    /\b(hoje|agora|atual|atualmente|ultim[ao]s?|noticia|noticias|preco|cotacao|cotacao|lei nova|mudou|mudanca recente)\b/i.test(
      normalized,
    );
  const shouldUseProvider =
    requiresFreshSources ||
    matchedEntries.length === 0 ||
    !["educai", "general"].includes(domain) ||
    score < 5;

  return {
    domain,
    confidence: confidenceFromScore(score),
    matchedTerms: unique(matchedEntries.map((entry) => entry.term)),
    requiresFreshSources,
    shouldUseProvider,
    suggestedAgents: domainCatalog[domain].agents,
  };
}

export function buildKnowledgeFallbackResponse(
  question: string,
  mode: LiveAssistantMode,
  context?: LiveAssistantContext,
) {
  const matchedEntries = findKnowledgeEntries(question);
  const route = routeAssistantQuestion(question, context);

  if (matchedEntries.length >= 2 && /(diferenc|compar|versus| vs | ou )/i.test(question)) {
    return compareResponse(matchedEntries.slice(0, 2));
  }

  if (matchedEntries[0]) {
    return termResponse(question, matchedEntries[0]);
  }

  if (route.requiresFreshSources) {
    return [
      "**Informacao atualizada**",
      "Essa pergunta parece depender de dados recentes ou verificacao externa.",
      "Consigo explicar o conceito geral, mas para cravar o dado mais atual o ideal e consultar fontes recentes.",
    ].join("\n");
  }

  const transcript = transcriptSummary(context);
  if (route.domain === "educai" && transcript) {
    return [
      "**Contexto da aula**",
      "Nao encontrei uma resposta pronta na base geral, mas posso responder com o que ja apareceu na aula.",
      transcript.slice(0, 220).trim() + (transcript.length > 220 ? "..." : ""),
    ].join("\n");
  }

  return mode === "mentor"
    ? "Posso aprofundar esse tema melhor com apoio do provider de IA geral. Sem ele, me diga o conceito exato que voce quer revisar ou comparar."
    : "Posso responder melhor essa pergunta com a IA geral habilitada. Sem ela, tente pedir um conceito especifico, uma comparacao ou um exemplo pratico.";
}

export function providerContextSummary(
  route: AssistantKnowledgeRoute,
  context?: LiveAssistantContext,
) {
  const sessionBits = [
    context?.sessionTitle ? `Sessao: ${context.sessionTitle}` : "",
    context?.sessionType ? `Tipo: ${context.sessionType}` : "",
    context?.activeSpeaker ? `Falante ativo: ${context.activeSpeaker}` : "",
  ].filter(Boolean);

  const transcript = transcriptSummary(context);
  const transcriptPreview = transcript ? transcript.slice(-1200) : "";

  return {
    sessionSummary: sessionBits.join(" | "),
    transcriptPreview,
    routeSummary: `Dominio principal: ${route.domain}; confianca: ${route.confidence}; agentes sugeridos: ${route.suggestedAgents.join(", ")}.`,
  };
}
