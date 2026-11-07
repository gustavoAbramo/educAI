# educAI API V1 Contract (Frozen)

Este documento trava o contrato obrigatorio da V1 para integracao entre:

- executavel educAI
- API central
- plataforma web

Base URL local:

```text
http://localhost:5173/api/v1
```

## Enums obrigatorios

### SessionType

- CLASS
- MENTORING
- MEETING
- TRAINING
- WORKSHOP
- CONSULTING
- SALES_CALL
- PRESENTATION
- OTHER

### SessionStatus

- CREATED
- RECORDING
- UPLOADING_AUDIO
- AUDIO_UPLOADED
- TRANSCRIBING
- TRANSCRIBED
- GENERATING_MATERIALS
- READY
- FAILED
- CANCELED

### MaterialType

- SUMMARY
- TOPICS
- MIND_MAP
- INSIGHTS
- ACTION_ITEMS
- QUESTIONS
- FLASHCARDS
- QUIZ
- STUDY_PLAN

### MaterialStatus

- PENDING
- GENERATING
- COMPLETED
- EDITED
- FAILED

### TranscriptStatus

- PENDING
- TRANSCRIBING
- COMPLETED
- EDITED
- FAILED

### MessageRole

- USER
- ASSISTANT
- SYSTEM

### AudioSource

- DESKTOP
- WEB
- BOT
- UPLOAD

### OutputFormat

- TEXT
- MARKDOWN
- JSON

## Modelos minimos obrigatorios

### Session

Campos obrigatorios:

- id
- title
- type
- language
- status
- createdAt
- updatedAt

Campos opcionais:

- externalId
- participants
- metadata
- summaryTemplate
- startedAt
- completedAt
- failureReason

### Audio

Campos obrigatorios:

- id
- sessionId
- fileName
- mimeType
- sizeBytes
- source
- status
- createdAt

Campos opcionais:

- durationSeconds
- storage
- metadata
- updatedAt

### Transcript

Campos obrigatorios:

- id
- sessionId
- language
- status
- text
- segments
- createdAt
- updatedAt

Campos opcionais:

- format
- provider

### Material

Campos obrigatorios:

- id
- sessionId
- type
- title
- content
- format
- status
- createdAt
- updatedAt

### ChatMessage

Campos obrigatorios:

- id
- sessionId
- role
- content
- createdAt

### Status

Campos obrigatorios:

- sessionId
- status
- currentStep
- progress
- error
- updatedAt

## Padrao de erro

Todos os erros retornam:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem clara para o usuario/desenvolvedor.",
    "details": "Detalhes tecnicos opcionais.",
    "timestamp": "ISO_DATE",
    "path": "/api/v1/..."
  }
}
```

Codigos minimos da V1:

- SESSION_NOT_FOUND
- AUDIO_NOT_FOUND
- AUDIO_UPLOAD_FAILED
- AUDIO_UPLOAD_TOO_LARGE
- TRANSCRIPTION_FAILED
- MATERIAL_GENERATION_FAILED
- CHAT_FAILED
- INVALID_REQUEST
- UNAUTHORIZED
- INTERNAL_ERROR

## Endpoints V1 obrigatorios

## Sessions

### POST /api/v1/sessions

Objetivo: criar uma sessao.

Request body:

```json
{
  "title": "Aula de Revolucao Industrial",
  "type": "CLASS",
  "language": "pt-BR",
  "externalId": "lesson_123",
  "participants": [{ "name": "Professor" }],
  "metadata": { "workspaceId": "school_01" }
}
```

Obrigatorios:

- title
- type
- language

Opcionais:

- externalId
- participants
- metadata
- summaryTemplate

Status possiveis:

- 201 Created
- 400 Bad Request

Exemplo response 201:

```json
{
  "data": {
    "id": "ses_123",
    "title": "Aula de Revolucao Industrial",
    "type": "CLASS",
    "language": "pt-BR",
    "status": "CREATED",
    "createdAt": "2026-05-28T16:10:00.000Z",
    "updatedAt": "2026-05-28T16:10:00.000Z"
  }
}
```

### GET /api/v1/sessions

Objetivo: listar sessoes.

Request body: nao aplicavel.

Status possiveis:

- 200 OK

Exemplo response 200:

```json
{
  "data": [
    {
      "id": "ses_123",
      "title": "Aula de Revolucao Industrial",
      "type": "CLASS",
      "language": "pt-BR",
      "status": "READY",
      "createdAt": "2026-05-28T16:10:00.000Z",
      "updatedAt": "2026-05-28T16:18:00.000Z",
      "audioCount": 1,
      "hasTranscript": true,
      "hasMaterials": true
    }
  ]
}
```

### GET /api/v1/sessions/{sessionId}

Objetivo: obter uma sessao por id.

Status possiveis:

- 200 OK
- 404 Not Found

### GET /api/v1/sessions/{sessionId}/overview

Objetivo: retorno consolidado para dashboards e sincronizacao.

Status possiveis:

- 200 OK
- 404 Not Found

Exemplo response 200:

```json
{
  "data": {
    "session": {
      "id": "ses_123",
      "title": "Aula de Revolucao Industrial",
      "type": "CLASS",
      "language": "pt-BR",
      "status": "READY",
      "createdAt": "2026-05-28T16:10:00.000Z",
      "updatedAt": "2026-05-28T16:18:00.000Z"
    },
    "status": {
      "sessionId": "ses_123",
      "status": "READY",
      "currentStep": "ready",
      "progress": 100,
      "error": null,
      "updatedAt": "2026-05-28T16:18:00.000Z"
    },
    "audioCount": 1,
    "transcriptId": "trn_123",
    "materialsCount": 6,
    "chatMessages": 2,
    "updatedAt": "2026-05-28T16:18:00.000Z"
  }
}
```

## Audio

### POST /api/v1/sessions/{sessionId}/audio

Objetivo: enviar arquivo de audio para a sessao.

Request body:

- Multipart com campo `file` e campo `source`.

Exemplo cURL:

```bash
curl -X POST "http://localhost:5173/api/v1/sessions/{sessionId}/audio" \
  -F "file=@call.webm" \
  -F "source=UPLOAD" \
  -F "durationSeconds=360"
