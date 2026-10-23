# Runtime Hardening

Este documento registra as decisoes de confiabilidade e seguranca aplicadas antes da fase de launcher e orquestrador desktop.

## Diagnostico

A arquitetura de providers esta funcional e desacoplada por capacidade, mas havia quatro riscos principais:

1. cada provider implementava `fetch`, timeout, parsing JSON e erros de forma diferente
2. URLs de runtimes locais podiam apontar para destinos publicos ou protocolos inseguros
3. atualizacoes de configuracao podiam ser aplicadas parcialmente quando um campo posterior falhava
4. uploads, comandos e concorrencia do worker local nao tinham limites operacionais explicitos

## Melhorias aplicadas

### HTTP compartilhado para providers

`src/server/provider-http.ts` centraliza:

- timeout configuravel
- cancelamento
- erros tipados de rede, timeout, HTTP e JSON invalido
- limite de texto incorporado nas mensagens de erro

Providers migrados:

- OpenAI
- Gemini
- Ollama
- Faster-Whisper

Configuracao:

- `EDUCAI_PROVIDER_TIMEOUT_MS`

### Endpoints locais seguros

`src/server/provider-endpoint.ts` valida URLs de Ollama e Faster-Whisper.

Por padrao, sao permitidos:

- `localhost`
- loopback
- redes IPv4 privadas
- IPv6 local ou privado
- hostnames `.local`
- hostnames locais sem dominio
- `host.docker.internal`

Protocolos diferentes de HTTP/HTTPS, credenciais na URL, query string, fragmentos e hosts publicos sao rejeitados.

Para permitir conscientemente um endpoint remoto:

- `EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS=true`

As atualizacoes de configuracao sao transacionais: ou todos os campos validam e sao aplicados, ou nenhum campo muda.

### Uploads e gravacoes

A API principal rejeita arquivos acima do limite configurado antes da persistencia.

Configuracao:

- `EDUCAI_MAX_AUDIO_UPLOAD_BYTES`

Padrao:

- 500 MiB

A leitura de gravacoes valida que o caminho resolvido continua dentro de `EDUCAI_RECORDINGS_DIR`.

### Worker Faster-Whisper

O worker local agora possui:

- limite de upload
- limite de concorrencia
- timeout de comando
- limite de saida do processo
- sanitizacao do nome do arquivo temporario
- parsing de comandos com argumentos entre aspas
- codigos HTTP coerentes para excesso de tamanho, saturacao e timeout
- carga e limites publicados em `GET /health`

Configuracoes:

- `FASTER_WHISPER_COMMAND_TIMEOUT_MS`
- `FASTER_WHISPER_MAX_COMMAND_OUTPUT_BYTES`
- `FASTER_WHISPER_MAX_CONCURRENT_JOBS`
- `FASTER_WHISPER_MAX_UPLOAD_BYTES`

## Testes

O comando `npm test` cobre:

- validacao de endpoints locais
- timeout, JSON invalido e sucesso do HTTP compartilhado
- assistente e roteamento local
- limites, concorrencia e timeout do worker
- bridge HTTP do Faster-Whisper
- contrato e fluxo integrado da API V1

## Debitos tecnicos restantes

Antes de distribuicao desktop ou exposicao em rede, ainda devem ser tratados:

- autenticacao e autorizacao da API V1
- politica CORS por ambiente
- upload por streaming para evitar carregar multipart completo em memoria quando nao houver `Content-Length`
- schema validation mais profunda dos dados persistidos
- armazenamento transacional em banco para cenarios multi-processo
- observabilidade estruturada com request id, metricas e tracing
- isolamento mais forte do processo externo de transcricao
