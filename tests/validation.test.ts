import assert from 'node:assert/strict';
import test from 'node:test';
import { generateVisualSchema, optimizePromptSchema, parseAspectRatioFromText } from '../server/lib/validation';
import { IMAGE_MODEL_IDS, isModelId } from '../shared/models';

test('removes deprecated Imagen models from the runtime registry', () => {
  assert.deepEqual(IMAGE_MODEL_IDS, ['Nano Banana 2', 'Nano Banana Pro', 'Nano Banana']);
  assert.equal(isModelId('Imagen 4'), false);
});

test('detects Arabic digits in aspect ratios', () => {
  assert.equal(parseAspectRatioFromText('عايز التصميم بأبعاد ٤:١'), '4:1');
  assert.equal(parseAspectRatioFromText('portrait 9/16'), '9:16');
});

test('rejects an unsupported image model', () => {
  const result = generateVisualSchema.safeParse({ prompt: 'test', model: 'Imagen 4' });
  assert.equal(result.success, false);
});

test('requires text or a valid image for optimization', () => {
  const result = optimizePromptSchema.safeParse({ model: 'Nano Banana 2' });
  assert.equal(result.success, false);
});
