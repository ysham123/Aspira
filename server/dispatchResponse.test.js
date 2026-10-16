import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createDispatchResponse } from './dispatchResponse.js';

// Run the browser-independent TypeScript logic through the same compiler used by
// the app, without raising the project's Node 20 minimum just for test loading.
async function loadTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { readDispatchResponse } = await loadTypeScript('../src/plugins/models/dispatchStream.ts');
const { createPendingTurn, applyTurnProgress, interruptedTurnResult } = await loadTypeScript('../src/plugins/models/turnProgress.ts');
const { modelConversationContext } = await loadTypeScript('../src/plugins/models/conversationContext.ts');
const receipt = { id: 'action-1', tool: 'workspace.git_status', title: 'Read Git status', status: 'success', output: 'On branch main', durationMs: 12 };

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('streams a real action receipt before the final provider result, including provider failure', async () => {
  let releaseResult;
  const resultGate = new Promise((resolve) => { releaseResult = resolve; });
  let receivedReceipt;
  const receiptGate = new Promise((resolve) => { receivedReceipt = resolve; });
  let finished = false;
  const activities = [];
  await withServer(async (req, res) => {
    const dispatch = createDispatchResponse(req, res);
    dispatch.emit({ type: 'status', phase: 'acting', title: 'Read Git status', actionId: receipt.id });
    dispatch.emit({ type: 'action', action: receipt });
    await resultGate;
    dispatch.complete(503, { source: 'UNAVAILABLE', error: 'Provider disconnected', executedActions: [receipt] });
  }, async (origin) => {
    const response = await fetch(origin, { headers: { Accept: 'application/x-ndjson' } });
    const resultPromise = readDispatchResponse(response, (event) => {
      activities.push(event);
      if (event.type === 'action') receivedReceipt();
    }).then((result) => { finished = true; return result; });
    await receiptGate;
    assert.equal(finished, false);
    assert.deepEqual(activities[1].action, receipt);
    releaseResult();
    const result = await resultPromise;
    assert.equal(result.source, 'UNAVAILABLE');
    assert.deepEqual(result.executedActions, [receipt]);
  });
});

test('keeps the existing JSON response contract and HTTP error status', async () => {
  await withServer((req, res) => {
    const dispatch = createDispatchResponse(req, res);
    dispatch.emit({ type: 'status', phase: 'thinking', title: 'Waiting' });
    dispatch.complete(422, { error: 'Select a model' });
  }, async (origin) => {
    const response = await fetch(origin);
    assert.equal(response.status, 422);
    assert.deepEqual(await readDispatchResponse(response), { error: 'Select a model' });
  });
});

test('decodes fragmented UTF-8 events and a final line without a newline', async () => {
  const bytes = new TextEncoder().encode([
    JSON.stringify({ type: 'status', phase: 'thinking', title: 'Réponse…' }),
    JSON.stringify({ type: 'result', data: { text: 'Ready ✓' } }),
  ].join('\n'));
  const body = new ReadableStream({ start(controller) {
    for (let index = 0; index < bytes.length; index += 3) controller.enqueue(bytes.slice(index, index + 3));
    controller.close();
  } });
  const events = [];
  const result = await readDispatchResponse(new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } }), (event) => events.push(event));
  assert.equal(events[0].title, 'Réponse…');
  assert.equal(result.text, 'Ready ✓');
});

test('reports a truncated stream while keeping already delivered receipts', async () => {
  const events = [];
  const response = new Response(`${JSON.stringify({ type: 'action', action: receipt })}\n`, { headers: { 'Content-Type': 'application/x-ndjson' } });
  await assert.rejects(readDispatchResponse(response, (event) => events.push(event)), /before Aspira received a final response/);
  assert.deepEqual(events[0].action, receipt);
});

test('reports malformed events without losing an earlier action receipt', async () => {
  const events = [];
  const response = new Response(`${JSON.stringify({ type: 'action', action: receipt })}\n{broken}\n`, { headers: { 'Content-Type': 'application/x-ndjson' } });
  await assert.rejects(readDispatchResponse(response, (event) => events.push(event)), /incomplete response event/);
  assert.deepEqual(events[0].action, receipt);
});

test('stopping cancels the stream reader and does not accept a later final result', async () => {
  const abort = new AbortController();
  let canceled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: 'action', action: receipt })}\n${JSON.stringify({ type: 'result', data: { text: 'Too late' } })}\n`));
    },
    cancel() { canceled = true; },
  });
  const response = new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } });
  await assert.rejects(readDispatchResponse(response, () => abort.abort(), abort.signal), { name: 'AbortError' });
  assert.equal(canceled, true);
});

test('a stopped turn preserves returned replies, deduplicates receipts, and distinguishes unfinished actions', () => {
  let turn = createPendingTurn('Read the project files', 'text', [{ id: 'claude', codeName: 'Claude' }]);
  turn = applyTurnProgress(turn, { kind: 'status', modelId: 'claude', phase: 'acting', message: 'Read Git status', actionId: receipt.id });
  turn = applyTurnProgress(turn, { kind: 'action', modelId: 'claude', action: receipt });
  turn = applyTurnProgress(turn, { kind: 'action', modelId: 'claude', action: receipt });
  turn = applyTurnProgress(turn, { kind: 'response', modelId: 'claude', response: { modelId: 'claude', codeName: 'Claude', source: 'PROVIDER_CLI', keyInsight: 'The project is on main.' } });
  turn = applyTurnProgress(turn, { kind: 'status', modelId: 'claude', phase: 'acting', message: 'Read README.md', actionId: 'action-2' });
  const result = interruptedTurnResult(turn, { id: 'code', name: 'Code' }, true);
  assert.equal(result.executedActions.length, 1);
  assert.equal(result.modelStreams[0].keyInsight, 'The project is on main.');
  assert.match(result.synthesizedOutput, /no completion receipt: Read README.md/);
  assert.match(result.synthesizedOutput, /may still finish/);
  assert.equal(result.spokenReply, '');
  assert.equal(result.completionState, 'stopped');
});

test('follow-up context includes completed receipts even when the prior response was stopped', () => {
  let turn = createPendingTurn('Read README.md', 'text', []);
  turn = applyTurnProgress(turn, { kind: 'action', modelId: 'local', action: { ...receipt, title: 'Read README.md', output: 'Startup documentation' } });
  const result = interruptedTurnResult(turn, { id: 'code', name: 'Code' }, true);
  const messages = modelConversationContext([{ ...turn, result }]);
  assert.equal(messages[0].text, 'Read README.md');
  assert.match(messages[1].text, /You stopped this response/);
  assert.match(messages[1].text, /Read README.md \[success\]: Startup documentation/);
});

test('conversation context labels shortened output rather than implying the full receipt was lost', () => {
  const turn = createPendingTurn('Read README.md', 'text', []);
  turn.actions = [{ ...receipt, output: 'x'.repeat(5000) }];
  const result = interruptedTurnResult(turn, { id: 'code', name: 'Code' }, true);
  const messages = modelConversationContext([{ ...turn, result }]);
  assert.match(messages[1].text, /Output excerpt shortened for conversation context/);
  assert.equal(result.executedActions[0].output.length, 5000);
  assert.ok(messages[1].text.length < 2500);
});
