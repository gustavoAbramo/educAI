# Architecture Hardening - 2026-06

## Objetivo desta fase

Fortalecer a base atual antes de avancar para launcher, orquestrador desktop e empacotamento executavel. O foco desta iteracao foi reduzir comportamento enganoso, endurecer contratos entre runtime e providers e preparar o sistema para crescer com providers locais e em nuvem sem ambiguidade operacional.

## Diagnostico resumido

Antes desta fase, a arquitetura ja tinha avancado em modularidade de providers e validacao de runtime, mas ainda havia um risco importante de produto:

- providers simulados continuavam misturados com comportamento normal de producao
- algumas telas ainda tratavam indisponibilidade como placeholder amigavel
- testes de integracao assumiam simulacao implicita, o que mascarava regressao real
- o runtime ainda tendia a cair em `mock` quando nenhuma configuracao real estava presente

Na pratica, isso deixava a base funcional para demos e desenvolvimento, mas menos confiavel para operacao real e para a futura migracao desktop/local-first.

## O que foi endurecido nesta iteracao

### 1. Separacao clara entre simulacao e producao

- `mock` continua existindo, mas passou a ser tratado como modo de desenvolvimento.
- O uso de simulacao agora depende de `EDUCAI_ENABLE_SIMULATED_PROVIDERS=true` ou ambiente de teste.
- Quando a simulacao nao esta habilitada, o backend falha com erro explicito em vez de fabricar transcricoes, materiais ou respostas.

### 2. Defaults mais alinhados ao produto futuro

- transcricao automatica agora prefere `faster-whisper` quando nao ha OpenAI ou Gemini
- geracao automatica agora prefere `ollama` quando nao ha OpenAI ou Gemini

Isso aproxima o comportamento padrao da estrategia local-first sem remover suporte cloud.

### 3. Contrato de catalogo mais honesto

O catalogo de providers agora diferencia melhor:

- `ready`
- `missing_config`
- `coming_soon`
- `development_only`

Essa distincao melhora a configuracao no frontend e evita tratar provider simulado como provider pronto de produto.

### 4. Suite de testes mais confiavel

- testes que dependem de simulacao agora declaram isso explicitamente
- foi adicionado teste cobrindo a rejeicao de `mock` quando a simulacao esta desabilitada
- a suite principal continua validando transcricao, materiais, chat, web search, Ollama e Faster-Whisper

## Impacto arquitetural

Esta mudanca melhora quatro propriedades importantes da base:

### Confiabilidade

O sistema nao apresenta mais conteudo simulado como se fosse resultado oficial sem opt-in explicito.

### Observabilidade operacional

Erros agora apontam melhor para a acao correta: configurar chave, iniciar worker local ou habilitar simulacao apenas em ambiente controlado.

### Escalabilidade de providers

Ao separar disponibilidade, selecao e permissao de uso, fica mais facil encaixar novos providers locais sem criar regras escondidas no fluxo principal.

### Preparacao para desktop

O executavel futuro vai precisar distinguir com clareza:

- runtime local real disponivel
- runtime local instalado, mas offline
- runtime simulado para desenvolvimento

Esta iteracao prepara essa fronteira.

## Debitos tecnicos que continuam prioritarios

### 1. Mock internals ainda precisam continuar isolados

Os geradores simulados ja foram movidos para `src/server/simulated-session-runtime.ts`, mas o proximo passo ideal continua sendo reduzir ainda mais o peso desses fixtures no runtime principal e, quando fizer sentido, aproximar esse conteudo de helpers de teste e desenvolvimento.

### 2. Estado de provider selecionado vs provider realmente operacional

Hoje o sistema distingue melhor catalogo e disponibilidade, mas ainda nao calcula um estado consolidado de "selecionado e operacional". Uma proxima evolucao importante e expor no backend um `effectiveRuntimeStatus` por capacidade:

- transcription
- materials
- chat
- assistant

### 3. Fallbacks entre capacidades ainda podem ser refinados

O assistente hibrido ja faz roteamento por dominio e atualidade, mas o contrato entre:

- conhecimento local
- provider selecionado
- web search
- estado de configuracao

ainda pode evoluir para uma matriz mais explicita de decisao.

### 4. Persistencia e historico de falhas

Ainda falta registrar com mais clareza:

- por que um processamento falhou
- qual provider foi usado
- qual provider estava configurado
- se o erro foi de credencial, rede, modelo ou parse

Isso vai ser importante para suporte operacional e para o produto desktop.

## Proxima ordem recomendada

1. Extrair mocks/fixtures do pipeline principal
2. Expor estado efetivo por capacidade no backend
3. Melhorar telas de erro e empty state com foco operacional
4. Registrar telemetria local de falhas por provider
5. Refinar a matriz de fallback entre local knowledge, provider e web search
6. So depois disso abrir a fase de launcher/orquestrador desktop

## Criterio de prontidao antes do desktop

A base atual vai estar pronta para a fase de executavel quando cumprir estes criterios:

- nenhum fluxo principal depender de mock implicito
- providers locais e cloud tiverem estado operacional claro
- falhas forem reproduziveis e diagnosticaveis
- configuracao puder ser testada pelo proprio produto
- audio, transcricao, materiais e assistente compartilharem contratos previsiveis

Esse endurecimento e a fundacao para distribuir um produto mais confiavel, mais honesto e mais facil de manter.