```

Obrigatorios:

- file
- source

Opcionais:

- durationSeconds
- metadata

Status possiveis:

- 201 Created
- 400 Bad Request
- 404 Not Found
- 500 Internal Server Error

### GET /api/v1/sessions/{sessionId}/audio

Objetivo: listar audios anexados a sessao.

Status possiveis:

- 200 OK
- 404 Not Found

## Status

### GET /api/v1/sessions/{sessionId}/status

Objetivo: consultar estado de processamento da sessao.

Status possiveis:

- 200 OK
- 404 Not Found

### PATCH /api/v1/sessions/{sessionId}/status

Objetivo: atualizar status manualmente (orquestracao externa).

Request body:

```json
{
  "status": "TRANSCRIBING",
  "currentStep": "queue_worker",
  "progress": 45,
  "error": null
}
```

Obrigatorios:

- status (enum valido)

Opcionais:

- currentStep
- progress
- error

Status possiveis:

- 200 OK
- 400 Bad Request
- 404 Not Found

## Transcript

### POST /api/v1/sessions/{sessionId}/transcribe

Objetivo: iniciar transcricao da sessao.

Pre-condicao:

- existir audio na sessao.

Status possiveis:

- 201 Created
- 404 Not Found
- 500 Internal Server Error

### GET /api/v1/sessions/{sessionId}/transcript

Objetivo: obter transcript atual.

Status possiveis:

- 200 OK
- 404 Not Found

### PATCH /api/v1/sessions/{sessionId}/transcript

Objetivo: editar transcript manualmente.

Request body:

```json
{
  "text": "Texto revisado",
  "segments": [
    {
      "id": "seg_1",
      "speaker": "Professor",
      "startMs": 0,
      "endMs": 1200,
      "text": "Texto revisado"
    }
  ],
  "status": "EDITED",
  "format": "TEXT"
}
```

Obrigatorios:

- text
- segments
- status
- format

Status possiveis:

- 200 OK
- 400 Bad Request
- 404 Not Found

## Materials

### POST /api/v1/sessions/{sessionId}/materials/generate

Objetivo: gerar materiais a partir do transcript.

Pre-condicao:

- existir transcript na sessao.

Status possiveis:

- 201 Created
- 400 Bad Request
- 404 Not Found
- 500 Internal Server Error

### GET /api/v1/sessions/{sessionId}/materials

Objetivo: listar materiais da sessao.

Status possiveis:

- 200 OK
- 404 Not Found

### GET /api/v1/sessions/{sessionId}/materials/{materialId}

Objetivo: obter um material especifico.

Status possiveis:

- 200 OK
- 404 Not Found

## Chat

### POST /api/v1/sessions/{sessionId}/chat/messages

Objetivo: enviar mensagem ao chat contextual da sessao.

Request body:

```json
{
  "message": "Quais os proximos passos desta sessao?"
}
```

Obrigatorios:

- message

Status possiveis:

- 201 Created
- 400 Bad Request
- 404 Not Found
- 500 Internal Server Error

Exemplo response 201:

```json
{
  "data": [
    {
      "id": "msg_1",
      "sessionId": "ses_123",
      "role": "USER",
      "content": "Quais os proximos passos desta sessao?",
      "createdAt": "2026-05-28T16:20:00.000Z"
    },
    {
      "id": "msg_2",
      "sessionId": "ses_123",
      "role": "ASSISTANT",
      "content": "...",
      "createdAt": "2026-05-28T16:20:00.200Z"
    }
  ]
}
```

### GET /api/v1/sessions/{sessionId}/chat/messages

Objetivo: listar historico de chat da sessao.

Status possiveis:

- 200 OK
- 404 Not Found

## Validacoes obrigatorias da V1

- session.title obrigatorio
- session.type obrigatorio
- session.language obrigatorio
- audio.file obrigatorio no upload
- audio.source obrigatorio
- transcript so pode ser gerado se existir audio
- materials so podem ser gerados se existir transcript
- chat so deve usar sessionId valido
- chat.message obrigatorio
- status aceita apenas valores validos do enum SessionStatus

---

## Manual Testing (Desenvolvimento e Debug)

### Setup Inicial

1. **Iniciar o servidor de desenvolvimento:**

```bash
npm run dev:api
```

O servidor estará disponível em: `http://localhost:5173/api/v1`

