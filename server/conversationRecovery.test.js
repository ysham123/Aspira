import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './typeScriptTestUtils.js';

const {
  readTurnCheckpoints, writeTurnCheckpoint, recoverConversationHistory, persistConversationHistory,
  readConversationDraft, writeConversationDraft, TURN_RECOVERY_STORAGE_KEY,
} = await loadTypeScript('../src/plugins/models/conversationRecovery.ts');
const { readConversationHistory, CONVERSATION_HISTORY_STORAGE_KEY } = await loadTypeScript('../src/plugins/models/conversationHistory.ts');
const { createPendingTurn, applyTurnProgress, interruptedTurnResult } = await loadTypeScript('../src/plugins/models/turnProgress.ts');

class MemoryStorage {
  data = new Map();
  failWrites = false;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error('Quota exceeded');
    this.data.set(key, value);
  }
  removeItem(key) {
    if (this.failWrites) throw new Error('Storage blocked');
    this.data.delete(key);
  }
}
const emptyHistory = () => ({ activeId: null, conversations: [] });
const receipt = { id: 'receipt-1', tool: 'workspace.read_file', title: 'Read README.md', status: 'success', output: '# Aspira', durationMs: 2 };
function checkpoint(id = 'conversation-1') {
  let pending = createPendingTurn('Read README.md and package.json', 'text', []);
  pending = applyTurnProgress(pending, { kind: 'action', modelId: 'local', action: receipt });
  pending = applyTurnProgress(pending, { kind: 'status', modelId: 'local', phase: 'acting', message: 'Read package.json', actionId: 'reading-package' });
  return { conversationId: id, title: 'Project startup', updatedAt: '2026-10-16T23:00:00.000Z', completedTurns: [], capability: { id: 'code', name: 'Code' }, pending };
}
function completedTurn(record, text = 'The app starts with npm run dev.') {
  return { id: record.pending.id, userText: record.pending.userText, timestamp: record.pending.timestamp, inputModality: 'text',
    result: { ...interruptedTurnResult(record.pending, record.capability, false), completionState: undefined, synthesizedOutput: text } };
}

test('reload restores an unfinished first turn with receipts and unconfirmed action outcomes', () => {
  const tabStorage = new MemoryStorage();
  const record = checkpoint();
  assert.equal(writeTurnCheckpoint(record, tabStorage), true);
  const restored = recoverConversationHistory(emptyHistory(), readTurnCheckpoints(tabStorage));
  const turn = restored.conversations[0].turns[0];
  assert.equal(restored.activeId, record.conversationId);
  assert.equal(turn.id, record.pending.id);
  assert.equal(turn.result.completionState, 'interrupted');
  assert.deepEqual(turn.result.executedActions, [receipt]);
  assert.match(turn.result.synthesizedOutput, /task has not been rerun/);
  assert.match(turn.result.synthesizedOutput, /no completion receipt: Read package.json/);
});

test('reload retains a received model reply while another provider was still responding', () => {
  const record = checkpoint();
  record.pending = applyTurnProgress(record.pending, { kind: 'response', modelId: 'claude', response: { modelId: 'claude', codeName: 'Claude', source: 'PROVIDER_CLI', keyInsight: 'A real answer already received.' } });
  const tabStorage = new MemoryStorage();
  writeTurnCheckpoint(record, tabStorage);
  const restored = recoverConversationHistory(emptyHistory(), readTurnCheckpoints(tabStorage));
  const result = restored.conversations[0].turns[0].result;
  assert.match(result.synthesizedOutput, /A real answer already received/);
  assert.equal(result.modelStreams[0].source, 'PROVIDER_CLI');
});

test('a final answer survives reload between completion and chat-history persistence', () => {
  const record = checkpoint();
  record.finalTurn = completedTurn(record);
  const restored = recoverConversationHistory(emptyHistory(), [record]);
  assert.equal(restored.conversations[0].turns[0].result.synthesizedOutput, record.finalTurn.result.synthesizedOutput);
  assert.equal(restored.conversations[0].turns[0].result.completionState, undefined);
  const again = recoverConversationHistory(restored, [record]);
  assert.equal(again.conversations[0].turns.length, 1);
});

