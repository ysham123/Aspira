import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAntigravityStream } from './antigravityStream.js';

test('Antigravity stream parser returns the completed response without duplicating deltas', () => {
  const output = [
    JSON.stringify({ event: 'init', conversation_id: 'test' }),
    JSON.stringify({ event: 'step_update', step_update: { text_delta: 'Hello' } }),
    JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'Hello\n' } }),
  ].join('\n');
  assert.deepEqual(parseAntigravityStream(output), { text: 'Hello', error: '' });
});

test('Antigravity stream parser rejects failed and incomplete responses', () => {
  assert.deepEqual(parseAntigravityStream(JSON.stringify({
    event: 'result', result: { status: 'ERROR', error: 'Authentication required.' },
  })), { text: '', error: 'Antigravity did not complete the request.' });
  assert.deepEqual(parseAntigravityStream(''), { text: '', error: 'Antigravity did not complete the request.' });
});
