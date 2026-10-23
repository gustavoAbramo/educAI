# Run Loop - 2026-06-16 - Cycle 09

## Objetivo do ciclo

Fortalecer a operacao local com Ollama e preparar a experiencia de modo offline de forma honesta, sem remover OpenAI, Gemini ou os providers ja existentes.

## Foco

- reduzir falhas de materiais quando modelos locais retornam JSON imperfeito
- adicionar reparo controlado de JSON para Ollama
- expor prontidao offline no runtime health
- manter diagnosticos honestos para produto desktop/local-first
- validar tudo com testes de integracao e build

## Diagnostico inicial

O ciclo 08 deixou Ollama e Faster-Whisper mais observaveis, mas a geracao de materiais com Ollama ainda tinha um gargalo importante: o provider fazia apenas uma tentativa de `JSON.parse`.

Isso e fragil para modelos locais porque eles podem:

- retornar JSON com objeto incompleto
- incluir texto junto do JSON
- quebrar aspas ou fechamento de campos
- respeitar o formato geral, mas falhar em detalhes de sintaxe

Tambem ainda faltava uma leitura objetiva sobre "estamos prontos para operar offline?".

## Implementacoes realizadas

### 1. Reparo de JSON para materiais com Ollama

- `src/server/ollama-provider.ts`

Foi adicionada uma camada isolada de geracao JSON com reparo:

1. tenta gerar JSON normalmente com `format: "json"`
2. tenta parsear o objeto retornado
3. se falhar, chama o Ollama novamente como motor estrito de reparo JSON
4. valida o JSON reparado
5. se o reparo tambem falhar, retorna erro claro

O reparo pede explicitamente para:

- retornar apenas um objeto JSON valido
- nao adicionar markdown
- nao adicionar explicacoes
- nao inventar fatos novos
- preservar valores aproximados quando um campo estiver incompleto

Quando o reparo e usado, o modelo gerado passa a carregar o sufixo `json-repaired`, facilitando auditoria futura.

### 2. Prontidao offline no runtime health

- `src/lib/voice-intelligence.ts`
- `src/server/provider-runtime-health.ts`

Foi criado `offlineReadiness` no envelope de saude dos providers.

O status pode ser:

- `ready`
- `partial`
- `blocked`

A avaliacao considera:

- transcricao selecionada como Faster-Whisper
- Faster-Whisper realmente pronto para transcricao
- geracao selecionada como Ollama
- Ollama pronto e com JSON estruturado funcional
- busca web da assistente desligada para offline total

Isso evita uma promessa falsa de modo offline quando alguma parte ainda depende de nuvem ou busca externa.

### 3. UI de configuracoes com modo offline

- `src/routes/configuracoes.tsx`

A tela de configuracoes agora mostra um card de "Modo offline" dentro da saude operacional.

Ele mostra:

- estado atual
- resumo
- primeiro bloqueio ou pendencia mais importante

### 4. Testes de integracao

- `src/server/voice-api.integration.test.ts`

O teste de materiais com Ollama agora simula um caso real:

1. primeira resposta do Ollama vem com JSON quebrado
2. o backend aciona o reparo
3. a segunda resposta vem valida
4. os materiais sao gerados com sucesso

Tambem foi adicionada validacao para `offlineReadiness` no endpoint de runtime health.

## Arquivos alterados

- `docs/run-loop-2026-06-16-cycle-09.md`
- `src/lib/voice-intelligence.ts`
- `src/routes/configuracoes.tsx`
- `src/server/ollama-provider.ts`
- `src/server/provider-runtime-health.ts`
- `src/server/voice-api.integration.test.ts`

## Testes executados

- `node --import tsx --test src/server/provider-http.test.ts src/server/provider-endpoint.test.ts src/server/voice-api.integration.test.ts`

## Resultado

- Testes especificos de provider/API passaram.
- Ollama ficou mais tolerante a falhas comuns de modelos locais.
- O runtime health passou a explicar a prontidao offline de forma acionavel.

## Nota do ciclo

## 9.3 / 10

### Justificativa

Este ciclo melhora confiabilidade real do caminho local sem aumentar muito a complexidade. O reparo de JSON resolve uma dor pratica de modelos locais, e o indicador offline cria base de produto para desktop/local-first.

A nota ainda nao chega a 10 porque:

- ainda falta um schema validator completo antes/depois do reparo
- ainda falta retry parametrizavel por configuracao
- ainda falta um setup wizard para colocar a stack offline em `ready`
- ainda falta smoke test real de audio curto para Faster-Whisper command

## Proximos passos recomendados

1. Validar payloads do Ollama contra schema estrutural antes de formatar materiais
2. Criar modo offline guiado no painel de configuracoes
3. Adicionar smoke test real com audio curto no Faster-Whisper command
4. Criar um setup checklist com comandos para baixar modelos Ollama e iniciar worker local
