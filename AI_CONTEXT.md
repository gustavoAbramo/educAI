# educAI - Contexto obrigatorio para agentes de IA

## Visao geral

O educAI e um software executavel com IA, inspirado no Fireflies, mas com mais
funcoes.

Ele nao e limitado a professores. Pode ser usado para:

- aulas;
- mentorias;
- reunioes;
- treinamentos;
- consultorias;
- calls comerciais;
- workshops;
- apresentacoes;
- atendimentos.

A ideia principal e:

```text
gravar ou receber audio
-> enviar para API
-> transcrever
-> gerar materiais
-> permitir chat com IA sobre a sessao
-> exibir no executavel e futuramente na plataforma web
```

## Contrato V1

O contrato da API V1 esta congelado em `docs/api.md`.

Regra obrigatoria:

- Nao alterar endpoints V1.
- Nao alterar enums V1.
- Nao alterar campos obrigatorios/opcionais.
- Nao alterar formatos de resposta.
- Nao alterar padrao de erro.

Fluxo validado da V1:

```text
session -> audio -> status -> transcript -> materials -> chat -> overview
```

Base local:

```text
http://localhost:5173/api/v1
```

Observacao: em desenvolvimento o Vite pode subir em outra porta se a 5173
estiver ocupada. O frontend usa `/api/v1` no mesmo host/porta por padrao, e
tambem aceita `VITE_EDUCAI_API_BASE_URL` para apontar explicitamente para outra
API local.

## Arquitetura atual

Arquivos principais:

- `src/server/voice-api.ts`: roteamento HTTP da API V1.
- `src/server/voice-store.ts`: estado, status e orquestracao da sessao.
- `src/server/voice-pipeline.ts`: pipeline interno de transcricao, materiais e chat.
- `src/server/transcription-provider.ts`: selecao entre providers de transcricao.
- `src/server/openai-provider.ts`: integracao real com OpenAI.
- `src/server/gemini-provider.ts`: integracao real com Gemini.
- `src/server/runtime-env.ts`: leitura de variaveis de ambiente do runtime Node,
  do handler serverless/TanStack e de `import.meta.env`.
- `src/server/local-recordings.ts`: upload e leitura local de audio.
- `src/server/local-persistence.ts`: persistencia local em `.data/voice-sessions.json`.
- `src/server/voice-api.integration.test.ts`: teste de integracao da V1.
- `src/services/*`: cliente frontend para consumir a API V1.
- `src/types/api.ts`: tipos usados pelo frontend.

### Frontend: rotas finas, telas em `src/features`

- `src/routes/*.tsx`: so declaram a rota (caminho, `validateSearch`, `head` com
  titulo da aba) e apontam para o componente da tela. Nao colocar logica aqui.
- `src/features/<tela>/<tela>-page.tsx`: componente da tela. Para ler search
  params ou contexto, use `getRouteApi("/caminho")` em vez de importar `Route`
  (evita import circular).
- `src/features/<tela>/model/*.ts`: tipos e funcoes puras da tela (parsers,
  formatacao, rotulos). `src/features/<tela>/components/*.tsx`: pecas visuais.
- `src/features/auth`: login e cadastro (validacao por campo, forca da senha,
  aviso de Caps Lock, aceite dos termos). A regra de senha fica em
  `src/lib/password-policy.ts` e e a mesma no servidor (`src/server/auth.ts`).
- `src/features/accessibility`: tela de Acessibilidade, menu rapido flutuante
  (Alt + Shift + A), guia de leitura, VLibras (Libras) e anunciador de troca de
  tela para leitores de tela. As preferencias ficam em `src/lib/accessibility.ts`.
- `src/features/system`: pagina 404 e pagina de erro.
- `src/lib/route-access.ts`: lista unica de rotas protegidas e titulos das telas.
  Rota nova que exige login precisa entrar em `protectedPaths`; endereco que nao
  existe cai na 404 sem passar pelo login.

## Providers de transcricao

A transcricao agora tem separacao clara entre provider mock e providers reais.

Variaveis de ambiente:

```text
EDUCAI_TRANSCRIPTION_PROVIDER=mock | openai | gemini | faster-whisper
EDUCAI_ENABLE_SIMULATED_PROVIDERS=true | false
EDUCAI_DEBUG_PROVIDERS=true | false
OPENAI_API_KEY=sk-...
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
GEMINI_API_KEY=...
GEMINI_TRANSCRIBE_MODEL=gemini-3.8-flash
GEMINI_INSIGHTS_MODEL=gemini-3.8-flash
```

