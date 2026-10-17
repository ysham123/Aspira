import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCodexAppServerTurn } from './codexAppServer.js';

function createFakeCodex(temporary) {
  const binary = path.join(temporary, 'codex-mock');
  const log = path.join(temporary, 'protocol.jsonl');
  const script = `#!${process.execPath}
import fs from 'node:fs';
let buffer = '';
let nextTool = 0;
let requestedTools = 0;
const threadId = 'thread-mock';
const send = (message) => process.stdout.write(JSON.stringify(message) + '\\n');
const log = (message) => fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify(message) + '\\n');
const calls = Number(process.env.MOCK_TOOL_CALLS || 0);
const finish = () => {
  send({ method: 'item/agentMessage/delta', params: { threadId, turnId: 'turn-mock', itemId: 'item-mock', delta: 'Mock streamed answer.' } });
  send({ method: 'turn/completed', params: { threadId, turn: { status: 'completed' } } });
};
const requestTool = () => {
  const id = 1000 + nextTool++;
  requestedTools += 1;
  send({ id, method: 'item/tool/call', params: { threadId, turnId: 'turn-mock', callId: 'call-' + id, namespace: 'aspira', tool: 'workspace_git_status', arguments: {} } });
};
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  let boundary;
  while ((boundary = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 1);
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    log(message);
    if (message.method === 'initialize') send({ id: message.id, result: {} });
    else if (message.method === 'thread/start' || message.method === 'thread/resume') {
      send({ id: message.id, result: { thread: { id: message.params.threadId || threadId } } });
    } else if (message.method === 'turn/start') {
      send({ id: message.id, result: { turn: { id: 'turn-mock' } } });
      if (calls > 0) requestTool(); else finish();
    } else if (message.id >= 1000 && message.result) {
      if (requestedTools < calls) requestTool(); else finish();
    }
  }
});
`;
  fs.writeFileSync(binary, script, { mode: 0o700 });
  fs.chmodSync(binary, 0o700);
  return { binary, log };
}

function readLog(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

test('Codex app-server streams a reply, routes structured tools, caps actions, and resumes its saved thread', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'aspira-codex-test-'));
  try {
    const { binary, log: logFile } = createFakeCodex(temporary);
    const sessionFile = path.join(temporary, 'data', 'sessions.json');
    const env = { PATH: process.env.PATH, HOME: temporary, MOCK_LOG: logFile, MOCK_TOOL_CALLS: '4' };
    const actions = [];
    const deltas = [];
    const first = await runCodexAppServerTurn({
      binary, sessionFile, conversationId: 'chat-1', cwd: temporary,
      systemPrompt: 'Answer naturally.', prompt: 'Check the repo status.', allowActions: true, env,
      executeTool: async ({ tool }) => ({ tool, status: 'success', title: 'Git status', output: 'main, clean' }),
      onAction: (action) => actions.push(action), onDelta: (delta) => deltas.push(delta),
    });
    assert.equal(first.text, 'Mock streamed answer.');
    assert.equal(actions.length, 3);
    assert.deepEqual(deltas, ['Mock streamed answer.']);
    assert.equal(fs.statSync(sessionFile).mode & 0o777, 0o600);

    const firstLog = readLog(logFile);
    const threadStart = firstLog.find((message) => message.method === 'thread/start');
    assert.equal(threadStart.params.sandbox, 'read-only');
    assert.deepEqual(threadStart.params.runtimeWorkspaceRoots, [temporary]);
    assert.equal(threadStart.params.dynamicTools[0].tools.length, 11);
    const toolReplies = firstLog.filter((message) => message.id >= 1000 && message.result);
    assert.equal(toolReplies.length, 4);
    assert.equal(toolReplies[3].result.success, false);
    assert.match(toolReplies[3].result.contentItems[0].text, /limits each provider turn to 3/);

    await runCodexAppServerTurn({
      binary, sessionFile, conversationId: 'chat-1', cwd: temporary,
      systemPrompt: 'Answer naturally.', prompt: 'Continue.', allowActions: false, env,
      executeTool: async () => { throw new Error('A disallowed action must not execute.'); },
    });
    const log = readLog(path.join(temporary, 'protocol.jsonl'));
    assert.equal(log.filter((message) => message.method === 'thread/start').length, 1);
    assert.equal(log.filter((message) => message.method === 'thread/resume').length, 1);
    const deniedReply = log.filter((message) => message.id >= 1000 && message.result).at(-1);
    assert.equal(deniedReply.result.success, false);
    assert.match(deniedReply.result.contentItems[0].text, /not available for the current Aspira turn/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
