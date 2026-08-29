export interface LearnableExample {
  id: string;
  title: string;
  request: string;
  winningPrompt: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  tags?: string[];
  useCount?: number;
  successCount?: number;
  lastUsedAt?: string;
}

export interface RankedExample<T extends LearnableExample> {
  example: T;
  score: number;
  matchedTags: string[];
}

const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const NON_WORDS = /[^\p{L}\p{N}\s]/gu;
const SPACE = /\s+/g;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'to', 'for', 'of', 'in', 'on', 'with', 'is', 'are', 'make', 'create',
  'عايز', 'عايزه', 'اريد', 'أريد', 'اعمل', 'اعملي', 'صورة', 'صوره', 'تصميم', 'من', 'في', 'على', 'مع', 'او', 'أو', 'و',
]);

const INTENT_KEYWORDS: Record<string, string[]> = {
  portrait: ['portrait', 'face', 'skin', 'girl', 'woman', 'man', 'طفل', 'بنت', 'ولد', 'وجه', 'بشرة', 'سيشن', 'تصوير'],
  product: ['product', 'packaging', 'bottle', 'perfume', 'mockup', 'منتج', 'عبوة', 'زجاجة', 'عطر', 'موكاب'],
  food: ['food', 'restaurant', 'menu', 'bread', 'bakery', 'meat', 'طعام', 'مطعم', 'منيو', 'مخبز', 'عيش', 'لحوم'],
  branding: ['logo', 'brand', 'identity', 'signage', 'شعار', 'لوجو', 'هوية', 'يافطة', 'لافتة'],
  invitation: ['wedding', 'invitation', 'engagement', 'ceremony', 'دعوة', 'زفاف', 'فرح', 'خطوبة', 'قران'],
  architecture: ['architecture', 'interior', 'building', 'villa', 'room', 'معماري', 'ديكور', 'مبنى', 'فيلا', 'غرفة'],
  social: ['poster', 'banner', 'advertisement', 'social media', 'بوستر', 'بنر', 'اعلان', 'إعلان', 'سوشيال'],
  photo_edit: ['edit', 'retouch', 'cleanup', 'sunlight', 'background', 'ايديت', 'تعديل', 'تنظيف', 'شمس', 'خلفية'],
};

export function normalizeLearningText(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(NON_WORDS, ' ')
    .replace(SPACE, ' ')
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(
    normalizeLearningText(value)
      .split(' ')
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
  );
}

export function inferLearningTags(value: string): string[] {
  const normalized = ` ${normalizeLearningText(value)} `;
  return Object.entries(INTENT_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(` ${normalizeLearningText(keyword)} `)))
    .map(([tag]) => tag);
}

function weightedJaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) intersection += token.length >= 6 ? 1.35 : 1;
  });
  return intersection / Math.max(1, left.size + right.size - intersection);
}

function qualityScore(example: LearnableExample): number {
  const uses = Math.max(0, example.useCount ?? 0);
  const successes = Math.max(0, example.successCount ?? 0);
  const confidence = (successes + 1) / (uses + 2);
  const evidence = Math.min(1, Math.log2(uses + 1) / 4);
  return confidence * 0.75 + evidence * 0.25;
}

function recencyScore(example: LearnableExample, now: number): number {
  const timestamp = Date.parse(example.lastUsedAt || example.createdAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now - timestamp) / 86_400_000);
  return Math.exp(-ageDays / 120);
}

function similarityBetweenExamples(left: LearnableExample, right: LearnableExample): number {
  return weightedJaccard(tokens(`${left.request} ${left.title}`), tokens(`${right.request} ${right.title}`));
}