Comportamento atual:

- `EDUCAI_TRANSCRIPTION_PROVIDER=mock`: usa transcricao simulada. Este modo deve
  ser usado apenas em testes automatizados ou desenvolvimento com
  `EDUCAI_ENABLE_SIMULATED_PROVIDERS=true`.
- `EDUCAI_TRANSCRIPTION_PROVIDER=openai`: usa provider real OpenAI e exige
  `OPENAI_API_KEY`.
- `EDUCAI_TRANSCRIPTION_PROVIDER=gemini`: usa provider real Gemini e exige
  `GEMINI_API_KEY`.
- `EDUCAI_TRANSCRIPTION_PROVIDER=faster-whisper`: usa worker HTTP local para
  transcricao real.
- Sem `EDUCAI_TRANSCRIPTION_PROVIDER`, o sistema escolhe automaticamente:
  - com `OPENAI_API_KEY`, usa OpenAI;
  - sem `OPENAI_API_KEY`, mas com `GEMINI_API_KEY`, usa Gemini;
  - sem chaves reais, passa a preferir `faster-whisper`.
- As variaveis podem chegar por `process.env` ou pelo objeto `env` do handler
  do servidor. Providers reais devem funcionar nos dois casos.
- Se o provider real `openai` estiver selecionado e `OPENAI_API_KEY` nao existir,
  a API retorna erro claro de transcricao indisponivel.
- Se o provider real `gemini` estiver selecionado e `GEMINI_API_KEY` nao existir,
  a API retorna erro claro de transcricao indisponivel.
- Em modo real, a API nao deve retornar texto mockado como se fosse transcricao
  real.
- Se `faster-whisper` estiver selecionado, mas o worker estiver em `backend=mock`
  ou incompleto, a API deve falhar honestamente em vez de aceitar transcricao
  simulada como resultado oficial.

## Mock atual

O texto mockado de transcricao, incluindo:

```text
Host: Thanks for joining...
```

vem de `buildSimulatedTranscript` em `src/server/simulated-session-runtime.ts`.

Ele deve continuar existindo para testes e desenvolvimento local, mas nao deve
mascarar falhas quando o provider real estiver explicitamente selecionado.

Quando `EDUCAI_DEBUG_PROVIDERS=true`, `transcription-provider.ts` registra no
terminal um log seguro com o provider resolvido e booleans de presenca de
chaves (`geminiKey=true/false`, sem imprimir segredos). Use esse log para
diagnosticar selecao de provider sem poluir o console em uso normal.

## Materiais e resultado

Depois de uma transcricao iniciada pela tela de processamento, o frontend chama
`POST /api/v1/sessions/{sessionId}/materials/generate` antes de navegar para a
tela de resultado. A navegacao so deve acontecer quando o status chegar em
`READY`.

A tela de processamento agenda a navegacao para `/resultado` quando recebe
`READY`; esse timer nao deve ser cancelado por atualizacoes duplicadas de status.
O progresso visual tambem nao deve mostrar 100% antes de `READY`, para nao
parecer travado quando a IA ainda esta processando.

Em modo `mock`, os materiais continuam vindo de
`src/server/simulated-session-runtime.ts` para manter desenvolvimento local e
testes controlados.

O endpoint `GET /api/v1/settings/providers/runtime-status` deve resumir a saude
efetiva das capacidades de transcricao, materiais, chat e assistente, alem dos
status operacionais de Ollama e Faster-Whisper. A tela de configuracoes deve
refletir essa leitura em vez de mostrar apenas selecao de provider.

Em modo real:

- `EDUCAI_TRANSCRIPTION_PROVIDER=openai` usa OpenAI tambem para materiais.
- `EDUCAI_TRANSCRIPTION_PROVIDER=gemini` usa Gemini tambem para materiais.
- `GEMINI_INSIGHTS_MODEL` pode separar o modelo de geracao de materiais do
  modelo de transcricao. Se nao for definido, o sistema reutiliza
  `GEMINI_TRANSCRIBE_MODEL` e depois cai em `gemini-3.8-flash`.
- Falha real de geracao de materiais nao deve ser mascarada por material mock.