2. **Variáveis de ambiente recomendadas (.env):**

```bash
# Para usar transcricao real do OpenAI (opcional)
OPENAI_API_KEY=sk_test_...
EDUCAI_TRANSCRIPTION_PROVIDER=openai
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe

# Para usar transcricao real do Gemini (opcional)
GEMINI_API_KEY=...
EDUCAI_TRANSCRIPTION_PROVIDER=gemini
GEMINI_TRANSCRIBE_MODEL=gemini-3.6-flash

# Para customizar localizacao de armazenamento (opcional)
EDUCAI_VOICE_STORE_PATH=.data/voice-sessions.json
EDUCAI_RECORDINGS_DIR=.data/recordings
```

### Modos de transcricao

A V1 suporta modos internos de transcricao sem alterar endpoints, campos ou
formatos:

- `EDUCAI_TRANSCRIPTION_PROVIDER=mock`: usa o provider simulado. Este modo e
  restrito a testes automatizados e desenvolvimento com
  `EDUCAI_ENABLE_SIMULATED_PROVIDERS=true`.
- `EDUCAI_TRANSCRIPTION_PROVIDER=openai`: exige `OPENAI_API_KEY` e usa
  transcricao real.
- `EDUCAI_TRANSCRIPTION_PROVIDER=gemini`: exige `GEMINI_API_KEY` e usa
  transcricao real via Gemini.
- `EDUCAI_TRANSCRIPTION_PROVIDER=faster-whisper`: usa o worker local HTTP para
  transcricao real sem API externa.

Se `EDUCAI_TRANSCRIPTION_PROVIDER` nao for definido:

- com `OPENAI_API_KEY`, a API usa OpenAI automaticamente;
- sem `OPENAI_API_KEY`, mas com `GEMINI_API_KEY`, a API usa Gemini
  automaticamente;
- sem chaves reais, a API passa a preferir `faster-whisper`.

Em modo real (`openai` ou `gemini`), se a chave exigida nao existir, `POST
/api/v1/sessions/{sessionId}/transcribe` retorna erro claro de transcricao
indisponivel com codigo `TRANSCRIPTION_FAILED`. A API nao usa texto mockado como
se fosse transcricao real.

Se nenhum provider real estiver configurado ou acessivel, a API falha de forma
honesta com erro explicito. O sistema nao fabrica transcricoes ou materiais como
se fossem resultados oficiais.

Se `faster-whisper` estiver selecionado, mas o worker responder em
`backend=mock`, `backend=command` sem comando real, ou sem o modelo configurado,
`POST /api/v1/sessions/{sessionId}/transcribe` retorna erro explicito em vez de
aceitar transcricao simulada como resultado oficial.

Para testar Gemini localmente no PowerShell:

```powershell
$env:EDUCAI_TRANSCRIPTION_PROVIDER = "gemini"
$env:GEMINI_API_KEY = "sua-chave-local"
$env:GEMINI_TRANSCRIBE_MODEL = "gemini-3.6-flash"
npm.cmd run dev:api
```

Depois rode o fluxo normal: criar sessao, enviar audio e chamar `POST
/api/v1/sessions/{sessionId}/transcribe`.

### Workflow Completo com cURL

