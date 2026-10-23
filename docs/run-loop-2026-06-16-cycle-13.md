# Run Loop - 2026-06-16 - Cycle 13

## Objetivo do ciclo

Tornar o guia de setup local mais acionavel adicionando comandos sugeridos para Windows/runtime local.

## Foco

- aproximar o painel de um futuro launcher desktop
- evitar instrucoes vagas
- mostrar comandos apenas quando forem uteis
- validar o contrato da API e o build

## Diagnostico inicial

O ciclo 10 criou um guia de setup com passos claros. Ainda faltava uma camada pratica: comandos sugeridos para executar ou adaptar.

Sem comandos, o usuario entende o que falta, mas ainda precisa lembrar como subir worker, Ollama ou baixar modelo.

## Implementacoes realizadas

### 1. Comando opcional no passo de setup

- `src/lib/voice-intelligence.ts`

`ProviderSetupStep` agora aceita:

- `command?: string`

### 2. Comandos sugeridos no backend

- `src/server/provider-runtime-health.ts`

O guia agora pode retornar comandos como:

- `npm.cmd run dev:faster-whisper-worker`
- comando PowerShell para iniciar Faster-Whisper worker em modo `command`
- `ollama serve`
- `ollama pull <modelo>`
- `$env:EDUCAI_ASSISTANT_WEB_SEARCH="off"`

### 3. UI para exibir comandos

- `src/routes/configuracoes.tsx`

Quando um passo possui comando, a tela mostra um bloco monoespacado dentro do card do passo.

### 4. Teste de contrato

- `src/server/voice-api.integration.test.ts`

O teste de runtime health agora valida que:

- o passo de worker Faster-Whisper possui comando com `dev:faster-whisper-worker`
- o passo de baixar modelo Ollama inclui o modelo configurado

## Arquivos alterados

- `docs/run-loop-2026-06-16-cycle-13.md`
- `src/lib/voice-intelligence.ts`
- `src/routes/configuracoes.tsx`
- `src/server/provider-runtime-health.ts`
- `src/server/voice-api.integration.test.ts`

## Testes executados

- `node --import tsx --test src/server/provider-http.test.ts src/server/provider-endpoint.test.ts src/server/voice-api.integration.test.ts`
- `npm run build`

## Resultado

- O guia local ficou mais pratico.
- O painel passou a mostrar comandos acionaveis.
- A API agora carrega informacao que pode ser reaproveitada por launcher/desktop no futuro.

## Nota do ciclo

## 8.9 / 10

### Justificativa

O ciclo e simples, mas move a experiencia de diagnostico para execucao orientada. Ainda nao executa comandos pelo app, o que e correto por enquanto por seguranca e porque ainda nao temos launcher desktop.

## Proximos passos recomendados

1. Adicionar botao de copiar comando
2. Criar smoke test real de audio no Faster-Whisper command
3. Criar wizard local com etapas executaveis quando estivermos no desktop launcher
4. Persistir historico de diagnosticos locais
