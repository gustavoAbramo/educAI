# Assistant Knowledge Architecture

## Goal

Expand the live assistant so it can answer:

- session-specific questions about the current lesson
- general knowledge questions across common domains
- questions that may need stronger reasoning or future external verification

## Runtime flow

1. The question arrives from the lesson screen.
2. The knowledge router classifies the domain and confidence.
3. The local assistant tries the fast contextual answer first.
4. If the topic is broad, low-confidence, or outside the current lesson, the backend asks the configured provider.
5. If the question depends on recent information and OpenAI is configured, the backend can invoke web search through the Responses API.
6. If no provider is configured, the system falls back to the local knowledge base.
7. Low-confidence or freshness-sensitive questions are logged in browser storage for future enrichment.

## Main pieces

- `src/lib/assistant-knowledge.ts`
  Domain routing, lightweight local definitions, confidence heuristics, and provider routing hints.
- `src/server/assistant-service.ts`
  Hybrid orchestration between local answer, provider answer, web search, and fallback.
- `src/services/assistantService.ts`
  Client call used by the lesson screen.
- `src/lib/assistant-question-log.ts`
  Captures knowledge gaps for later expansion.
- `src/server/openai-provider.ts`
  Web-enabled provider path for freshness-sensitive questions.

## Suggested next expansions

- Load knowledge packs from `agents/` or `docs/knowledge/` instead of hardcoding all entries.
- Expand web-search filters by domain for legal, health, education, and finance questions.
- Persist assistant question gaps on the server, not only in local storage.
- Add topic-level analytics to rank which domains fail most often.

## Configuration

- `OPENAI_API_KEY`
  Enables provider answers and web search support through OpenAI.
- `GEMINI_API_KEY`
  Enables provider answers without the current web search path.
- `EDUCAI_ASSISTANT_WEB_SEARCH`
  Optional. Use `auto` (default), `on`, or `off`.
