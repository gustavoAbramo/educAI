# Supabase persistence

## Objetivo

O educ-AI continua usando persistencia local por padrao. Para sincronizar sessoes em Supabase,
configure o backend com:

- `EDUCAI_PERSISTENCE_PROVIDER=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador. Ela deve existir apenas no runtime do
servidor, launcher ou ambiente desktop seguro.

## Schema inicial

Este schema guarda o mesmo envelope usado hoje em `.data/voice-sessions.json`. Isso reduz risco
porque preserva o contrato atual do app enquanto prepara uma migracao futura para tabelas
normalizadas.

```sql
create table if not exists public.educai_voice_store (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.educai_voice_store enable row level security;

revoke all on table public.educai_voice_store from anon, authenticated;
```

O backend usa `service_role`, que bypassa RLS no servidor. Por isso nao crie politicas publicas
para esta tabela enquanto nao houver modelo de usuarios/autenticacao no produto.

## Como ativar

1. Crie a tabela acima no SQL editor do Supabase.
2. Configure as variaveis no ambiente do servidor.
3. Reinicie o app.
4. Crie ou atualize uma sessao.
5. Verifique se a linha `id = 'default'` foi criada em `educai_voice_store`.

## Limites atuais

- A sincronizacao e de documento inteiro, nao por entidade.
- Ainda nao ha merge entre varios dispositivos.
- Audio continua seguindo o armazenamento local atual.
- Para desktop offline-first, o ideal futuro e manter cache local e sincronizar com Supabase quando
  houver internet.

## Proximo desenho recomendado

Quando o produto estabilizar, separar em tabelas:

- `educai_sessions`
- `educai_recordings`
- `educai_transcripts`
- `educai_materials`
- `educai_chat_messages`
- `educai_diagnostics`

Essa etapa deve vir junto com Auth/RLS por usuario ou workspace.
