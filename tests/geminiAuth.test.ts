import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { AppError } from '../server/lib/http';
import { hasManagedGeminiKey, resolveGeminiApiKey } from '../server/services/gemini';

const originalGeminiApiKey = process.env.GEMINI_API_KEY;

after(() => {
  if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiApiKey;
});

test('uses the AI Studio/server key when it is injected', () => {
  process.env.GEMINI_API_KEY = 'managed-test-key';
  assert.equal(hasManagedGeminiKey(), true);
  assert.deepEqual(resolveGeminiApiKey('user-test-key'), {
    apiKey: 'managed-test-key',
    managed: true,
  });
});

test('uses a session user key when no managed key exists', () => {
  delete process.env.GEMINI_API_KEY;
  assert.equal(hasManagedGeminiKey(), false);
  assert.deepEqual(resolveGeminiApiKey(' user-test-key '), {
    apiKey: 'user-test-key',
    managed: false,
  });
});

test('requests a user key outside managed environments', () => {
  process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
  assert.throws(
    () => resolveGeminiApiKey(),
    (error: unknown) => error instanceof AppError && error.code === 'AI_KEY_REQUIRED' && error.status === 401,
  );
});

test('rejects header injection in a supplied user key', () => {
  delete process.env.GEMINI_API_KEY;
  assert.throws(
    () => resolveGeminiApiKey('valid-part\r\nx-injected: value'),
    (error: unknown) => error instanceof AppError && error.code === 'AI_KEY_INVALID',
  );
});