A tela `src/features/resultado/` deve consumir transcricao, materiais e chat da
API V1. Ela pode mostrar estados vazios honestos, mas nao deve voltar para os
dados estaticos de `src/lib/mock-data.ts` quando existir `sessionId` real.

## Transcricao ao vivo na gravacao

A tela `src/features/aula/` nao deve renderizar `mockTranscript` durante a
gravacao. Enquanto o audio esta sendo gravado pelo `MediaRecorder`, a interface
pode mostrar uma previa local usando a Web Speech API do navegador
(`SpeechRecognition`/`webkitSpeechRecognition`).

Essa previa ao vivo e apenas feedback visual para o usuario enquanto ele fala.
A fonte oficial da transcricao continua sendo o provider configurado na API
depois que o audio completo e enviado e a tela de processamento chama Gemini ou
OpenAI.

A Web Speech API do navegador nao entrega diarizacao real nem separacao
confiavel de falantes quando o audio vem misturado em um unico microfone. Por
isso, a tela de aula usa canais estimados no preview: `Auto` alterna canais por
pausas longas/prefixos falados, e `Manual` permite escolher qual canal recebera
os proximos trechos. Esse preview nao deve ser tratado como fonte oficial de
quem falou.

O preview ao vivo preserva/corrige visualmente termos tecnicos comuns antes de
exibir o texto, usando `src/lib/technical-terms.ts`. Exemplos: Lovable, API,
TypeScript, Supabase, Fireflies, OpenAI, ChatGPT, React, Vite, GitHub,
frontend, backend, full stack, endpoint, webhook, Docker, Figma e Stripe. Essa
normalizacao ajuda a interface local e tambem orienta o pos-processamento leve
da transcricao oficial.

A previa inteligente em `src/features/aula/` deve mostrar sinais rapidos
durante a gravacao: termos tecnicos detectados, possiveis problemas de
transcricao, pontos importantes captados ate o momento e alertas de linguagem
como informalidade, repeticao ou frases confusas. Essa previa e heuristica/local
e nao substitui o relatorio final gerado pela IA real.

A previa local deve ser visualmente escaneavel: separar pontos captados, termos
tecnicos e alertas em blocos distintos antes dos trechos reconhecidos. O usuario
deve conseguir perceber rapidamente se a IA esta captando bem a aula.

A transcricao oficial de OpenAI/Gemini tambem passa por normalizacao leve de
termos tecnicos com `normalizeTechnicalTerms` antes de salvar o texto e gerar
segmentos. Isso reduz erros recorrentes em nomes como Lovable, API, TypeScript,
Supabase e Fireflies sem alterar o contrato V1.

Para a transcricao final, OpenAI e Gemini recebem prompt pedindo turnos com
rotulos estaveis (`Speaker 1: ...`, `Speaker 2: ...`) quando houver mais de uma
pessoa audivel. `src/server/transcript-segments.ts` converte esses rotulos em
`TranscriptSegment.speaker`, mapeando `Speaker 1`, `Pessoa 1` etc. para
participantes da sessao quando existirem. Se o provider nao conseguir separar
falantes, o sistema ainda cai para segmentos estimados.

A aba `Transcricao` em `src/features/resultado/` deve renderizar a transcricao
final por blocos de `TranscriptSegment`, com falante e tempo estimado. Ela tambem
pode editar falante/texto usando o endpoint V1 existente
`PATCH /api/v1/sessions/{sessionId}/transcript`, marcando `status=EDITED`. A
edicao da transcricao nao deve regenerar materiais automaticamente nesta etapa;
quando isso for implementado, deve chamar novamente
`POST /api/v1/sessions/{sessionId}/materials/generate`.

Quando houver mensagens do assistente ao vivo salvas na metadata da gravacao, a
aba `Transcricao` tambem deve mostrar as perguntas feitas durante a aula e a
resposta da IA logo abaixo, com diferenciacao visual clara em relacao aos
trechos falados comuns. Isso preserva o historico completo da aula/conversa.

O assistente contextual em `src/lib/live-assistant.ts` deve responder pelo
contexto geral da aula, nao apenas por termos literalmente mencionados. Exemplo:
se a fala capturada tratar de frontend e backend, a assistente deve conseguir
explicar a relacao com full stack mesmo que "full stack" nao tenha sido dito.