export function rankLearnedExamples<T extends LearnableExample>(
  query: string,
  examples: T[],
  options: { maxExamples?: number; maxCharacters?: number; now?: number } = {},
): RankedExample<T>[] {
  const maxExamples = Math.max(1, Math.min(options.maxExamples ?? 4, 8));
  const maxCharacters = Math.max(2_000, options.maxCharacters ?? 14_000);
  const now = options.now ?? Date.now();
  const queryTokens = tokens(query);
  const queryTags = inferLearningTags(query);

  const candidates = examples
    .filter((example) => example.isActive && example.request.trim() && example.winningPrompt.trim())
    .map((example) => {
      const exampleTags = Array.from(new Set([...(example.tags ?? []), ...inferLearningTags(`${example.title} ${example.request}`)]));
      const matchedTags = queryTags.filter((tag) => exampleTags.includes(tag));
      const semantic = weightedJaccard(queryTokens, tokens(`${example.title} ${example.request} ${example.notes ?? ''}`));
      const intent = queryTags.length > 0 ? matchedTags.length / queryTags.length : 0;
      const quality = qualityScore(example);
      const recency = recencyScore(example, now);
      const score = semantic * 0.52 + intent * 0.25 + quality * 0.18 + recency * 0.05;
      return { example, score, matchedTags };
    })
    .sort((left, right) => right.score - left.score || right.example.createdAt.localeCompare(left.example.createdAt));

  const selected: RankedExample<T>[] = [];
  let usedCharacters = 0;

  while (selected.length < maxExamples && candidates.length > 0) {
    let bestIndex = -1;
    let bestMmr = Number.NEGATIVE_INFINITY;

    candidates.forEach((candidate, index) => {
      const size = candidate.example.request.length + candidate.example.winningPrompt.length + (candidate.example.notes?.length ?? 0);
      if (usedCharacters + size > maxCharacters && selected.length > 0) return;
      const redundancy = selected.length === 0
        ? 0
        : Math.max(...selected.map((chosen) => similarityBetweenExamples(candidate.example, chosen.example)));
      const mmr = candidate.score * 0.82 - redundancy * 0.18;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIndex = index;
      }
    });

    if (bestIndex < 0) break;
    const [best] = candidates.splice(bestIndex, 1);
    selected.push(best);
    usedCharacters += best.example.request.length + best.example.winningPrompt.length + (best.example.notes?.length ?? 0);
  }

  return selected;
}

export function createExampleFingerprint(request: string, winningPrompt: string): string {
  const input = normalizeLearningText(`${request}|${winningPrompt}`);
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function reinforceLearnedExample<T extends LearnableExample>(
  examples: T[],
  incoming: Omit<T, 'id' | 'createdAt'>,
  now = new Date().toISOString(),
): { examples: T[]; id: string; created: boolean } {
  const fingerprint = createExampleFingerprint(incoming.request, incoming.winningPrompt);
  const existingIndex = examples.findIndex(
    (example) => createExampleFingerprint(example.request, example.winningPrompt) === fingerprint,
  );

  if (existingIndex >= 0) {
    const existing = examples[existingIndex];
    const updated = {
      ...existing,
      ...incoming,
      isActive: true,
      successCount: (existing.successCount ?? 0) + 1,
      lastUsedAt: now,
    } as T;
    return {
      examples: examples.map((example, index) => (index === existingIndex ? updated : example)),
      id: existing.id,
      created: false,
    };
  }

  const id = `learn-${Date.parse(now) || Date.now()}-${fingerprint}`;
  const created = {
    ...incoming,
    id,
    createdAt: now,
    tags: Array.from(new Set([...(incoming.tags ?? []), ...inferLearningTags(`${incoming.title} ${incoming.request}`)])),
    useCount: 0,
    successCount: Math.max(1, incoming.successCount ?? 1),
    lastUsedAt: now,
  } as T;

  return { examples: [created, ...examples], id, created: true };
}

export function markExamplesUsed<T extends LearnableExample>(examples: T[], selectedIds: string[], now = new Date().toISOString()): T[] {
  const selected = new Set(selectedIds);
  return examples.map((example) => (
    selected.has(example.id)
      ? { ...example, useCount: (example.useCount ?? 0) + 1, lastUsedAt: now }
      : example
  ));
}
