# Run Loop - 2026-06-16 - Cycle 10

## Objetivo do ciclo

Transformar os diagnosticos de IA local em um guia acionavel de setup, para que o usuario saiba exatamente como sair de uma pilha parcial/bloqueada e chegar em operacao local/offline.

## Foco

- criar um checklist guiado no backend
- expor passos de setup na API de saude dos providers
- mostrar o guia na tela de configuracoes
- manter a leitura honesta de estados `done`, `todo` e `blocked`
- validar o contrato por teste de integracao

## Diagnostico inicial

Depois dos ciclos 08 e 09, o sistema ja sabia diagnosticar:

- Ollama
- Faster-Whisper
- geracao JSON estruturada
- readiness offline
- capacidades selecionadas

Mas a experiencia ainda estava mais tecnica do que orientada a acao. O usuario via o que estava errado, mas precisava inferir a ordem ideal de correcao.

## Implementacoes realizadas

### 1. Tipo compartilhado para guia de setup

- `src/lib/voice-intelligence.ts`

Foi criado `ProviderSetupStep`, com:

- `id`
- `label`
- `status`: `done`, `todo` ou `blocked`
- `action`
- `detail`

O envelope `ProviderRuntimeHealthEnvelope` agora inclui `setupGuide`.

### 2. Guia local calculado no backend

- `src/server/provider-runtime-health.ts`

Foi adicionada a funcao `localSetupGuide`, que monta passos reais com base em:

- provider de transcricao selecionado
- status do Faster-Whisper
- backend command/mock
- comando real configurado
- provider de IA selecionado
- status do Ollama
- modelo local disponivel
- geracao JSON valida
- busca web desligada

Passos atuais:

1. selecionar transcricao local
2. subir worker Faster-Whisper
3. configurar comando real de transcricao
4. selecionar IA local
5. subir Ollama
6. disponibilizar modelo local
7. validar materiais estruturados
8. desligar busca web para offline total

### 3. Guia visual na tela de configuracoes

- `src/routes/configuracoes.tsx`

A tela agora exibe um card "Guia de ativacao local", com:

- status offline geral
- passos numerados
- selo de estado por passo
- acao recomendada
- detalhe tecnico/operacional

Isso coloca a experiencia em uma ordem mais amigavel: primeiro o usuario ve o que fazer, depois pode olhar os cards tecnicos de Ollama e Faster-Whisper.

### 4. Teste de contrato da API

- `src/server/voice-api.integration.test.ts`

O teste de runtime health agora valida:

- `setupGuide` retornado pela API
- quantidade minima de passos
- passos locais marcados como `done` quando o ambiente simulado esta saudavel
- busca web ainda como `todo` quando nao esta desligada

## Arquivos alterados

- `docs/run-loop-2026-06-16-cycle-10.md`
- `src/lib/voice-intelligence.ts`
- `src/routes/configuracoes.tsx`
- `src/server/provider-runtime-health.ts`
- `src/server/voice-api.integration.test.ts`

## Testes executados

- `node --import tsx --test src/server/provider-http.test.ts src/server/provider-endpoint.test.ts src/server/voice-api.integration.test.ts`
- `node --import tsx --test workers/faster-whisper-local/server.test.ts workers/faster-whisper-local/command-bridge.test.ts`
- `npm run build`

## Resultado

- A pilha local ficou mais explicavel.
- A tela de configuracoes agora orienta a ativacao local/offline passo a passo.
- O contrato de API passa a carregar nao apenas status, mas orientacao operacional.

## Nota do ciclo

## 9.1 / 10

### Justificativa

O ciclo melhora bastante o produto para uso real, porque reduz ambiguidade e ajuda o usuario a resolver problemas de runtime local. Ainda nao e um instalador/launcher, mas ja e uma camada de preparacao muito util para esse futuro.

A nota ainda nao chega a 10 porque:

- os passos ainda nao executam comandos automaticamente
- ainda nao ha smoke test real com audio embutido
- ainda nao ha assistente de instalacao para baixar modelos
- ainda nao ha persistencia de diagnostico historico

## Proximos passos recomendados

1. Adicionar smoke test real de audio curto no Faster-Whisper command
2. Criar validacao estrutural mais rigorosa para payloads de materiais do Ollama
3. Adicionar um modo "Aplicar configuracao offline" que selecione Faster-Whisper, Ollama e web search off de uma vez
4. Preparar comandos documentados para Windows pensando no futuro launcher desktop
