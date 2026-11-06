# Decisões tomadas na documentação do educAI

Este arquivo lista as escolhas que eu (Claude) fiz no lugar da dupla ao montar o
**ES_RELFINAL_NOME1_NOME2.docx**: o que decidi, como e por quê. Revisem e digam o que
querem mudar.

## O que está nesta pasta

| Arquivo | O que é |
| --- | --- |
| `ES_RELFINAL_NOME1_NOME2.docx` | Relatório completo (55 páginas), editável no Word |
| `ES_RELFINAL_NOME1_NOME2.pdf` | Versão em PDF, gerada pelo próprio Word, para conferência |
| `figuras/` | Todas as imagens usadas no documento (PNG) |
| `figuras/fontes-svg/` | Arquivos-fonte editáveis dos diagramas e do protótipo (SVG) |
| `DECISOES-TOMADAS.md` | Este arquivo |

## O que vocês PRECISAM fazer antes de entregar

1. **Trocar os placeholders**: `[NOME COMPLETO DO INTEGRANTE 1]`, `[NOME COMPLETO DO INTEGRANTE 2]`,
   `[NOME COMPLETO DO(A) PROFESSOR(A)]` e `[E-MAIL DE CONTATO DA DUPLA]` (seção 4.9). Use Ctrl+L
   (Localizar) no Word buscando por `[`.
2. **Renomear o PDF** para `ES_RELFINAL_NOME1_NOME2.pdf` com os nomes reais.
3. **Atualizar sumário e listas** depois de editar: Ctrl+A e depois F9 no Word (escolha
   "Atualizar o índice inteiro").
4. **Ler a declaração de uso de IA (Apêndice B)** e confirmar que ela é verdadeira para vocês.
5. **Assinar o Apêndice B**, se o professor exigir assinatura.

## Decisões de estrutura e formato

| # | Decisão | Como ficou | Por quê |
| --- | --- | --- | --- |
| 1 | Qual modelo seguir quando os dois arquivos discordam | Segui o **enunciado do Trabalho Final** como regra principal e usei o modelo da Fatec só para capa, folha de rosto e estilo | O enunciado diz que a ordem da estrutura é obrigatória e é ele que define a nota |
| 2 | Abstract (resumo em inglês) | **Não incluí** | O modelo de monografia pede, mas o enunciado lista só "Resumo em português" e diz que a ordem é obrigatória. Se o professor quiser, é só traduzir o resumo |
| 3 | Tamanho do resumo | ~235 palavras | O enunciado pede 150–250 (o modelo de TCC pede 250–500, mas isso é para TCC) |
| 4 | Fonte | **Arial 12**, legendas e quadros em 10 | O enunciado permite Arial ou Times; Arial combina com o modelo da Fatec |
| 5 | Numeração das páginas | Conta a partir da folha de rosto e aparece a partir da Introdução (página 9), canto superior direito | Exatamente o que a seção 7 do enunciado pede |
| 6 | Tabelas x quadros | Chamei tudo de **Quadro** (21 quadros) | Pela ABNT, "tabela" é para dados numéricos; o nosso conteúdo é textual |
| 7 | Legendas | Centralizadas, acima da figura/quadro, com "Fonte:" abaixo | O enunciado pede título acima e fonte abaixo; o modelo da Fatec mostra centralizado |
| 8 | Nome do arquivo | `ES_RELFINAL_NOME1_NOME2` | Formato exigido; só falta trocar pelos nomes |
| 9 | Disciplina na capa | "Engenharia de Software (IES020) e Interação Humano-Computador" | O trabalho vale para as duas disciplinas |

## Decisões de conteúdo — Engenharia de Software

| # | Decisão | Como ficou | Por quê |
| --- | --- | --- | --- |
| 10 | Quais tópicos opcionais | **A e B (obrigatórios) + C, D, E, G** = 6 tópicos | O mínimo é 5; fiz 6 como margem de segurança. Escolhi os que o repositório já tem evidência forte: ciclos em `docs/run-loop-*` (C), riscos reais de IA/LGPD (D), arquitetura documentada em `docs/` (E) e `package.json` (G) |
| 11 | Tópicos que deixei de fora | F, H, I, J | H (SOA) e F se sobrepõem a E; I e J renderiam texto mais genérico, que o enunciado diz que "não pontua" |
| 12 | Técnica de levantamento de requisitos | Brainstorming + análise de sistemas similares (Fireflies, citado no AI_CONTEXT.md) + prototipagem (Lovable) + engenharia reversa do código | É o que de fato aconteceu, pelo que o repositório mostra. **Confirmem se vocês fizeram entrevista ou questionário com alguém** — se sim, vale acrescentar, porque pontua mais |
| 13 | Quantidade de requisitos | 15 RF e 8 RNF (mínimo era 10 e 5) | Todos conferidos no código; sobra caso o professor descarte algum |
| 14 | Priorização | Essencial / Importante / Desejável (MoSCoW simplificado) | Simples de explicar na arguição |
| 15 | Histórias de usuário e casos de uso | Fiz os dois: 4 histórias + 3 casos de uso expandidos (UC01, UC02, UC08) | O enunciado aceita um ou outro; fazer os dois cobre qualquer interpretação |
| 16 | Diagramas UML | Casos de uso, classes, **sequência e estados** (o enunciado pede pelo menos 1 comportamental) | O de estados aproveita o enum `SessionStatus` real e reforça a coerência entre diagramas |
| 17 | Classes no diagrama | Derivadas de `src/types/api.ts`; provedores representados como interfaces | O código usa tipos e funções, não classes; expliquei isso no texto como limitação |
| 18 | Modelo de processo adotado | **Incremental com prototipagem evolutiva** (comparado com cascata, espiral e prototipagem) | Bate com o histórico: protótipo no Lovable + ciclos curtos documentados em junho/2026 |
| 19 | Escala de riscos | Probabilidade e impacto de 1 a 3, 7 riscos | O mínimo era 5; escala 1–3 é mais fácil de defender oralmente |
| 20 | Custos em nuvem | Descrição qualitativa, **sem preços em reais** | Preço de API muda com frequência; número errado seria pior que nenhum |
| 21 | Estilo arquitetural | Cliente-servidor + camadas + portas e adaptadores (provedores) | Reflete a separação real de `src/routes`, `src/services`, `src/server` |