Depois que a transcricao for editada, a tela de resultado deve deixar claro que
os materiais podem estar desatualizados e oferecer acao de "Regenerar materiais",
chamando o endpoint V1 existente `POST /materials/generate` e recarregando
overview/materiais sem criar novos endpoints.

## Mensagens de erro de providers

A tela de processamento nao deve hardcodar Gemini em erros genericos como `429`
ou `503`. Quando a causa vier de `OpenAI request failed`, a mensagem deve falar
OpenAI; quando vier de `Gemini request failed`, deve falar Gemini; quando o
provider nao estiver claro, usar texto generico de IA.

## Contexto rico da sessao

O contrato V1 nao deve ganhar campos novos para configuracoes da tela
`src/features/nova-aula/`. Campos como `theme`, `context`, `audience`,
`level`, `objectives`, `aiInstructions` e `outputsRequested` devem ser enviados
dentro de `session.metadata`, preservando `title`, `type`, `language` e
`summaryTemplate` no topo do payload V1.

Os providers reais de materiais devem usar `session.metadata` e
`summaryTemplate` como contexto de geracao. OpenAI e Gemini recebem esse contexto
via `src/server/session-context.ts` para evitar resumo, topicos, perguntas,
acoes e mapa mental genericos quando a sessao tem objetivo, publico-alvo ou
instrucoes especificas.

`src/server/material-generation.ts` centraliza o formato interno de geracao de
materiais. OpenAI e Gemini recebem instrucoes para gerar materiais com funcoes
distintas, evitando repetir o mesmo conteudo em secoes diferentes. O resumo deve
ser sintese executiva; topicos devem organizar conceitos; `INSIGHTS` deve ser
usado como relatorio analitico profissional; perguntas devem avaliar
aprendizado; acoes devem ser tarefas concretas; e mapa mental deve ser
hierarquia visual ramificada, nao lista plana ou bloco unico.

O schema/shape interno agora pede resumo estruturado, topicos com evidencia,
relatorio tecnico com resumo geral, pontos importantes, analise da comunicacao,
erros de linguagem/informalidade, pontos a melhorar e pontos positivos, acoes
com prioridade e criterio de sucesso, perguntas com resposta esperada e foco, e
mapa mental com tema central, ramos, sub-ramos e folhas. A API V1 continua
retornando os mesmos `MaterialItem`s; esse conteudo rico e convertido para
Markdown dentro de `MaterialItem.content`.

Quando `session.metadata.outputsRequested` pede apenas alguns materiais, os
providers reais mantem somente os tipos V1 correspondentes quando possivel
(por exemplo `Resumo`, `Topicos`, `Mapa mental`, `Perguntas`, `Atividades` ou
`Proximos passos`). Saidas ainda nao conectadas visualmente, como flashcards,
nao devem alterar contrato V1 nesta etapa.

A tela `src/features/resultado/` possui uma aba de relatorio lendo o material
V1 `INSIGHTS` como documento analitico corrido, nao como varios cards soltos. O
relatorio deve priorizar leitura profissional com secoes claras: resumo geral,
pontos importantes, analise da comunicacao, erros de linguagem/informalidade,
pontos a melhorar e pontos positivos. Isso nao altera o conteudo salvo nem o
contrato V1.

A aba de relatorio pode exibir uma secao visual de evidencias derivada no front,
cruzando pontos do relatorio com trechos da transcricao por palavras-chave. Essa
secao ajuda o usuario a confiar na analise, mas e uma camada de exibicao: nao
deve alterar `MaterialItem.content` nem criar novo campo no contrato V1.

A tela de resultado agora pode exportar um Markdown consolidado com resumo,
relatorio, evidencias, topicos, mapa mental, perguntas, acoes e transcricao. O
PDF continua como pendencia de V1, mas o Markdown serve como exportacao util e
portavel imediatamente.

A exportacao Markdown deve ficar bloqueada enquanto nao houver nenhum dado real
carregado da sessao. A regeneracao de materiais deve exigir transcricao carregada
e nao deve disparar chamadas duplicadas enquanto ja estiver regenerando.

Quando a transcricao for editada manualmente, materiais existentes devem ser
tratados como potencialmente desatualizados se `transcript.updatedAt` for mais
recente que o material mais novo. A tela deve orientar o usuario a regenerar
resumo, relatorio, mapa mental, perguntas e acoes antes de confiar no resultado.

