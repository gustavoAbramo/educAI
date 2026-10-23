# Run Loop - 2026-06-15 - Cycle 05

## Objetivo do ciclo

Fazer o dashboard ao vivo parar de reagir apenas ao volume visual da fala e passar a priorizar relevancia real, ao mesmo tempo em que o sistema aprende a transformar a conversa em um novo material diagnostico util para agir melhor depois.

Focos definidos:

- score de relevancia para sinais ao vivo
- classificacao de pergunta, tarefa, decisao, risco, destaque e ruido
- sugestao de resposta e proxima pergunta com base em contexto real
- novo material `LESSON_DIAGNOSIS`
- manutencao de estados honestos quando faltar evidencia

## Agentes/papeis usados nesta run

- Arquitetura: separacao da camada de relevancia e extensao do catalogo de materiais
- Produto: priorizacao de sinais fortes, resposta sugerida e diagnostico reaproveitavel
- UI/UX: painel da aula mais inteligente e tela de resultado com nova entrega
- Backend: schema, parser, formatacao e simulacao do novo material
- QA: testes unitarios, integracao e build
- Documentacao: registro do ciclo e proximos passos

## Diagnostico inicial

O ciclo 04 tinha recuperado bem o impacto do preview ao vivo, mas ainda havia tres limites claros:

1. O sistema ainda nao distinguia bem ruido de sinal importante.
2. O preview mostrava pontos interessantes, mas ainda nao orientava bem a conducao da conversa.
3. A base de materiais gerados ainda nao convertia a fala em diagnostico acionavel de dor, duvida, objecao, oportunidade e resposta sugerida.

## Problemas encontrados

### Altos

- Falta de priorizacao formal dos sinais ao vivo.
- Ausencia de uma camada isolada para classificar relevancia e explicar o motivo.
- Falta de um material diagnostico reaproveitavel para pos-aula.

### Medios

- Sugestoes de resposta ainda dependiam de heuristica muito rasa.
- A tela de resultado nao expunha uma entrega diagnostica propria.

### Baixos

- Catalogo de materiais precisava crescer sem criar drift entre backend, simulacao, UI e exportacao.

## Priorizacao aplicada

1. Criar motor puro de relevancia ao vivo
2. Integrar relevancia ao `live-preview`
3. Adaptar a UI da aula para destacar so o que realmente importa
4. Criar material `LESSON_DIAGNOSIS` no pipeline oficial
5. Exibir o novo material em resultado e exportacao
6. Cobrir tudo com testes antes do commit

## Implementacoes realizadas

### 1. Motor isolado de relevancia ao vivo

- `src/lib/live-relevance.ts`
- `src/lib/live-relevance.test.ts`

Foi criada uma camada dedicada para:

- receber termos, highlights, fala parcial, metricas e contexto da sessao
- gerar `relevanceScore` entre `0` e `1`
- classificar cada sinal em `question`, `task`, `decision`, `risk`, `highlight` ou `noise`
- explicar o motivo da classificacao
- sugerir proxima acao
- sugerir resposta recomendada e proxima pergunta quando houver contexto suficiente

Regras importantes implementadas:

- decisoes explicitas recebem score alto
- tarefas acionaveis sobem de prioridade
- duvidas recorrentes ganham score maior
- ruido e alertas de linguagem ficam com teto baixo
- estados sem evidencia nao fabricam inteligencia falsa

### 2. Dashboard ao vivo ficou mais inteligente

- `src/lib/live-preview.ts`
- `src/lib/live-preview.test.ts`
- `src/routes/aula.tsx`

O preview agora usa o motor de relevancia para:

- escolher o insight principal do momento
- resumir o por que esse insight importa
- filtrar o que merece destaque alto
- gerar resposta sugerida com tom e confianca
- gerar a melhor proxima pergunta para o operador

Na UI da aula, isso apareceu como:

- foco principal mais orientado por relevancia
- bloco de `Insights importantes` mostrando categoria, score e motivo
- card de `Resposta sugerida`
- bloco de `Proxima melhor pergunta`
- alertas menos ruidosos

### 3. Novo material `LESSON_DIAGNOSIS`

