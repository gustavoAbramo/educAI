# Run Loop - 2026-06-16 - Cycle 15

## Objetivo do ciclo

Fortalecer a prontidao do Faster-Whisper local adicionando um smoke test real do pipeline `command`.

## Foco

- validar que o worker consegue chamar `FASTER_WHISPER_COMMAND`
- diferenciar configuracao estrutural de pipeline realmente executavel
- bloquear status `ready` quando o smoke falhar
- manter estados honestos para modo mock e worker incompleto
- preparar base para futuro launcher desktop

## Diagnostico inicial

Antes deste ciclo, o status `smokeTranscriptionReady` era estrutural:

- backend em `command`
- comando configurado
- modelo listado

Isso era melhor do que um simples ping, mas ainda nao garantia que o comando local realmente executava.

## Implementacoes realizadas

### 1. Endpoint `/smoke-test` no worker local

- `workers/faster-whisper-local/server.ts`

Foi adicionado `POST /smoke-test`.

O endpoint:

- exige `FASTER_WHISPER_WORKER_BACKEND=command`
- exige `FASTER_WHISPER_COMMAND`
- gera um pequeno WAV tecnico local
- chama o mesmo pipeline usado por `/transcribe`
- valida que o comando retorna texto
- devolve `ok`, `textPreview`, `segmentsCount`, `latencyMs` e `checkedAt`

Observacao importante: este smoke valida o encanamento do runtime local. Ele nao mede precisao de reconhecimento de fala, porque o WAV embutido e tecnico e curto.

### 2. Status do provider usa o smoke

- `src/server/faster-whisper-provider.ts`

O backend agora chama `/smoke-test` quando:

- worker esta em `command`
- comando esta configurado
- modelo ativo existe

O provider so fica `ready` quando o smoke passa.

Se o smoke falhar, o status fica `misconfigured` e a mensagem explica a falha.

### 3. Checklist mais honesto

- `src/server/faster-whisper-provider.ts`

O check `smoke_transcription` agora pode:

- passar quando o pipeline command executou
- falhar quando o smoke foi tentado e falhou
- ficar em aviso quando ainda nao ha pre-requisitos para rodar o smoke

### 4. Testes do worker

- `workers/faster-whisper-local/server.test.ts`

Foi adicionado teste que valida:

- `/smoke-test` retorna `409` em modo mock
- `/smoke-test` executa um comando local em modo command
- payload traz `ok`, preview, segmentos e latencia

### 5. Testes de integracao atualizados

- `src/server/voice-api.integration.test.ts`

Os mocks do worker command agora respondem tambem ao `/smoke-test`, garantindo que os testes reflitam o contrato novo.

### 6. Documentacao do worker

- `workers/faster-whisper-local/README.md`

O endpoint `/smoke-test` foi documentado.

## Arquivos alterados

- `docs/run-loop-2026-06-16-cycle-15.md`
- `src/server/faster-whisper-provider.ts`
- `src/server/voice-api.integration.test.ts`
- `workers/faster-whisper-local/README.md`
- `workers/faster-whisper-local/server.test.ts`
- `workers/faster-whisper-local/server.ts`

## Testes executados

- `node --import tsx --test workers/faster-whisper-local/server.test.ts workers/faster-whisper-local/command-bridge.test.ts`
- `node --import tsx --test src/server/provider-http.test.ts src/server/provider-endpoint.test.ts src/server/voice-api.integration.test.ts`
- `npm run build`

## Resultado

- Faster-Whisper local agora tem smoke test operacional.
- O status `ready` ficou mais confiavel.
- O sistema evita liberar transcricao real quando o comando local ainda nao executa.

## Nota do ciclo

## 9.4 / 10

### Justificativa

Este ciclo melhora bastante a confianca operacional da transcricao local. Ainda nao mede precisao real de ASR com fala humana embutida, mas valida o caminho mais importante para desktop: worker -> comando -> resposta.

## Proximos passos recomendados

1. Mostrar no painel o detalhe do smoke test e latencia de forma mais explicita
2. Adicionar historico de diagnosticos locais
3. Criar um adaptador real para Faster-Whisper Python
4. Preparar o launcher para subir worker e Ollama automaticamente
