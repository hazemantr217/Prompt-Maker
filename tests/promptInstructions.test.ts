import assert from 'node:assert/strict';
import test from 'node:test';
import { SYSTEM_PROMPT } from '../server/routes/optimizePrompt';

test('requires silent intent analysis and a final compliance pass', () => {
  assert.match(SYSTEM_PROMPT, /SILENT INTENT ANALYSIS/);
  assert.match(SYSTEM_PROMPT, /silent compliance pass/i);
  assert.match(SYSTEM_PROMPT, /every explicit requirement/i);
});

test('separates protected elements from requested image edits', () => {
  assert.match(SYSTEM_PROMPT, /LOCKED ELEMENTS/);
  assert.match(SYSTEM_PROMPT, /EDITABLE ELEMENTS/);
  assert.match(SYSTEM_PROMPT, /facial geometry/);
  assert.match(SYSTEM_PROMPT, /what must remain untouched/i);
});

test('enforces detailed but non-repetitive production prompts', () => {
  assert.match(SYSTEM_PROMPT, /250–600 English words/);
  assert.match(SYSTEM_PROMPT, /concrete, measurable visual language/i);
  assert.match(SYSTEM_PROMPT, /Detail must improve control, not merely length/i);
});

test('preserves literal copy and prevents invented business data', () => {
  assert.match(SYSTEM_PROMPT, /wording exactly inside quotation marks/i);
  assert.match(SYSTEM_PROMPT, /Never invent names, prices, phone numbers, dates/i);
  assert.match(SYSTEM_PROMPT, /character-for-character accurate/i);
});
