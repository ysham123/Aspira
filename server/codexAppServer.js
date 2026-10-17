import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TOOL_DEFINITIONS = [
  { name: 'workspace_git_status', tool: 'workspace.git_status', description: 'Read the current Git branch and working tree status.', schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'workspace_list_files', tool: 'workspace.list_files', description: 'List non-hidden project files under a relative folder.', schema: { type: 'object', properties: { path: { type: 'string' } }, additionalProperties: false } },
  { name: 'workspace_search_text', tool: 'workspace.search_text', description: 'Search readable project source and documentation.', schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } },
  { name: 'workspace_read_file', tool: 'workspace.read_file', description: 'Read a numbered page of a project text file.', schema: { type: 'object', properties: { path: { type: 'string' }, startLine: { type: 'integer' }, startColumn: { type: 'integer' }, endLine: { type: 'integer' }, maxLines: { type: 'integer' }, expectedRevision: { type: 'string' } }, required: ['path'], additionalProperties: false } },
  { name: 'workspace_create_file', tool: 'workspace.create_file', description: 'Create a new project file. Existing files cannot be overwritten.', schema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false } },
  { name: 'workspace_propose_edit', tool: 'workspace.propose_edit', description: 'Prepare an exact edit in an existing file for the user to review and apply.', schema: { type: 'object', properties: { path: { type: 'string' }, oldText: { type: 'string' }, newText: { type: 'string' }, expectedRevision: { type: 'string' } }, required: ['path', 'oldText', 'newText'], additionalProperties: false } },
  { name: 'system_status', tool: 'system.status', description: 'Read basic Mac hardware and provider CLI status.', schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'open_app', tool: 'app.open', description: 'Open an app from Aspira’s supported Mac app list.', schema: { type: 'object', properties: { app: { type: 'string' } }, required: ['app'], additionalProperties: false } },
  { name: 'open_url', tool: 'browser.open_url', description: 'Open a public HTTP(S) URL in Aspira Browser. Read page text only if the user asks what the page says.', schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } },
  { name: 'browser_read_page', tool: 'browser.read_page', description: 'Read visible text and controls from the current Aspira Browser tab.', schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'browser_click', tool: 'browser.click', description: 'Click one visible page control by its exact accessible name. Submission and high-impact actions are blocked.', schema: { type: 'object', properties: { role: { type: 'string', enum: ['button', 'link', 'tab', 'menuitem'] }, name: { type: 'string' } }, required: ['name'], additionalProperties: false } },
  { name: 'browser_fill', tool: 'browser.fill', description: 'Fill a visible, labeled, non-secret page field. Form submission is never performed.', schema: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'], additionalProperties: false } },
  { name: 'browser_close', tool: 'browser.close', description: 'Close the separate Aspira Browser session.', schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'web_search', tool: 'web.search', description: 'Search public web sources when the user requests it.', schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } },
  { name: 'save_memory', tool: 'memory.save', description: 'Save a memory only when the user explicitly asks Aspira to remember it.', schema: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string', enum: ['goal', 'task', 'preference', 'insight'] } }, required: ['content'], additionalProperties: false } },
];

function sessionKey(conversationId) {
  return crypto.createHash('sha256').update(String(conversationId || 'default')).digest('hex');
}

