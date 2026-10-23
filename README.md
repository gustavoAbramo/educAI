# educAI

Aplicação com IA para gravar ou receber áudio de aulas, reuniões e mentorias,
transcrever, gerar materiais (resumo, tópicos, relatório, mapa mental, perguntas,
ações) e conversar com a IA sobre a sessão.

Este guia mostra como rodar o projeto do zero, a partir do clone no GitHub.

## 1. Pré-requisitos

| Ferramenta | Versão | Para quê |
| --- | --- | --- |
| [Git](https://git-scm.com/downloads) | qualquer recente | clonar o repositório |
| [Node.js](https://nodejs.org/) | 22 LTS (mínimo 20.19) | rodar o app e os testes |
| npm | vem com o Node | instalar dependências |
| Chrome ou Edge | recente | gravação, prévia ao vivo e captura de áudio de aba |
| [Ollama](https://ollama.com/download) | opcional | gerar materiais e chat com IA local |

Confira as versões:

```powershell
git --version
node -v
npm -v
```

## 2. Clonar o repositório

```powershell
git clone https://github.com/T2AEducacao/educ-AI.git
cd educ-AI
```

Se o Git pedir login, entre com uma conta do GitHub que tenha acesso à
organização `T2AEducacao`.

## 3. Instalar as dependências

```powershell
npm install
```

> No PowerShell, se aparecer erro de política de execução de scripts, use
> `npm.cmd install` (e `npm.cmd run ...` nos demais comandos).

## 4. Escolher o provider de IA

O app precisa de um provider para **transcrição** e outro para **geração**
(materiais, chat e assistente). Não existe arquivo `.env` no projeto: a
configuração é feita por variáveis de ambiente no terminal ou pela tela
**Configurações** do próprio app.

Sem nenhuma configuração, a escolha é automática:

1. com `OPENAI_API_KEY` → usa OpenAI;
2. sem OpenAI, mas com `GEMINI_API_KEY` → usa Gemini;
3. sem nenhuma chave → usa Faster-Whisper (transcrição) e Ollama (geração), ambos locais.

Escolha **uma** das opções abaixo.

### Opção A — Gemini ou OpenAI (mais simples para uso real)

Defina a chave no mesmo terminal em que vai subir o app:

```powershell
# Gemini
$env:GEMINI_API_KEY = "sua-chave"

# ou OpenAI
$env:OPENAI_API_KEY = "sk-..."
```

As variáveis `$env:` valem só para aquela janela do terminal. Como alternativa,
suba o app sem chave e cadastre-a em **Configurações**; ela fica salva
criptografada na pasta `.data/`.

### Opção B — Modo simulado (só para conhecer as telas)

Não precisa de chave nem de IA instalada. Transcrição e materiais são textos de
exemplo.

```powershell
$env:EDUCAI_ENABLE_SIMULATED_PROVIDERS = "true"
$env:EDUCAI_TRANSCRIPTION_PROVIDER = "mock"
$env:EDUCAI_AI_PROVIDER = "mock"
```

### Opção C — Tudo local (Ollama + Faster-Whisper)

**Geração com Ollama**

1. Instale o Ollama e deixe-o rodando (`http://localhost:11434`).
2. Baixe o modelo padrão do projeto:

   ```powershell
   ollama pull qwen3:8b
   ```

   Para usar outro modelo, defina `OLLAMA_MODEL` ou troque em **Configurações**.

**Transcrição com Faster-Whisper**

O repositório traz apenas o worker HTTP que faz a ponte (`workers/faster-whisper-local`).
Em um segundo terminal:

```powershell
npm run dev:faster-whisper-worker
```

Ele sobe em `http://127.0.0.1:8765`. Por padrão o worker roda em modo `mock`, e
o app **recusa** transcrição simulada como resultado oficial. Para transcrição
local de verdade é preciso ter um serviço Faster-Whisper próprio rodando e
apontar o worker para ele antes de iniciá-lo:

```powershell
$env:FASTER_WHISPER_WORKER_BACKEND = "command"
$env:FASTER_WHISPER_COMMAND = "node --import tsx workers/faster-whisper-local/command-bridge.ts"
$env:FASTER_WHISPER_BRIDGE_BACKEND = "http"
$env:FASTER_WHISPER_BRIDGE_TRANSCRIBE_URL = "http://127.0.0.1:9000/transcribe"
npm run dev:faster-whisper-worker
```

Detalhes do contrato e da diarização em
[`workers/faster-whisper-local/README.md`](workers/faster-whisper-local/README.md).

## 5. Subir o app

```powershell
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente `http://localhost:5173`).
Se a porta estiver ocupada, o Vite escolhe outra e mostra qual.

Frontend e API sobem juntos no mesmo processo; a API fica em `/api/v1` no mesmo
host e porta.

## 6. Conferir se está funcionando

1. Abra **Configurações** e veja o status dos providers (transcrição, materiais,
   chat e assistente).
2. Vá em **Nova aula**, crie uma sessão e permita o microfone.
3. Grave alguns segundos e finalize.
4. Aguarde a tela de processamento chegar ao resultado, com transcrição e
   materiais.

Para gravar reuniões do Meet/Teams, siga
[`docs/meeting-audio-checklist.md`](docs/meeting-audio-checklist.md).

## 7. Comandos úteis

| Comando | O que faz |
| --- | --- |
| `npm run dev` | sobe app + API em modo desenvolvimento |
| `npm run dev:faster-whisper-worker` | sobe o worker local de transcrição |
| `npm test` | roda todos os testes |
| `npm run test:api` | roda só o teste de integração da API V1 |
| `npm run build` | gera o build de produção |
| `npm run preview` | serve o build gerado |
| `npm run lint` | roda o ESLint |
| `npm run format` | formata o código com Prettier |
| `node_modules\.bin\tsc.cmd --noEmit` | valida os tipos TypeScript |

## 8. Variáveis de ambiente

Todas são opcionais.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | chave da OpenAI |
| `GEMINI_API_KEY` | — | chave do Gemini |
| `EDUCAI_TRANSCRIPTION_PROVIDER` | automático | `mock`, `openai`, `gemini` ou `faster-whisper` |
| `EDUCAI_AI_PROVIDER` | automático | `mock`, `openai`, `gemini` ou `ollama` |
| `EDUCAI_ENABLE_SIMULATED_PROVIDERS` | `false` | libera os providers `mock` |
| `EDUCAI_DEBUG_PROVIDERS` | `false` | loga no terminal qual provider foi escolhido |
| `EDUCAI_ASSISTANT_WEB_SEARCH` | `auto` | `auto`, `on` ou `off` |
| `OPENAI_TRANSCRIBE_MODEL` / `OPENAI_INSIGHTS_MODEL` | — | modelos da OpenAI |
| `GEMINI_TRANSCRIBE_MODEL` / `GEMINI_INSIGHTS_MODEL` | — | modelos do Gemini |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | endereço do Ollama |
| `OLLAMA_MODEL` | `qwen3:8b` | modelo do Ollama |
| `FASTER_WHISPER_BASE_URL` | `http://localhost:8765` | endereço do worker de transcrição |
| `FASTER_WHISPER_MODEL` | `small` | modelo do Faster-Whisper |
| `EDUCAI_PROVIDER_TIMEOUT_MS` | — | timeout das chamadas aos providers |
| `EDUCAI_MAX_AUDIO_UPLOAD_BYTES` | 500 MiB | tamanho máximo de upload de áudio |
| `EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS` | `false` | permite Ollama/Faster-Whisper fora da rede local |
| `EDUCAI_PERSISTENCE_PROVIDER` | `local` | `local` ou `supabase` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | — | usados quando a persistência é `supabase` |
| `VITE_EDUCAI_API_BASE_URL` | `/api/v1` | aponta o frontend para outra API |

## 9. Onde os dados ficam

Por padrão tudo é salvo localmente na pasta `.data/`, criada automaticamente na
raiz do projeto e ignorada pelo Git:

- `voice-sessions.json` — sessões, transcrições e materiais;
- `recordings/` — áudios gravados;
- `settings.json` e `provider-settings.json` — configurações feitas pela tela;
- chaves cadastradas pela tela, criptografadas.

Apagar a pasta `.data/` zera o app. Para sincronizar sessões com o Supabase, veja
[`docs/supabase-persistence.md`](docs/supabase-persistence.md).

## 10. Problemas comuns

| Sintoma | Causa provável e solução |
| --- | --- |
| `npm` bloqueado no PowerShell | política de execução; use `npm.cmd` no lugar de `npm` |
| App abre em porta diferente de 5173 | a porta estava ocupada; use a que o terminal mostrou |
| Erro de transcrição indisponível | provider selecionado sem chave, ou worker Faster-Whisper parado/em modo `mock`; confira **Configurações** |
| Materiais ou chat falham com Ollama | Ollama não está rodando ou o modelo não foi baixado (`ollama pull qwen3:8b`) |
| Variável de ambiente "não pegou" | `$env:` só vale na janela onde foi definida; defina e rode `npm run dev` no mesmo terminal |
| Microfone não funciona | permita o microfone no navegador e acesse por `localhost` |
| "Navegador sem captura de aba" | use Chrome ou Edge |

## 11. Documentação complementar

- [`AI_CONTEXT.md`](AI_CONTEXT.md) — contexto e decisões técnicas do projeto
- [`docs/api.md`](docs/api.md) — contrato da API V1 (congelado)
- [`docs/runtime-hardening.md`](docs/runtime-hardening.md) — limites e segurança do runtime
- [`docs/supabase-persistence.md`](docs/supabase-persistence.md) — persistência no Supabase
- [`docs/meeting-audio-checklist.md`](docs/meeting-audio-checklist.md) — captura de reuniões
