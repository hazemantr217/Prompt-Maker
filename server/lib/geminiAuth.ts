import type { Request } from 'express';

const GEMINI_API_KEY_HEADER = 'x-gemini-api-key';

export function readUserGeminiApiKey(request: Request): string | undefined {
  const value = request.headers[GEMINI_API_KEY_HEADER];
  return typeof value === 'string' ? value : undefined;
}
