# Faster-Whisper Local Worker

Este worker local existe para isolar a transcricao offline do backend principal do educAI.

## Objetivo

- manter o app principal falando apenas HTTP
- preparar a transcricao local para futuro executavel
- permitir trocar a implementacao interna sem mudar o contrato do painel ou da API

## Endpoints

- `GET /health`
- `GET /models`
- `POST /transcribe`
- `POST /diarize`
- `POST /smoke-test`
- `POST /diarize-smoke-test`

O `GET /health` informa se o worker esta em `mock` ou `command`, para que o painel diferencie ambiente simulado de runtime local real.

O `POST /smoke-test` existe para validar o pipeline `command`: o worker gera um pequeno WAV tecnico, chama `FASTER_WHISPER_COMMAND` e confirma que o comando retorna texto. Ele valida o encanamento do runtime local, nao a precisao de reconhecimento de fala.

O `POST /diarize` recebe o audio remoto/sistema junto dos segmentos transcritos e retorna trechos com `speaker_1`, `speaker_2`, etc. Sem comando configurado, responde com fallback simulado; com `FASTER_WHISPER_DIARIZATION_COMMAND`, chama um bridge ou executavel real.

O `POST /diarize-smoke-test` valida se `FASTER_WHISPER_DIARIZATION_COMMAND` executa de verdade e devolve pelo menos um segmento com falante. Use antes de uma reuniao real para confirmar que a separacao de vozes saiu do modo simulado.

## Modos

### `mock`

Modo padrao para desenvolvimento. Nao depende de Python nem de modelo instalado.

### `command`

Modo preparado para futuro executavel ou wrapper real do Faster-Whisper.

Quando `FASTER_WHISPER_WORKER_BACKEND=command`, defina:

- `FASTER_WHISPER_COMMAND`

Opcao recomendada nesta fase:

```bash
FASTER_WHISPER_WORKER_BACKEND=command
FASTER_WHISPER_COMMAND=node --import tsx workers/faster-whisper-local/command-bridge.ts
```

O comando deve receber um arquivo JSON como ultimo argumento e responder no `stdout` um JSON com este formato:

```json
{
  "text": "Transcricao final",
  "language": "pt-BR",
  "segments": [
    {
      "speaker": "Speaker 1",
      "start_ms": 0,
      "end_ms": 1200,
      "text": "Trecho"
    }
  ]
}
```

## Variaveis de ambiente

- `FASTER_WHISPER_HOST`
- `FASTER_WHISPER_PORT`
- `FASTER_WHISPER_MODEL`
- `FASTER_WHISPER_AVAILABLE_MODELS`
- `FASTER_WHISPER_WORKER_BACKEND`
- `FASTER_WHISPER_COMMAND`
- `FASTER_WHISPER_DIARIZATION_COMMAND`
- `FASTER_WHISPER_COMMAND_TIMEOUT_MS`
- `FASTER_WHISPER_MAX_COMMAND_OUTPUT_BYTES`
- `FASTER_WHISPER_MAX_CONCURRENT_JOBS`
- `FASTER_WHISPER_MAX_UPLOAD_BYTES`

O worker usa limites conservadores por padrao, rejeita excesso de concorrencia com HTTP `429` e publica os limites e a quantidade de trabalhos ativos em `GET /health`.

## Bridge CLI

O arquivo `workers/faster-whisper-local/command-bridge.ts` traduz o `request.json` do worker para um backend mais facil de trocar depois.

O arquivo `workers/faster-whisper-local/diarization-bridge.ts` faz o mesmo para diarizacao: recebe `file_path`, `transcript_segments` e `speaker_map`, entao devolve `segments` com `speaker`, `start_ms`, `end_ms` e `confidence`.
O worker tambem aceita saidas comuns de diarizacao com `label`, `speaker_id`, `start` e `end` em segundos, normalizando tudo para milissegundos antes de responder ao app.

Backends do bridge:

- `mock`
- `http`

Variaveis do bridge:

- `FASTER_WHISPER_BRIDGE_BACKEND`
- `FASTER_WHISPER_BRIDGE_TRANSCRIBE_URL`
- `FASTER_WHISPER_BRIDGE_MIME_TYPE`
- `FASTER_WHISPER_BRIDGE_AUTH_HEADER`

Variaveis do bridge de diarizacao:

- `FASTER_WHISPER_DIARIZATION_BRIDGE_BACKEND`
- `FASTER_WHISPER_DIARIZATION_BRIDGE_URL`
- `FASTER_WHISPER_DIARIZATION_BRIDGE_MIME_TYPE`
- `FASTER_WHISPER_DIARIZATION_BRIDGE_AUTH_HEADER`

Exemplo para plugar um servico local real:

```bash
FASTER_WHISPER_WORKER_BACKEND=command
FASTER_WHISPER_COMMAND=node --import tsx workers/faster-whisper-local/command-bridge.ts
FASTER_WHISPER_BRIDGE_BACKEND=http
FASTER_WHISPER_BRIDGE_TRANSCRIBE_URL=http://127.0.0.1:9000/transcribe
```

Exemplo para plugar diarizacao real em outro servico local:

```bash
FASTER_WHISPER_DIARIZATION_COMMAND=node --import tsx workers/faster-whisper-local/diarization-bridge.ts
FASTER_WHISPER_DIARIZATION_BRIDGE_BACKEND=http
FASTER_WHISPER_DIARIZATION_BRIDGE_URL=http://127.0.0.1:9001/diarize
```

## Rodando localmente

```bash
npm run dev:faster-whisper-worker
```

## Teste do worker

```bash
npm run test:faster-whisper-worker
```

## Teste do bridge

```bash
npm run test:faster-whisper-bridge
```
