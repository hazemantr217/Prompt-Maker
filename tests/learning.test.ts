import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createExampleFingerprint,
  inferLearningTags,
  markExamplesUsed,
  rankLearnedExamples,
  reinforceLearnedExample,
  type LearnableExample,
} from '../shared/learning';

const examples: LearnableExample[] = [
  {
    id: 'portrait',
    title: 'تنظيف صورة سيشن',
    request: 'تعديل صورة بنت مع الحفاظ على ملامح الوجه وإضاءة شمس صافية',
    winningPrompt: 'Preserve identity and facial features. Add clean neutral sunlight.',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    successCount: 5,
    useCount: 6,
  },
  {
    id: 'product',
    title: 'تصوير منتج عطر',
    request: 'عبوة عطر على خلفية استوديو',
    winningPrompt: 'Commercial perfume product photograph.',
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
  },
];

test('ranks a semantically relevant example first', () => {
  const ranked = rankLearnedExamples('ايديت صورة بنت مع شمس وخلي الملامح زي ما هي', examples, { now: Date.parse('2026-08-29T00:00:00Z') });
  assert.equal(ranked[0]?.example.id, 'portrait');
  assert.ok(ranked[0]?.matchedTags.includes('portrait'));
});

test('infers multilingual intent tags', () => {
  assert.deepEqual(inferLearningTags('Premium perfume product mockup'), ['product']);
  assert.ok(inferLearningTags('اعمل لوجو وهوية بصرية').includes('branding'));
});

test('reinforces a duplicate instead of adding another example', () => {
  const incoming = {
    title: examples[0].title,
    request: examples[0].request,
    winningPrompt: examples[0].winningPrompt,
    isActive: true,
    successCount: 1,
  };
  const result = reinforceLearnedExample(examples, incoming, '2026-08-29T10:00:00.000Z');
  assert.equal(result.created, false);
  assert.equal(result.examples.length, examples.length);
  assert.equal(result.examples[0].successCount, 6);
});

test('fingerprints are stable after punctuation normalization', () => {
  assert.equal(createExampleFingerprint('Hello!', 'World.'), createExampleFingerprint('hello', 'world'));
});

test('tracks use without mutating unrelated examples', () => {
  const updated = markExamplesUsed(examples, ['product'], '2026-08-29T10:00:00.000Z');
  assert.equal(updated[0].useCount, 6);
  assert.equal(updated[1].useCount, 1);
});