## Decisões de conteúdo — IHC

| # | Decisão | Como ficou | Por quê |
| --- | --- | --- | --- |
| 22 | Tela avaliada | **"Aula em andamento" (/aula)** | É a tela mais crítica (se a gravação falha, nada funciona) e o print de vocês já mostrava problemas reais: "Gravando" no topo com "Pausada" no painel, e "Permission denied" em inglês |
| 23 | Quantidade de problemas | **8 problemas em 8 heurísticas** | O enunciado pede 5 em 5 heurísticas; o checklist fala em 6. Fiz 8 para sobrar |
| 24 | Severidades | P01 = 3 (estado contraditório) e P02 = 4 (erro em inglês impede gravar); os demais 1–2 | Assim os de severidade 3 e 4 ficaram claramente justificados e tratados, como o enunciado exige |
| 25 | Ferramenta do protótipo | **Desenhei o protótipo em SVG** no estilo do educAI, não no Figma | Não tinha acesso ao Figma de vocês. O enunciado aceita "Figma ou ferramenta equivalente". Se preferirem, dá para recriar no Figma usando a Figura 10 como guia |
| 26 | O protótipo foi implementado no código? | **Não.** É só proposta | Vocês não pediram mudança no código; o texto deixa claro que é reformulação proposta |
| 27 | Comparação antes/depois | Figura lado a lado (Figura 9) + versão grande (Figura 10), numeração verde batendo com P01–P08 | Exigência da Etapa 3 |

## Decisões de conteúdo — Manual

| # | Decisão | Como ficou | Por quê |
| --- | --- | --- | --- |
| 28 | Cadastro / login / senha | Explicado como **"não se aplica"** | O sistema é local e não tem contas; o enunciado diz "quando aplicável" |
| 29 | Quantidade de tutoriais | 8 (mínimo 5) | Cobre o fluxo inteiro, incluindo a tela reformulada (Tutorial 2) |
| 30 | Prints | Usei os da pasta `apresentacao/prints`, com caixas e números azuis | Os prints já existiam e estão atuais |
| 31 | Canal de suporte | GitHub Issues do repositório + e-mail **a preencher** | Não sei qual e-mail vocês querem expor |

## Decisões sobre referências e honestidade

| # | Decisão | Como ficou | Por quê |
| --- | --- | --- | --- |
| 32 | Referências | 14 referências (mínimo 6): Sommerville, Pressman, Bezerra, 3 de Nielsen, Barbosa & Silva (IHC), Boehm, Bass et al., Fowler, LGPD e 3 normas ABNT | Atende "3 do plano de ensino + 1 de Nielsen" com folga. **Confiram se a edição dos livros bate com a da biblioteca de vocês** |
| 33 | Declaração de uso de IA | Apêndice B declara que o Claude ajudou a escrever o relatório e que o Lovable gerou o protótipo inicial | O enunciado pede essa declaração; deixá-la vaga seria arriscado na arguição |
| 34 | Modo simulado nos prints | Mencionei na seção 3.6 e nas considerações finais que alguns textos dos prints vêm do modo simulado (em inglês) | Os prints do histórico e da transcrição mostram textos simulados; melhor admitir do que o professor perceber |
| 35 | Limitações reais do sistema | Citadas abertamente: sem autenticação, upload de arquivo só pela API, PDF não implementado, telas muito grandes | O enunciado exige "análise crítica" em cada tópico; ponto fraco documentado conta a favor |

## Pontos que valem uma conversa da dupla

- **Item 12**: se houve entrevista/questionário com colegas ou professores, acrescentem em 2.1.2.
- **Item 25**: o professor pode preferir ver o protótipo no Figma — vale perguntar.
- **Item 2**: se o professor seguir o modelo de monografia à risca, falta o Abstract.
- O documento ficou com **55 páginas**. Se houver limite de páginas, os Quadros 5–7
  (casos de uso) e o Apêndice A são os mais fáceis de enxugar.
