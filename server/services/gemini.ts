import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import { AppError } from '../lib/http';
import type { ChatModelApiId } from '../../shared/models';

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AppError(503, 'مفتاح Gemini API غير مُعد على الخادم.', 'AI_NOT_CONFIGURED');
  }
  client ??= new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'prompt-maker/2.0' } },
  });
  return client;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    if ('status' in error && typeof error.status === 'number') return error.status;
    if ('code' in error && typeof error.code === 'number') return error.code;
  }
  const match = errorMessage(error).match(/\b(4\d\d|5\d\d)\b/);
  return match ? Number(match[1]) : null;
}

function isRetryable(error: unknown): boolean {
  const status = errorStatus(error);
  if (status !== null) return status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
  return /timeout|econnreset|unavailable|overloaded/i.test(errorMessage(error));
}

function isModelUnavailable(error: unknown): boolean {
  const status = errorStatus(error);
  return status === 404 || status === 503 || /model.*(?:not found|unavailable)/i.test(errorMessage(error));
}

async function retryTransient<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt) + Math.floor(Math.random() * 150)));
    }
  }
  throw lastError;
}

function toPublicError(error: unknown): AppError {
  const status = errorStatus(error);
  if (status === 429) return new AppError(429, 'تم تجاوز حصة Gemini مؤقتًا. انتظر قليلًا أو راجع حدود مشروعك.', 'AI_RATE_LIMIT');
  if (status === 401 || status === 403) return new AppError(503, 'مفتاح Gemini غير صالح أو لا يملك صلاحية استخدام هذا الموديل.', 'AI_PERMISSION');
  if (status === 400) return new AppError(400, 'Gemini رفض الطلب بسبب بيانات أو إعدادات غير مدعومة.', 'AI_BAD_REQUEST');
  return new AppError(502, 'تعذر الحصول على استجابة من Gemini حاليًا.', 'AI_UNAVAILABLE');
}

export async function generateTextWithFallback(
  requestedModel: ChatModelApiId,
  parameters: Omit<GenerateContentParameters, 'model'>,
): Promise<GenerateContentResponse> {
  const fallbacks: ChatModelApiId[] = ['gemini-3.7-flash', 'gemini-3.1-flash-lite'];
  const queue = Array.from(new Set<ChatModelApiId>([requestedModel, ...fallbacks]));
  let lastError: unknown;

  for (const model of queue) {
    try {
      return await retryTransient(() => getClient().models.generateContent({ ...parameters, model }));
    } catch (error) {
      lastError = error;
      if (!isModelUnavailable(error)) throw toPublicError(error);
    }
  }
  throw toPublicError(lastError);
}

export async function generateImage(parameters: GenerateContentParameters): Promise<GenerateContentResponse> {
  try {
    return await retryTransient(() => getClient().models.generateContent(parameters));
  } catch (error) {
    throw toPublicError(error);
  }
}
