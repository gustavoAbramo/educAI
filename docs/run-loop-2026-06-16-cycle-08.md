# Run Loop - 2026-06-16 - Cycle 08

## Objetivo do ciclo

Fortalecer a operacao local do educ-AI com diagnosticos mais confiaveis para Ollama e Faster-Whisper, preparando a plataforma para uso offline/local-first e para o futuro executavel desktop.

## Foco

- diferenciar provider apenas conectado de provider realmente pronto
- transformar status tecnico em checklist operacional
- validar geracao JSON simples no Ollama
- explicar prontidao real do Faster-Whisper por endpoint, backend, comando, modelo e transcricao
- manter compatibilidade com os providers em nuvem e com a arquitetura existente

## Diagnostico inicial

A base local ja existia:

- Ollama ja atendia geracao de materiais, chat e assistente
- Faster-Whisper ja passava por worker HTTP
- configuracoes ja permitiam selecionar providers
- a API ja tinha endpoints de status

O limite estava na qualidade do diagnostico: a tela dizia se o endpoint respondia e se o modelo existia, mas ainda nao mostrava bem se o provider estava operacional para o tipo de trabalho que o produto precisa.

## Implementacoes realizadas

### 1. Checklist operacional por provider

- `src/lib/voice-intelligence.ts`
- `src/server/ollama-provider.ts`
- `src/server/faster-whisper-provider.ts`

Foi criado o tipo `ProviderRuntimeCheck`, usado pelos status locais.

Cada check traz:

- `id`
- `label`
- `status`: `pass`, `warn` ou `fail`
- `detail`

### 2. Diagnostico mais forte do Ollama

- `src/server/ollama-provider.ts`
- `src/server/provider-runtime-health.ts`

O status do Ollama agora valida:

- endpoint local
- modelo ativo na lista do Ollama
- geracao JSON simples
- latencia aproximada do diagnostico

Tambem foi adicionado:

- `jsonGenerationReady`
- `latencyMs`
- `checks`

Se o modelo existe, mas falha ao devolver JSON valido, materiais passam a aparecer como capacidade `limited`, porque chat textual ainda pode funcionar, mas geracao estruturada fica arriscada.

### 3. Diagnostico mais claro do Faster-Whisper

- `src/server/faster-whisper-provider.ts`

O status do Faster-Whisper agora explicita:

- endpoint local
- backend real ou mock
- comando local configurado
- modelo ativo
- prontidao para receber transcricao real
- latencia aproximada do diagnostico

Tambem foi adicionado:

- `smokeTranscriptionReady`
- `latencyMs`
- `checks`

### 4. UI de configuracoes mais operacional

- `src/routes/configuracoes.tsx`

A tela de configuracoes agora mostra o checklist operacional para:

- runtime local do Faster-Whisper
- runtime local do Ollama

Isso permite diagnosticar rapidamente se o problema esta em endpoint, modelo, JSON, backend, comando ou transcricao.

### 5. Testes atualizados

- `src/server/voice-api.integration.test.ts`

Os testes agora validam:

- status do Ollama com `jsonGenerationReady`
- checklist presente no payload
- status consolidado do runtime local
- `smokeTranscriptionReady` no Faster-Whisper quando backend, comando e modelo estao prontos

## Arquivos alterados

- `docs/run-loop-2026-06-16-cycle-08.md`
- `src/lib/voice-intelligence.ts`
- `src/routes/configuracoes.tsx`
- `src/server/faster-whisper-provider.ts`
- `src/server/ollama-provider.ts`
- `src/server/provider-runtime-health.ts`
- `src/server/voice-api.integration.test.ts`

## Testes executados

- `node --import tsx --test src/server/provider-http.test.ts src/server/provider-endpoint.test.ts src/server/voice-api.integration.test.ts`
- `node --import tsx --test workers/faster-whisper-local/server.test.ts workers/faster-whisper-local/command-bridge.test.ts`
- `npm run build`

## Resultado

- Testes de provider/API passaram.
- Testes do worker e bridge Faster-Whisper passaram.
- Build de client e SSR passou.

## O que melhorou

- O usuario agora consegue entender por que a stack local nao esta pronta.
- Ollama deixa de ser validado apenas por lista de modelos e passa a validar geracao estruturada.
- Faster-Whisper deixa de ser apenas "online/offline" e passa a expor o que falta para transcricao real.
- A base fica mais preparada para instalador, launcher e modo offline.

## Nota do ciclo

## 9.5 / 10

### Justificativa

Este ciclo nao adicionou um provider novo, mas aumentou bastante a confianca operacional dos providers locais ja existentes. Isso e importante porque IA local costuma falhar por detalhe de runtime, modelo, endpoint ou formato de resposta, e agora o produto sabe explicar melhor esses estados.

A nota ainda nao chega a 10 porque:

- o smoke de Faster-Whisper ainda indica prontidao estrutural, nao executa um audio de teste embutido
- ainda falta instalador local guiado
- ainda falta uma experiencia de setup assistido para baixar modelo e iniciar runtime

## Proximos passos recomendados

1. Criar um guia executavel de setup local no app
2. Adicionar um teste real de audio curto no worker Faster-Whisper quando houver backend command configurado
3. Implementar retry e reparo de JSON para materiais com Ollama
4. Criar modo offline explicito combinando Ollama, Faster-Whisper e busca web desligada
