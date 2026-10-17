import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClaudeStream } from './claudeStream.js';

test('Claude stream parser returns the final response without duplicating streamed text', () => {
  const output = [
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } }),
    JSON.stringify({ type: 'result', is_error: false, result: 'Hello from Claude.' }),
  ].join('\n');
  assert.deepEqual(parseClaudeStream(output), { text: 'Hello from Claude.', error: '' });
});

test('Claude stream parser turns account limits and sign-in failures into clear status messages', () => {
  assert.deepEqual(parseClaudeStream(JSON.stringify({
    type: 'result', is_error: true, api_error_status: 429, result: "You've hit your weekly limit.",
  })), {
    text: '',
    error: 'Claude has reached its current usage limit. Wait for the reset or use an API key.',
  });
  assert.deepEqual(parseClaudeStream(JSON.stringify({
    type: 'result', is_error: true, api_error_status: 401, result: 'Authentication required.',
  })), {
    text: '',
    error: 'Claude Code is not signed in. Finish sign-in, then retry.',
  });
});

test('Claude stream parser handles incomplete and unsuccessful output', () => {
  assert.deepEqual(parseClaudeStream(''), { text: '', error: 'Claude Code did not complete the request.' });
  assert.deepEqual(parseClaudeStream(JSON.stringify({ type: 'result', is_error: false, result: '' })), {
    text: '', error: 'Claude Code completed without a text response.',
  });
});
