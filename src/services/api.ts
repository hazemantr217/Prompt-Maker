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

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({ error: 'استجابة غير صالحة من الخادم.' })) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || `فشل الطلب (${response.status}).`);
  return payload;
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