- `src/lib/material-definitions.ts`
- `src/lib/voice-intelligence.ts`
- `src/types/api.ts`
- `src/server/material-generation.ts`
- `src/server/simulated-session-runtime.ts`
- `src/routes/nova-aula.tsx`
- `src/routes/resultado.tsx`

Foi adicionado um novo tipo de material oficial:

- `LESSON_DIAGNOSIS`

Esse material agora permite gerar:

- dores identificadas
- duvidas recorrentes
- objecoes percebidas
- oportunidades
- pontos de atencao
- decisoes e tarefas futuras
- resumo acionavel
- recomendacoes praticas
- respostas sugeridas com tom, motivo, confianca e proxima pergunta

Importante:

- o schema exige estrutura clara
- o formatter devolve texto honesto quando a evidencia for insuficiente
- a simulacao foi alinhada ao novo material
- a tela `nova-aula` ganhou a nova opcao de saida
- a tela `resultado` ganhou a aba `Diagnostico`
- a exportacao Markdown passou a incluir o diagnostico

## Arquivos alterados

- `docs/run-loop-2026-06-15-cycle-05.md`
- `src/lib/live-relevance.ts`
- `src/lib/live-relevance.test.ts`
- `src/lib/live-preview.ts`
- `src/lib/live-preview.test.ts`
- `src/lib/material-definitions.ts`
- `src/lib/voice-intelligence.ts`
- `src/types/api.ts`
- `src/routes/aula.tsx`
- `src/routes/nova-aula.tsx`
- `src/routes/resultado.tsx`
- `src/server/material-generation.ts`
- `src/server/simulated-session-runtime.ts`
- `src/server/voice-api.integration.test.ts`

## Testes executados

### Automatizados

- `npm run build`
- `node --import tsx --test src/lib/live-relevance.test.ts src/lib/live-preview.test.ts src/lib/live-assistant.test.ts src/server/assistant-service.test.ts`
- `node --import tsx --test src/server/voice-api.integration.test.ts`

### Cobertura validada neste ciclo

- score e classificacao de relevancia ao vivo
- ruido e linguagem fraca sem destaque indevido
- perguntas recorrentes com score alto
- decisoes e tarefas com comportamento forte
- resposta sugerida baseada em contexto
- pipeline do novo material `LESSON_DIAGNOSIS`
- UI da aula e resultado compilando com o novo fluxo
- regressao da API V1 completa

## Revisao critica do ciclo

### O que melhorou bastante

- o preview ao vivo agora escolhe melhor o que merece atencao
- o sistema ajuda mais a conduzir a conversa, nao apenas observar
- surgiu uma ponte concreta entre ao vivo e pos-aula
- o novo material diagnostico deixa a base muito mais reaproveitavel para tarefas, relatorios e decisao

### O que ainda nao chega em 9.8

1. O score ainda e heuristico; falta camada mais forte de evidencia temporal e agrupamento por topico.
2. As respostas sugeridas ainda nao aprendem com historico da sessao ou feedback humano.
3. O diagnostico ainda nao alimenta persistencia operacional, como tarefas formais, CRM ou decisao versionada.
4. Falta aproximar mais o material diagnostico da automacao do assistente e da tela de resultado executiva.

## Nota do ciclo

## 9.6 / 10

### Justificativa

Este ciclo elevou a inteligencia do sistema de forma real, nao cosmetica. O ao vivo ficou mais criterioso, as sugestoes de resposta passaram a ter contexto e a base ganhou um novo material estrategico para transformar conversa em acao.

A nota ainda fica abaixo de 9.8 porque:

- o score ainda e baseado em heuristica local
- nao ha memoria persistida entre sessoes para calibrar sugestoes
- o diagnostico ainda nao dispara automacoes de produto por si so

## Pendencias reais para a proxima iteracao

1. Persistir sinais fortes como tarefas, decisoes e follow-ups estruturados
2. Criar agrupamento temporal por tema e score de confianca por insight
3. Ligar `LESSON_DIAGNOSIS` a fluxos executivos, relatorios e assistente contextual
4. Revisar mais textos historicos com acentuacao e consistencia de linguagem