Abaixo está um fluxo passo-a-passo para testar a integração completa:

#### 1. Criar uma sessão

```bash
curl -X POST "http://localhost:5173/api/v1/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Aula de Revolução Industrial",
    "type": "CLASS",
    "language": "pt-BR",
    "externalId": "lesson_001",
    "participants": [{"name": "Professor Silva"}],
    "metadata": {"schoolId": "school_001"}
  }'
```

**Esperado (201 Created):**

```json
{
  "data": {
    "id": "ses_1234567890",
    "title": "Aula de Revolução Industrial",
    "type": "CLASS",
    "language": "pt-BR",
    "status": "CREATED",
    "createdAt": "2026-05-29T10:00:00.000Z",
    "updatedAt": "2026-05-29T10:00:00.000Z"
  }
}
```

**Salve o `id` para uso nos próximos passos:** `SESSION_ID=ses_1234567890`

#### 2. Enviar arquivo de áudio

Prepare um arquivo de áudio em formato webm/m4a/wav ou simillar.

**Opção A: Com arquivo real (recomendado)**

```bash
curl -X POST "http://localhost:5173/api/v1/sessions/{SESSION_ID}/audio" \
  -F "file=@/path/to/audio.webm" \
  -F "source=UPLOAD" \
  -F "durationSeconds=300"
```

**Opção B: Teste sem arquivo (para debugging)**

```bash
# Crie um arquivo de teste
echo "test audio data" > test_audio.bin

curl -X POST "http://localhost:5173/api/v1/sessions/{SESSION_ID}/audio" \
  -F "file=@test_audio.bin" \
  -F "source=UPLOAD" \
  -F "durationSeconds=180"
```

**Esperado (201 Created):**

```json
{
  "data": {
    "id": "aud_xyz123",
    "sessionId": "{SESSION_ID}",
    "fileName": "audio.webm",
    "mimeType": "audio/webm",
    "sizeBytes": 12345,
    "source": "UPLOAD",
    "status": "PROCESSING",
    "createdAt": "2026-05-29T10:00:10.000Z",
    "durationSeconds": 300
  }
}
```

#### 3. Consultar status de processamento

```bash
curl -X GET "http://localhost:5173/api/v1/sessions/{SESSION_ID}/status"
```

**Esperado (200 OK):**

```json
{
  "data": {
    "sessionId": "{SESSION_ID}",
    "status": "AUDIO_UPLOADED",
    "currentStep": "ready_for_transcription",
    "progress": 25,
    "error": null,
    "updatedAt": "2026-05-29T10:00:15.000Z"
  }
}
```

#### 4. Iniciar transcrição

```bash
curl -X POST "http://localhost:5173/api/v1/sessions/{SESSION_ID}/transcribe" \
  -H "Content-Type: application/json"
```

**Esperado (201 Created):**

```json
{
  "data": {
    "id": "trn_abc789",
    "sessionId": "{SESSION_ID}",
    "status": "COMPLETED",
    "text": "Transcrição simulada do áudio...",
    "language": "pt-BR",
    "segments": [
      {
        "id": "seg_1",
        "speaker": "Unknown",
        "startMs": 0,
        "endMs": 5000,
        "text": "Segmento 1 da transcrição"
      }
    ],
    "createdAt": "2026-05-29T10:00:20.000Z",
    "updatedAt": "2026-05-29T10:00:20.000Z"
  }
}
```

#### 5. Gerar materiais educacionais

```bash
curl -X POST "http://localhost:5173/api/v1/sessions/{SESSION_ID}/materials/generate" \
  -H "Content-Type: application/json"
```

**Esperado (201 Created):**

```json
{
  "data": [
    {
      "id": "mat_1",
      "sessionId": "{SESSION_ID}",
      "type": "SUMMARY",
      "title": "Resumo",
      "content": "Resumo gerado do áudio...",
      "format": "MARKDOWN",
      "status": "COMPLETED",
      "createdAt": "2026-05-29T10:00:25.000Z",
      "updatedAt": "2026-05-29T10:00:25.000Z"
    },
    {
      "id": "mat_2",
      "sessionId": "{SESSION_ID}",
      "type": "TOPICS",
      "title": "Tópicos Principais",
      "content": "- Tópico 1\n- Tópico 2\n- Tópico 3",
      "format": "MARKDOWN",
      "status": "COMPLETED",
      "createdAt": "2026-05-29T10:00:25.000Z",
      "updatedAt": "2026-05-29T10:00:25.000Z"
    }
    // ... mais 4 materiais (INSIGHTS, ACTION_ITEMS, QUESTIONS, MIND_MAP)
  ]
}
```