test('failed chat-history writes retain the recovery journal until a later successful save', () => {
  const tabStorage = new MemoryStorage();
  const historyStorage = new MemoryStorage();
  const record = checkpoint();
  writeTurnCheckpoint(record, tabStorage);
  const restored = recoverConversationHistory(emptyHistory(), [record]);
  historyStorage.failWrites = true;
  assert.equal(persistConversationHistory(restored, historyStorage, tabStorage), false);
  assert.equal(readTurnCheckpoints(tabStorage).length, 1);
  historyStorage.failWrites = false;
  assert.equal(persistConversationHistory(restored, historyStorage, tabStorage), true);
  assert.equal(readTurnCheckpoints(tabStorage).length, 0);
  assert.equal(readConversationHistory(historyStorage).conversations[0].turns[0].id, record.pending.id);
});

test('a stale checkpoint cannot overwrite the final answer already saved for that turn', () => {
  const record = checkpoint();
  const finalTurn = completedTurn(record, 'Authoritative final answer');
  const history = { activeId: record.conversationId, conversations: [{ id: record.conversationId, title: 'Saved', updatedAt: record.updatedAt, turns: [finalTurn] }] };
  const restored = recoverConversationHistory(history, [record]);
  assert.equal(restored.conversations[0].turns[0].result.synthesizedOutput, 'Authoritative final answer');
  assert.equal(restored.conversations[0].turns.length, 1);
});

test('journaling another conversation does not discard earlier unsaved work', () => {
  const tabStorage = new MemoryStorage();
  const first = checkpoint('first');
  first.finalTurn = completedTurn(first);
  const second = checkpoint('second');
  second.updatedAt = '2026-10-16T23:01:00.000Z';
  writeTurnCheckpoint(first, tabStorage);
  writeTurnCheckpoint(second, tabStorage);
  const restored = recoverConversationHistory(emptyHistory(), readTurnCheckpoints(tabStorage));
  assert.equal(restored.conversations.length, 2);
  assert.equal(restored.activeId, 'second');
  assert.equal(restored.conversations.find((conversation) => conversation.id === 'first').turns[0].result.completionState, undefined);
});

test('checkpoint acknowledgement is scoped to the conversation even if turn IDs coincide', () => {
  const tabStorage = new MemoryStorage();
  const historyStorage = new MemoryStorage();
  const first = checkpoint('first');
  const second = checkpoint('second');
  second.pending.id = first.pending.id;
  writeTurnCheckpoint(first, tabStorage);
  writeTurnCheckpoint(second, tabStorage);
  assert.equal(readTurnCheckpoints(tabStorage).length, 2);
  persistConversationHistory(recoverConversationHistory(emptyHistory(), [first]), historyStorage, tabStorage);
  assert.equal(readTurnCheckpoints(tabStorage).length, 1);
  assert.equal(readTurnCheckpoints(tabStorage)[0].conversationId, 'second');
});

test('drafts remain separate across chats and clearing one leaves the other intact', () => {
  const tabStorage = new MemoryStorage();
  writeConversationDraft('first', 'First draft', tabStorage);
  writeConversationDraft('second', 'Second draft', tabStorage);
  writeConversationDraft(null, 'Unsent new chat', tabStorage);
  writeConversationDraft('first', '', tabStorage);
  assert.equal(readConversationDraft('first', tabStorage), '');
  assert.equal(readConversationDraft('second', tabStorage), 'Second draft');
  assert.equal(readConversationDraft(null, tabStorage), 'Unsent new chat');
  tabStorage.failWrites = true;
  assert.equal(writeConversationDraft('second', 'Unsaved change', tabStorage), false);
  assert.equal(readConversationDraft('second', tabStorage), 'Second draft');
});

test('malformed recovery data is ignored and legacy readable chat turns remain usable', () => {
  const tabStorage = new MemoryStorage();
  tabStorage.setItem(TURN_RECOVERY_STORAGE_KEY, '{broken');
  assert.deepEqual(readTurnCheckpoints(tabStorage), []);
  const historyStorage = new MemoryStorage();
  historyStorage.setItem(CONVERSATION_HISTORY_STORAGE_KEY, JSON.stringify({ activeId: null, conversations: [{ id: 'legacy', title: 'Legacy chat', updatedAt: '2026-10-16', turns: [
    { id: 'old-turn', userText: 'Hello', result: { synthesizedOutput: 'A preserved answer', modelStreams: null, executedActions: null } },
    { invalid: true },
  ] }] }));
  const history = readConversationHistory(historyStorage);
  assert.equal(history.activeId, null);
  assert.equal(history.conversations[0].turns.length, 1);
  assert.deepEqual(history.conversations[0].turns[0].result.executedActions, []);
  assert.deepEqual(history.conversations[0].turns[0].result.modelStreams, []);
});