function loadSessions(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function saveSessions(file, sessions) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(sessions, null, 2), { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
}

function safeText(value) {
  return String(value || '').slice(0, 20000);
}

export async function runCodexAppServerTurn({
  binary,
  sessionFile,
  conversationId,
  cwd,
  systemPrompt,
  prompt,
  historyContext = '',
  allowActions,
  env,
  signal,
  executeTool,
  onStatus,
  onActionStart,
  onAction,
  onDelta,
}) {
  if (signal?.aborted) throw Object.assign(new Error('Provider request stopped.'), { name: 'AbortError' });
  const sessions = loadSessions(sessionFile);
  const key = sessionKey(conversationId);
  const priorThreadId = sessions[key]?.threadId;
  const child = spawn(binary, ['app-server', '--listen', 'stdio://'], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdoutBuffer = '';
  let stderr = '';
  let nextId = 1;
  let activeThreadId = priorThreadId || null;
  let responseText = '';
  let completedTurn = null;
  let settled = false;
  let completionResolve;
  let completionReject;
  const completion = new Promise((resolve, reject) => { completionResolve = resolve; completionReject = reject; });
  const pending = new Map();
  const executedActions = [];
  const maxToolCalls = 3;
  let toolCallCount = 0;

  const write = (message) => {
    if (child.stdin.destroyed || child.killed) throw new Error('Codex app-server connection closed.');
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const rpc = (method, params, timeoutMs = 30000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Codex app-server timed out during ${method}.`));
    }, timeoutMs);
    pending.set(id, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject: (error) => { clearTimeout(timer); reject(error); } });
    try { write({ id, method, params }); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
  const reply = (id, result) => {
    try { write({ id, result }); } catch { /* The app-server may close during an abort. */ }
  };
  const denyUnsupportedRequest = (message) => {
    if (message.method === 'item/commandExecution/requestApproval') {
      reply(message.id, { decision: 'decline' });
    } else if (message.method === 'item/fileChange/requestApproval') {
      reply(message.id, { decision: 'decline' });
    } else {
      try { write({ id: message.id, error: { code: -32601, message: 'This approval or tool request is not available in Aspira yet.' } }); }
      catch { /* The app-server may close during an abort. */ }
    }
  };

  const handleToolCall = async (message) => {
    const params = message.params || {};
    const spec = TOOL_DEFINITIONS.find((entry) => entry.name === params.tool);
    if (!allowActions || !spec) {
      reply(message.id, { success: false, contentItems: [{ type: 'inputText', text: 'This tool is not available for the current Aspira turn.' }] });
      return;
    }
    if (toolCallCount >= maxToolCalls) {
      reply(message.id, { success: false, contentItems: [{ type: 'inputText', text: `Aspira limits each provider turn to ${maxToolCalls} tool actions.` }] });
      return;
    }
    toolCallCount += 1;
    try {
      onActionStart?.(spec.description);
      const action = await executeTool({ tool: spec.tool, arguments: params.arguments || {} });
      action.tool = spec.tool;
      action.id = `action-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
      action.title ||= spec.description;
      executedActions.push(action);
      onAction?.(action);
      reply(message.id, {
        success: action.status === 'success',
        contentItems: [{ type: 'inputText', text: safeText(action.output || action.title) }],
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Aspira could not run that action.';
      reply(message.id, { success: false, contentItems: [{ type: 'inputText', text: safeText(text) }] });
    }
  };

  const onMessage = (message) => {
    if (message && Object.hasOwn(message, 'id') && (Object.hasOwn(message, 'result') || Object.hasOwn(message, 'error'))) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message || 'Codex app-server request failed.'));
      else request.resolve(message.result);
      return;
    }
    if (message && Object.hasOwn(message, 'id') && typeof message.method === 'string') {
      if (message.method === 'item/tool/call') void handleToolCall(message);
      else denyUnsupportedRequest(message);
      return;
    }
    if (!message || typeof message.method !== 'string') return;
    if (message.method === 'item/agentMessage/delta') {
      const delta = String(message.params?.delta || '');
      responseText += delta;
      if (delta) onDelta?.(delta);
      return;
    }
    if (message.method === 'turn/completed') {
      completedTurn = message.params?.turn || null;
      settled = true;
      completionResolve({ turn: completedTurn, text: responseText.trim() });
      return;
    }
    if (message.method === 'item/started') {
      const item = message.params?.item;
      if (item?.type === 'commandExecution' || item?.type === 'fileChange') {
        onStatus?.(item.type === 'commandExecution' ? 'Running a read-only command in the Codex sandbox' : 'Codex requested a file change; Aspira will decline it');
      }
    }
    if (message.method === 'error') {
      const error = message.params?.error;
      if (error) {
        settled = true;
        completionReject(new Error(error.message || 'Codex could not complete this turn.'));
      }
    }
  };

  const onData = (chunk) => {
    stdoutBuffer += chunk.toString();
    if (stdoutBuffer.length > 8_000_000) {
      settled = true;
      completionReject(new Error('Codex app-server sent an oversized event.'));
      child.kill('SIGTERM');
      return;
    }
    let boundary;
    while ((boundary = stdoutBuffer.indexOf('\n')) >= 0) {
      const line = stdoutBuffer.slice(0, boundary).trim();
      stdoutBuffer = stdoutBuffer.slice(boundary + 1);
      if (!line) continue;
      try { onMessage(JSON.parse(line)); }
      catch (error) {
        settled = true;
        completionReject(error instanceof Error ? error : new Error('Codex app-server returned invalid JSON.'));
        child.kill('SIGTERM');
      }
    }
  };
  const abort = () => {
    try {
      if (activeThreadId) write({ id: nextId++, method: 'turn/interrupt', params: { threadId: activeThreadId } });
    } catch { /* The app-server may already have exited. */ }
    child.kill('SIGINT');
    const timer = setTimeout(() => child.kill('SIGTERM'), 1200);
    timer.unref?.();
    if (!settled) {
      settled = true;
      completionReject(Object.assign(new Error('Provider request stopped.'), { name: 'AbortError' }));
    }
  };

  child.stdout.on('data', onData);
  child.stderr.on('data', (chunk) => { if (stderr.length < 20000) stderr += chunk.toString(); });
  child.on('error', (error) => {
    if (!settled) { settled = true; completionReject(error); }
  });
  child.on('close', (code) => {
    for (const request of pending.values()) request.reject(new Error('Codex app-server closed before replying.'));
    pending.clear();
    if (!settled) {
      settled = true;
      completionReject(new Error(stderr.trim() || `Codex app-server exited with code ${code}.`));
    }
  });
  signal?.addEventListener('abort', abort, { once: true });
  const turnTimeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    completionReject(new Error('Codex took too long to respond. Stop the turn and retry.'));
    child.kill('SIGTERM');
  }, 180000);

  try {
    await rpc('initialize', {
      clientInfo: { name: 'aspira', title: 'Aspira', version: '1.0.0' },
      capabilities: { experimentalApi: false },
    });
    write({ method: 'initialized' });
    const tools = [{
      type: 'namespace',
      name: 'aspira',
      description: 'Use Aspira’s permission checked tools to help the user with their request.',
      tools: TOOL_DEFINITIONS.map(({ name, description, schema }) => ({ type: 'function', name, description, inputSchema: schema })),
    }];
    const threadParams = {
      cwd,
      runtimeWorkspaceRoots: [cwd],
      model: null,
      sandbox: 'read-only',
      approvalPolicy: 'never',
      ephemeral: false,
      developerInstructions: String(systemPrompt || '').slice(0, 16000),
      dynamicTools: tools,
    };
    const threadResult = priorThreadId
      ? await rpc('thread/resume', { threadId: priorThreadId, cwd, runtimeWorkspaceRoots: [cwd], sandbox: 'read-only', approvalPolicy: 'never', developerInstructions: threadParams.developerInstructions })
      : await rpc('thread/start', threadParams);
    activeThreadId = threadResult?.thread?.id || priorThreadId;
    if (!activeThreadId) throw new Error('Codex did not create a conversation session.');
    if (!priorThreadId) {
      sessions[key] = { threadId: activeThreadId, updatedAt: new Date().toISOString() };
      const recent = Object.entries(sessions).sort((a, b) => String(b[1]?.updatedAt || '').localeCompare(String(a[1]?.updatedAt || ''))).slice(0, 500);
      saveSessions(sessionFile, Object.fromEntries(recent));
    }
    const userText = priorThreadId || !historyContext
      ? prompt
      : `${historyContext}\n\nCurrent user request: ${prompt}`;
    onStatus?.('Connecting to Codex');
    await rpc('turn/start', {
      threadId: activeThreadId,
      input: [{ type: 'text', text: String(userText || '').slice(0, 32000) }],
      cwd,
      approvalPolicy: 'never',
      summary: 'auto',
    });
    const result = await completion;
    if (result.turn?.status !== 'completed') {
      const status = result.turn?.status || 'unknown';
      throw new Error(`Codex turn ended with status: ${status}.`);
    }
    sessions[key] = { threadId: activeThreadId, updatedAt: new Date().toISOString() };
    saveSessions(sessionFile, sessions);
    return { text: result.text, threadId: activeThreadId, executedActions };
  } catch (error) {
    if (error?.name === 'AbortError' || signal?.aborted) throw Object.assign(new Error('Provider request stopped.'), { name: 'AbortError' });
    const detail = error instanceof Error ? error.message : 'Codex app-server could not complete this turn.';
    throw new Error(detail);
  } finally {
    clearTimeout(turnTimeout);
    signal?.removeEventListener('abort', abort);
    for (const request of pending.values()) request.reject(new Error('Codex app-server session ended.'));
    pending.clear();
    if (!child.killed) child.kill('SIGTERM');
  }
}