#### 6. Enviar mensagem de chat

```bash
curl -X POST "http://localhost:5173/api/v1/sessions/{SESSION_ID}/chat/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quais são os próximos passos recomendados?"
  }'
```

**Esperado (201 Created):**

```json
{
  "data": [
    {
      "id": "msg_1",
      "sessionId": "{SESSION_ID}",
      "role": "USER",
      "content": "Quais são os próximos passos recomendados?",
      "createdAt": "2026-05-29T10:00:30.000Z"
    },
    {
      "id": "msg_2",
      "sessionId": "{SESSION_ID}",
      "role": "ASSISTANT",
      "content": "Com base na aula registrada, recomendo revisar os tópicos principais...",
      "createdAt": "2026-05-29T10:00:30.200Z"
    }
  ]
}
```

#### 7. Obter visão consolidada (dashboard)

```bash
curl -X GET "http://localhost:5173/api/v1/sessions/{SESSION_ID}/overview"
```

**Esperado (200 OK):**

```json
{
  "data": {
    "session": {
      "id": "{SESSION_ID}",
      "title": "Aula de Revolução Industrial",
      "type": "CLASS",
      "language": "pt-BR",
      "status": "READY",
      "createdAt": "2026-05-29T10:00:00.000Z",
      "updatedAt": "2026-05-29T10:00:30.000Z"
    },
    "status": {
      "sessionId": "{SESSION_ID}",
      "status": "READY",
      "currentStep": "complete",
      "progress": 100,
      "error": null,
      "updatedAt": "2026-05-29T10:00:30.000Z"
    },
    "audioCount": 1,
    "transcriptId": "trn_abc789",
    "materialsCount": 6,
    "chatMessages": 2,
    "updatedAt": "2026-05-29T10:00:30.000Z"
  }
}
```

### Testes Rápidos por Endpoint

#### Listar todas as sessões

```bash
curl -X GET "http://localhost:5173/api/v1/sessions"
```

#### Obter uma sessão específica

```bash
curl -X GET "http://localhost:5173/api/v1/sessions/{SESSION_ID}"
```

#### Listar áudios de uma sessão

```bash
curl -X GET "http://localhost:5173/api/v1/sessions/{SESSION_ID}/audio"
```

#### Obter transcript

```bash
curl -X GET "http://localhost:5173/api/v1/sessions/{SESSION_ID}/transcript"
```

#### Listar materiais

```bash
curl -X GET "http://localhost:5173/api/v1/sessions/{SESSION_ID}/materials"
```

#### Listar mensagens de chat

```bash
curl -X GET "http://localhost:5173/api/v1/sessions/{SESSION_ID}/chat/messages"
```

#### Editar transcript (revisão manual)

```bash
curl -X PATCH "http://localhost:5173/api/v1/sessions/{SESSION_ID}/transcript" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Transcrição revisada",
    "segments": [
      {
        "id": "seg_1",
        "speaker": "Professor",
        "startMs": 0,
        "endMs": 5000,
        "text": "Transcrição revisada"
      }
    ],
    "status": "EDITED",
    "format": "MARKDOWN"
  }'
```

#### Atualizar status de processamento

```bash
curl -X PATCH "http://localhost:5173/api/v1/sessions/{SESSION_ID}/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "TRANSCRIBING",
    "currentStep": "external_processor",
    "progress": 50,
    "error": null
  }'
```

### Debugging

#### Verificar respostas de erro

Todos os erros seguem o padrão:

```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session with id 'invalid_id' not found",
    "details": "Additional technical context if available",
    "timestamp": "2026-05-29T10:00:00.000Z",
    "path": "/api/v1/sessions/invalid_id"
  }
}
```

#### Ver logs no terminal

O servidor de desenvolvimento exibirá logs de requisição:

```
POST /api/v1/sessions 201 5ms
POST /api/v1/sessions/ses_1234567890/audio 201 15ms
POST /api/v1/sessions/ses_1234567890/transcribe 201 200ms
```

#### Resetar dados locais

Se precisar começar do zero, limpe os arquivos de estado:

```bash
rm -rf .data/voice-sessions.json .data/recordings/*
```

### Ferramentas Recomendadas

- **cURL**: Exemplos nesta seção
- **Postman**: Importe os exemplos e save como collection
- **Insomnia**: Melhor UX para multipart uploads
- **HTTPie**: Alternativa moderna ao cURL

Exemplo com HTTPie:

```bash
http POST http://localhost:5173/api/v1/sessions \
  title="Aula de Revolução Industrial" \
  type=CLASS \
  language=pt-BR
```