A tela de resultado tambem deve ter uma visao executiva no topo, com status,
quantidade de falantes, trechos, palavras, materiais, provider usado, termos
tecnicos detectados e principais highlights derivados dos materiais reais. Isso
serve para aproximar o produto da experiencia de leitura rapida do Fireflies,
mas mantendo foco em aula/mentoria.

A aba de perguntas deve tratar `QUESTIONS` como material de estudo, nao como uma
lista generica. O gerador deve pedir perguntas ligadas ao conteudo real da aula,
com respostas claras e curtas o bastante para revisao, misturando perguntas
conceituais, praticas e reflexivas. Quando houver dificuldade/foco, o Markdown
deve agrupar em `Fáceis`, `Médias` e `Reflexivas`, e a tela de resultado deve
renderizar perguntas e respostas em blocos visuais separados.

As perguntas tambem podem trazer `Como revisar`, convertido de `reviewTip`, para
orientar o aluno/professor sobre como usar aquela pergunta na revisao. Acoes
devem ser tarefas concretas com prioridade, categoria, responsavel, motivo e
criterio de sucesso, para nao virarem uma lista generica de proximos passos.

A aba de mapa mental interpreta Markdown hierarquico (`#`, `##`, lista e
sublista) e renderiza um mapa com no central, ramos laterais, sub-ramos e folhas,
inspirado em mapas mentais visuais, mas com estetica mais moderna/tecnologica.
Quando o material vier como texto grande ou lista plana, a tela deve quebrar o
conteudo em blocos menores para evitar um unico bloco gigante. Quando o provider
entregar top-level bullets sem `##`, o front deve interpretar cada bullet
principal como ramificacao separada.

Se o mapa mental gerado vier fraco, com poucos ramos ou pouca hierarquia, a tela
de resultado pode complementar visualmente com ramos derivados do resumo,
topicos, relatorio e acoes: conceitos principais, pontos importantes, linguagem
e comunicacao, pontos a melhorar, pontos positivos e proximos passos. Isso e
fallback visual e nao altera o contrato V1.

As metricas ao vivo de `confidence`, `clarity`, `intonation` e `conviction`
salvas em `metadata.livePreview` sao estimativas locais. `confidence` vem do
SpeechRecognition do navegador; `clarity` e `conviction` devem ser calculadas
com amostras ativas de audio, filtrando silencio e evitando comparar a media
contra um pico isolado. A UI deve deixar claro que clareza/conviccao sao
estimadas, pois nao substituem avaliacao real feita pela IA no relatorio final.

## V2 - Assistente ao vivo

O assistente NAO usa mais sidebar/drawer. A interacao acontece de forma
contextual, integrada ao fluxo da tela de aula (`src/features/aula/`), por um
rodape fixo renderizado pelo componente `src/components/contextual-assistant.tsx`
(`ContextualAssistant`). Esse rodape traz: rotulo do assistente, alternancia de
modo `Aluno`/`Mentor` compacta, sugestoes como chips/botoes (clicou, respondeu),
um campo curto de pergunta livre, um card de resposta curto e transitorio
(dismissivel, com botao de ouvir) e o botao de modo voz. Nao ha sidebar, overlay
nem botao flutuante. A interacao deve funcionar por texto digitado, chips e voz;
`Enter` envia a pergunta livre, `Shift+Enter` quebra linha. O painel antigo
(`live-assistant-panel.tsx`) e o `voice-input.tsx` foram removidos.

Os helpers de voz do navegador ficam centralizados em `src/lib/speech.ts`
(tipos do Web Speech, `getSpeechRecognition`, `isSpeechSynthesisSupported`,
`speak`/`cancelSpeak`, `toSpeech` para limpar markdown antes da fala e
`matchWakeWord`). O modo voz e maos-livres por palavra de ativacao: durante a
gravacao, dizer `"assistente, <pergunta>"` e detectado na transcricao viva (sem
poluir o transcript oficial), a resposta e gerada e falada via TTS. Ha guarda
anti-feedback enquanto o assistente fala. A leitura em voz alta automatica so
acontece no modo voz. `voiceFeaturesSupported` e calculado apenas no cliente
(estado + efeito) para nao quebrar a hidratacao SSR.

