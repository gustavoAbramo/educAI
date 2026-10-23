# Run Loop - 2026-06-16 - Cycle 14

## Objetivo do ciclo

Melhorar a usabilidade do guia local permitindo copiar comandos sugeridos diretamente da tela de configuracoes.

## Foco

- reduzir friccao para testar runtime local
- manter comportamento seguro no navegador
- reaproveitar toast existente
- validar por build

## Implementacao realizada

### Botao copiar comando

- `src/routes/configuracoes.tsx`

Os comandos exibidos no guia de ativacao local agora possuem botao `Copiar`.

O fluxo:

1. verifica se `navigator.clipboard.writeText` esta disponivel
2. copia o comando
3. mostra toast de sucesso
4. mostra erro honesto se clipboard nao estiver disponivel ou falhar

## Arquivos alterados

- `docs/run-loop-2026-06-16-cycle-14.md`
- `src/routes/configuracoes.tsx`

## Testes executados

- `npm run build`

## Resultado

- Guia local ficou mais pratico para Windows/PowerShell.
- O usuario pode copiar comandos de worker, Ollama e variaveis de ambiente sem selecionar texto manualmente.

## Nota do ciclo

## 8.5 / 10

### Justificativa

Pequena melhoria de UX, mas alinhada com o objetivo de preparar o produto para setup local e futuro launcher desktop.

## Proximos passos recomendados

1. Criar smoke test real de audio no Faster-Whisper command
2. Persistir historico de diagnosticos locais
3. Mostrar quando materiais foram gerados a partir de JSON reparado
