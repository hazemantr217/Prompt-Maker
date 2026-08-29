# Prompt Maker

Arabic-first prompt optimization workspace for Gemini native image-generation models. It combines reference-image analysis, structured prompt generation, prompt history, and an adaptive example-memory system.

## Supported models

Image generation is intentionally limited to active Gemini-native image models:

- Nano Banana 2 — `gemini-3.1-flash-image`
- Nano Banana Pro — `gemini-3-pro-image`
- Nano Banana — `gemini-2.5-flash-image`

Deprecated Imagen 4 entries were removed. The single runtime registry is [`shared/models.ts`](shared/models.ts); both the UI and server read from it, preventing display/API mismatches.

## Architecture

- `src/` — React UI, browser storage, image preparation, and typed API client.
- `server/routes/` — small Express route modules.
- `server/services/` — Gemini integration and learning-context assembly.
- `server/lib/` — validation, HTTP errors, and middleware helpers.
- `shared/` — model registry and deterministic learning ranker shared by client and server.
- `tests/` — unit tests for ranking, reinforcement, validation, and model cleanup.

The learning system is adaptive few-shot memory, not model fine-tuning. It ranks active examples using semantic token overlap, detected task intent, feedback quality, recency, and diversity. Only the most relevant examples within a character budget are sent to Gemini.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
3. Start development: `npm run dev`
4. Run the full quality gate: `npm run check`

## Security and reliability

- API keys stay server-side.
- Zod validates and bounds all API input.
- Image count, type, and encoded size are limited.
- API rate limiting and production security headers are enabled.
- Internal SDK errors are mapped to safe public responses.
- Automatic fallback does not retry quota/auth failures across multiple models.
- User history is versioned, migrated, bounded, and stripped of oversized image data before persistence.
