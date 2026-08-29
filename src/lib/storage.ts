import { DEFAULT_LEARNED_EXAMPLES } from '../data/defaultExamples';
import type { LearnedExample, SavedPrompt } from '../types';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_IMAGE_MODEL,
  isChatModelId,
  isModelId,
} from '../../shared/models';

const HISTORY_KEY = 'prompt_maker.history.v2';
const LEARNING_KEY = 'prompt_maker.learning.v2';
const LEGACY_HISTORY_KEY = 'gipm_history';
const LEGACY_LEARNING_KEY = 'gemini_ml_examples';
const MAX_HISTORY_ITEMS = 100;
const MAX_LEARNING_ITEMS = 150;
const MAX_PERSISTED_IMAGE_LENGTH = 300_000;

function readArray(key: string): unknown[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function migratePrompt(value: unknown): SavedPrompt | null {
  if (!value || typeof value !== 'object') return null;
  const prompt = value as Partial<SavedPrompt>;
  if (typeof prompt.id !== 'string' || typeof prompt.original !== 'string' || typeof prompt.optimized !== 'string') return null;

  return {
    ...prompt,
    id: prompt.id,
    original: prompt.original,
    optimized: prompt.optimized,
    model: isModelId(prompt.model) ? prompt.model : DEFAULT_IMAGE_MODEL,
    chatModel: isChatModelId(prompt.chatModel) ? prompt.chatModel : DEFAULT_CHAT_MODEL,
    aspect_ratio: typeof prompt.aspect_ratio === 'string' ? prompt.aspect_ratio : '16:9',
    creativity: typeof prompt.creativity === 'number' ? Math.min(1, Math.max(0, prompt.creativity)) : 0.65,
    timestamp: typeof prompt.timestamp === 'string' ? prompt.timestamp : '',
  };
}

function migrateExample(value: unknown): LearnedExample | null {
  if (!value || typeof value !== 'object') return null;
  const example = value as Partial<LearnedExample>;
  if (
    typeof example.id !== 'string'
    || typeof example.title !== 'string'
    || typeof example.request !== 'string'
    || typeof example.winningPrompt !== 'string'
  ) return null;

  return {
    id: example.id,
    title: example.title.slice(0, 160),
    request: example.request.slice(0, 4_000),
    winningPrompt: example.winningPrompt.slice(0, 20_000),
    notes: typeof example.notes === 'string' ? example.notes.slice(0, 2_000) : undefined,
    images: Array.isArray(example.images)
      ? example.images.filter((image): image is string => typeof image === 'string').slice(0, 3)
      : undefined,
    isActive: example.isActive !== false,
    createdAt: typeof example.createdAt === 'string' ? example.createdAt : new Date().toISOString(),
    tags: Array.isArray(example.tags) ? example.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 12) : undefined,
    useCount: typeof example.useCount === 'number' ? Math.max(0, Math.floor(example.useCount)) : 0,
    successCount: typeof example.successCount === 'number' ? Math.max(0, Math.floor(example.successCount)) : 0,
    lastUsedAt: typeof example.lastUsedAt === 'string' ? example.lastUsedAt : undefined,
  };
}

export function loadPromptHistory(): SavedPrompt[] {
  const stored = readArray(HISTORY_KEY) ?? readArray(LEGACY_HISTORY_KEY) ?? [];
  return stored.map(migratePrompt).filter((item): item is SavedPrompt => item !== null).slice(0, MAX_HISTORY_ITEMS);
}

export function savePromptHistory(history: SavedPrompt[]): void {
  const bounded = history.slice(0, MAX_HISTORY_ITEMS).map((item, index) => ({
    ...item,
    referenceImage: index < 3 && item.referenceImage?.length && item.referenceImage.length <= MAX_PERSISTED_IMAGE_LENGTH
      ? item.referenceImage
      : undefined,
    referenceImages: index < 3
      ? item.referenceImages?.filter((image) => image.length <= MAX_PERSISTED_IMAGE_LENGTH).slice(0, 2)
      : undefined,
    imageUrl: item.imageUrl?.startsWith('data:') ? undefined : item.imageUrl,
  }));

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(bounded));
    localStorage.removeItem(LEGACY_HISTORY_KEY);
  } catch {
    const textOnly = bounded.map(({ referenceImage: _referenceImage, referenceImages: _referenceImages, ...item }) => item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(textOnly));
  }
}

export function loadLearnedExamples(): LearnedExample[] {
  const stored = readArray(LEARNING_KEY) ?? readArray(LEGACY_LEARNING_KEY);
  if (!stored) return DEFAULT_LEARNED_EXAMPLES;
  const migrated = stored.map(migrateExample).filter((item): item is LearnedExample => item !== null);
  return migrated.length > 0 ? migrated.slice(0, MAX_LEARNING_ITEMS) : DEFAULT_LEARNED_EXAMPLES;
}

export function saveLearnedExamples(examples: LearnedExample[]): void {
  const bounded = examples.slice(0, MAX_LEARNING_ITEMS).map((example) => ({
    ...example,
    images: example.images?.filter((image) => image.length <= MAX_PERSISTED_IMAGE_LENGTH).slice(0, 1),
  }));

  try {
    localStorage.setItem(LEARNING_KEY, JSON.stringify(bounded));
    localStorage.removeItem(LEGACY_LEARNING_KEY);
  } catch {
    localStorage.setItem(LEARNING_KEY, JSON.stringify(bounded.map(({ images: _images, ...example }) => example)));
  }
}
