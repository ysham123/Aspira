import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './typeScriptTestUtils.js';

const [{ runPantheonSynergy }, { BUILTIN_MODEL_PLUGINS, CAPABILITY_MATRIX }] = await Promise.all([
  loadTypeScript('../src/plugins/models/synergyEngine.ts'),
  loadTypeScript('../src/plugins/models/manifest.ts'),
]);

function response(data) {
  return new Response(`${JSON.stringify({ type: 'result', data })}\n`, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

function providerReply(modelId, text) {
  return {
    source: 'PROVIDER_CLI', modelId, text, latencyMs: 1,
    executedActions: [], memories: [],
  };
}

test('multiple model replies are combined by one tool-disabled synthesis request', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    if (body.prompt.startsWith('Original request:')) {
      return response(providerReply(body.modelId, 'One conversational answer using both useful points.'));
    }
    const text = body.modelId === 'argon' ? 'Gemini perspective with evidence.' : 'Claude perspective with a caveat.';
    return response(providerReply(body.modelId, text));
  };

  try {
    const result = await runPantheonSynergy({
      prompt: 'Compare these ideas and recommend one.',
      capabilityId: CAPABILITY_MATRIX[0].id,
      synergyMode: 'fusion',
      awakeModels: [BUILTIN_MODEL_PLUGINS[0], BUILTIN_MODEL_PLUGINS[1]],
      apiKeys: {},
      conversationId: 'test-conversation',
    });

    assert.equal(requests.length, 3);
    assert.deepEqual(requests.map((request) => request.executeActions), [true, false, false]);
    assert.match(requests[2].prompt, /Gemini perspective with evidence/);
    assert.match(requests[2].prompt, /Claude perspective with a caveat/);
    assert.equal(result.synthesisStatus, 'complete');
    assert.equal(result.synthesisProviderId, 'argon');
    assert.equal(result.modelStreams.length, 2);
    assert.equal(result.synthesizedOutput, 'One conversational answer using both useful points.');
    assert.match(result.executiveHeadline, /combined by Gemini/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failed synthesis preserves every individual reply and labels the fallback', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.prompt.startsWith('Original request:')) {
      return response({ source: 'UNAVAILABLE', modelId: body.modelId, text: null, error: 'Synthesis provider unavailable.' });
    }
    const text = body.modelId === 'argon' ? 'First full answer.' : 'Second full answer.';
    return response(providerReply(body.modelId, text));
  };

  try {
    const result = await runPantheonSynergy({
      prompt: 'Compare these answers.',
      capabilityId: CAPABILITY_MATRIX[0].id,
      synergyMode: 'fusion',
      awakeModels: [BUILTIN_MODEL_PLUGINS[0], BUILTIN_MODEL_PLUGINS[1]],
      apiKeys: {},
    });

    assert.equal(result.synthesisStatus, 'unavailable');
    assert.match(result.synthesizedOutput, /First full answer/);
    assert.match(result.synthesizedOutput, /Second full answer/);
    assert.match(result.executiveHeadline, /individual agent replies/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('one selected model receives no extra synthesis request', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (_url, init) => {
    requests += 1;
    const body = JSON.parse(init.body);
    return response(providerReply(body.modelId, 'A direct answer.'));
  };

  try {
    const result = await runPantheonSynergy({
      prompt: 'Answer this directly.',
      capabilityId: CAPABILITY_MATRIX[0].id,
      synergyMode: 'fusion',
      awakeModels: [BUILTIN_MODEL_PLUGINS[0]],
      apiKeys: {},
    });

    assert.equal(requests, 1);
    assert.equal(result.synthesisStatus, undefined);
    assert.equal(result.synthesizedOutput, 'A direct answer.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
