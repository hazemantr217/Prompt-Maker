import type { LearnedExample } from '../types';
import type { ChatModelApiId, ModelId } from '../../shared/models';

export interface ReferenceImagePayload {
  base64: string;
  mimeType: string;
}

export interface PromptVariation {
  prompt: string;
  style: string;
  lighting: string;
  explanation: string;
}

export interface OptimizePromptRequest {
  prompt: string;
  model: ModelId;
  images?: ReferenceImagePayload[];
  aspectRatio: string;
  creativity: number;
  chatModel: ChatModelApiId;
  modifierAction?: 'shorten' | 'expand';
  multiPrompt?: boolean;
  variationType?: 'similar' | 'different';
  learnedExamples?: LearnedExample[];
}

export interface OptimizePromptResponse {
  optimizedPrompt: string;
  analysis: {
    lighting: string;
    style: string;
    keywords: string[];
    recommendedRatio: string;
  };
  tips: string;
  explanation: string;
  variations?: PromptVariation[];
  learning?: {
    selectedIds: string[];
    totalActive: number;
  };
}

interface GenerateVisualResponse {
  imageUrl: string;
  success: true;
  model: string;
}

export interface GeminiAuthStatus {
  mode: 'managed' | 'user-required';
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const GEMINI_KEY_SESSION_STORAGE = 'prompt-maker:gemini-api-key';
let userGeminiApiKey: string | null = null;

function readSessionApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(GEMINI_KEY_SESSION_STORAGE)?.trim() || null;
  } catch {
    return null;
  }
}

export function hasUserGeminiApiKey(): boolean {
  userGeminiApiKey ??= readSessionApiKey();
  return Boolean(userGeminiApiKey);
}

export function setUserGeminiApiKey(apiKey: string): void {
  const normalized = apiKey.trim();
  userGeminiApiKey = normalized || null;
  if (typeof window === 'undefined') return;
  try {
    if (normalized) window.sessionStorage.setItem(GEMINI_KEY_SESSION_STORAGE, normalized);
    else window.sessionStorage.removeItem(GEMINI_KEY_SESSION_STORAGE);
  } catch {
    // In-memory access still works when session storage is unavailable.
  }
}

export function clearUserGeminiApiKey(): void {
  setUserGeminiApiKey('');
}

export function isGeminiApiKeyError(error: unknown): boolean {
  return error instanceof ApiError && ['AI_KEY_REQUIRED', 'AI_KEY_INVALID', 'AI_PERMISSION'].includes(error.code || '');
}

async function requestJson<T>(url: string, init?: RequestInit, includeGeminiKey = true): Promise<T> {
  const headers = new Headers(init?.headers);
  if (includeGeminiKey) {
    userGeminiApiKey ??= readSessionApiKey();
    if (userGeminiApiKey) headers.set('X-Gemini-API-Key', userGeminiApiKey);
  }

  const response = await fetch(url, { ...init, headers });
  const payload = await response.json().catch(() => ({ error: 'استجابة غير صالحة من الخادم.' })) as { error?: string; code?: string } & T;
  if (!response.ok) {
    throw new ApiError(payload.error || `فشل الطلب (${response.status}).`, response.status, payload.code);
  }
  return payload;
}

export function getGeminiAuthStatus(): Promise<GeminiAuthStatus> {
  return requestJson<GeminiAuthStatus>('/api/gemini-auth', undefined, false);
}

export function optimizePrompt(request: OptimizePromptRequest, signal?: AbortSignal): Promise<OptimizePromptResponse> {
  return requestJson('/api/optimize-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
}

export function generateVisual(
  request: { prompt: string; model: ModelId; aspectRatio: string; imageSize?: '1K' | '2K' | '4K' },
  signal?: AbortSignal,
): Promise<GenerateVisualResponse> {
  return requestJson('/api/generate-visual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
}

export function getDailyAdvice<T>(): Promise<T> {
  return requestJson<T>('/api/daily-gemini-advice');
}