As respostas do assistente (`src/lib/live-assistant.ts`,
`buildLiveAssistantResponse`) devem ser diretas e curtas: titulo curto + poucos
bullets + no maximo um proximo passo, sem texto generico repetido. O assistente
NAO deve responder uma pergunta com outra pergunta. Perguntas de definicao
(`"o que e X"`, `"o que significa X"`, `"defina X"`) caem numa intencao de
definicao que responde direto, usando um glossario com aliases (ex.: `front` ->
`frontend`). Quando nao ha definicao no glossario, responde de forma direta pelo
contexto da aula ou avisa, mas sem devolver pergunta. O fallback tambem e uma
afirmacao, nunca uma pergunta.

O roteamento do assistente deve ter testes para resumo, pontos importantes,
termos tecnicos, pergunta ao mentor, explicacao simples, duvidas e wake word. A
intencao de duvidas deve vir antes de pergunta ao mentor para evitar colisao de
regex.

O contrato do assistente deve ser salvo junto com o audio final em
`metadata.liveAssistant`, incluindo modo, mensagens e prompts usados. Isso
permite reaproveitar a conversa depois no resultado final sem alterar o contrato
V1 de transcricao ou materiais.

A tela `src/features/resultado/` pode ler `metadata.liveAssistant` da ultima
gravacao e exibir uma secao resumida dentro do relatorio, com modo usado,
quantidade de mensagens, contexto e ultimas interacoes. Essa leitura e apenas
visual e nao deve alterar os materiais gerados pela V1.

A linha do tempo do assistente e os marcadores inteligentes devem ser exibidos
em ordem cronologica quando houver `offsetMs`, para que o usuario navegue pela
aula sem perder a sequencia do que foi capturado.

A secao de evidencias do relatorio pode mostrar o grau de correspondencia entre
o trecho analitico e a transcricao, para deixar claro quando a sustentacao do
texto e forte, moderada ou apenas parcial. Essa indicacao e visual e nao altera
o contrato V1.

## Estabilidade de rotas

Rotas dependentes de sessao (`/aula`, `/processando`, `/resultado`) devem tratar
`sessionId` ausente ou invalido com estado vazio/erro claro e acoes para voltar ao
historico ou criar sessao. A tela de aula nao deve iniciar microfone, gravador ou
transcricao ao vivo antes de carregar uma sessao real.

## Historico e biblioteca

`src/features/historico/` deve funcionar como biblioteca operacional, nao apenas
lista simples. A tela deve mostrar metricas de total/prontas/falhas/atencao,
filtros por status (`READY`, `TRANSCRIBED`, `FAILED`, em processamento), busca
por titulo, tipo, idioma, status, metadados e previa de material. Quando a
sessao tiver materiais, o front pode buscar `GET /materials` para exibir uma
previa real do resumo, sem alterar o contrato V1. Sessoes com falha ou
transcritas devem manter acao de tentar novamente indo para `/processando`.

## PDF

A exportacao de PDF ainda nao esta implementada. Nao existe gravacao real em
`~/Documentos/educAI` ou `/documentos/educ-AI`; qualquer texto prometendo esse
caminho era apenas uma notificacao falsa da interface e deve ser removido ou
substituido por um estado honesto ate a funcionalidade ser implementada.

## Persistencia local

O arquivo `.data/voice-sessions.json` pode ser regravado por ferramentas do
Windows com BOM UTF-8. `src/server/local-persistence.ts` deve remover um BOM
inicial antes de fazer `JSON.parse`, para a API local nao falhar com
`Unexpected token '﻿'`.

## Comandos importantes

Validar TypeScript:

```powershell
node_modules\.bin\tsc.cmd --noEmit
```

Rodar teste de integracao da API V1:

```powershell
npm.cmd run test:api
```

Build:

```powershell
npm.cmd run build
```

Rodar localmente:

```powershell
npm.cmd run dev:api
```

## Regra de commit

Sempre que houver mudanca significativa, com testes passando e sem quebra do
contrato V1, o agente pode fazer commit e avisar.

Antes de commitar, confirmar:

- `npm.cmd run test:api` passou;
- `npm.cmd run build` passou;
- `node_modules\.bin\tsc.cmd --noEmit` passou, se aplicavel;
- o contrato V1 nao foi alterado;
- endpoints, enums, campos e formatos continuam intactos;
- a mudanca esta funcionando dentro do escopo pedido.

Atualizar este arquivo sempre que uma decisao tecnica importante alterar o
estado do projeto.
