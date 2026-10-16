import express from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { searchPublicWeb } from './webSearch.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
const homeDir = os.homedir();

// Ensure child processes have full access to user's subscription CLI paths
const ENHANCED_PATH = [
  path.join(homeDir, '.local', 'bin'),
  path.join(homeDir, '.grok', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  process.env.PATH || '',
].join(':');

const CHILD_ENV = {
  ...process.env,
  PATH: ENHANCED_PATH,
  HOME: homeDir,
};
const SUBSCRIPTION_CHILD_ENV = { ...CHILD_ENV };
for (const variable of Object.keys(SUBSCRIPTION_CHILD_ENV)) {
  if (/(?:^|_)(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?)(?:_|$)/i.test(variable)) {
    delete SUBSCRIPTION_CHILD_ENV[variable];
  }
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const memoryFile = path.join(dataDir, 'memory.json');
const routinesFile = path.join(dataDir, 'routines.json');

// Provider CLI discovery and account-backed inference bridge.
function firstExistingPath(candidates) {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

export function detectSubscriptions() {
  // Detect supported CLIs and only the sign-in details reported by those CLIs.
  // A desktop app alone does not provide an inference bridge; plan tier is not checked.
  // 1. Anthropic Claude Code CLI
  const claudeCli = firstExistingPath([
    path.join(homeDir, '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]);
  const claudeDesktopApp = firstExistingPath([
    '/Applications/Claude.app',
    '/Applications/Claude Science.app',
  ]);

  // 2. OpenAI Codex CLI
  const codexCli = firstExistingPath([
    '/opt/homebrew/bin/codex',
    path.join(homeDir, '.local', 'bin', 'codex'),
    '/usr/local/bin/codex',
  ]);
  const chatgptDesktopApp = firstExistingPath([
    '/Applications/ChatGPT.app',
    '/Applications/ChatGPT Classic.app',
  ]);

  // 3. xAI Grok Build CLI
  const grokCli = firstExistingPath([
    path.join(homeDir, '.grok', 'bin', 'grok'),
    '/opt/homebrew/bin/grok',
    '/usr/local/bin/grok',
  ]);

  // 4. ARGON / GEMINI via the Antigravity CLI (Google's supported successor).
  const antigravityCli = firstExistingPath([
    path.join(homeDir, '.local', 'bin', 'agy'),
    '/opt/homebrew/bin/agy',
    '/usr/local/bin/agy',
  ]);
  const antigravityApp = firstExistingPath(['/Applications/Antigravity.app']);
  return {
    argon: {
      modelId: 'argon',
      providerName: 'Google Antigravity CLI',
      cliPath: antigravityCli,
      desktopAppPath: antigravityApp,
      methodLabel: antigravityCli
        ? 'Antigravity CLI found · sign-in checked on first request'
        : antigravityApp
        ? 'Antigravity app found · install its CLI to connect inference'
        : 'Not connected',
      loginCommand: antigravityCli ? `${antigravityCli}` : 'Install Antigravity CLI',
    },
    claude: {
      modelId: 'claude',
      providerName: 'Claude Code CLI',
      cliPath: claudeCli,
      desktopAppPath: claudeDesktopApp,
      methodLabel: claudeCli
        ? 'Claude Code CLI found · sign-in status checked locally'
        : claudeDesktopApp
        ? 'Claude desktop app found · install Claude Code CLI to connect inference'
        : 'Not connected',
      loginCommand: claudeCli ? `${claudeCli} auth login` : 'open -a "Claude"',
    },
    grok: {
      modelId: 'grok',
      providerName: 'Grok Build CLI',
      cliPath: grokCli,
      desktopAppPath: null,
      methodLabel: grokCli
        ? 'Grok Build CLI found · sign-in checked on first request'
        : 'No supported CLI detected',
      loginCommand: grokCli ? `${grokCli} login` : 'open "https://grok.com"',
    },
    gpt: {
      modelId: 'gpt',
      providerName: 'Codex CLI',
      cliPath: codexCli,
      desktopAppPath: chatgptDesktopApp,
      methodLabel: codexCli
        ? 'Codex CLI found · sign-in status checked locally'
        : chatgptDesktopApp
        ? 'ChatGPT desktop app found · install Codex CLI to connect inference'
        : 'Not connected',
      loginCommand: codexCli ? `${codexCli} login` : 'open -a "ChatGPT"',
    },
  };
}

// Run a CLI binary safely with argument array (no shell injection) and timeout
function runCliProcess(binary, args, timeoutMs = 16000, signal, env = CHILD_ENV, inputText, cwd = rootDir) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(binary, args, {
      cwd,
      env,
      stdio: [inputText === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => {
      child.kill('SIGTERM');
      finish(reject, Object.assign(new Error('Provider request stopped.'), { name: 'AbortError' }));
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(reject, new Error(`Subscription CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();

    if (inputText !== undefined) child.stdin.end(inputText);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      finish(reject, err);
    });
    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        finish(resolve, stdout.trim());
      } else {
        finish(reject, new Error(stderr.trim() || `Exited with code ${code}`));
      }
    });
  });
}

function runCliStatus(binary, args, timeoutMs = 7000, signal, env = CHILD_ENV) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(binary, args, {
      cwd: rootDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => {
      child.kill('SIGTERM');
      finish(reject, Object.assign(new Error('Provider request stopped.'), { name: 'AbortError' }));
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(reject, new Error('Provider status check timed out.'));
    }, timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 20000) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 20000) stderr += chunk.toString();
    });
    child.on('error', (error) => {
      finish(reject, error);
    });
    child.on('close', (code) => {
      finish(resolve, { stdout, stderr, code });
    });
  });
}

async function getSubscriptionStatuses() {
  const subscriptions = detectSubscriptions();
  const claude = subscriptions.claude;
  if (claude?.cliPath) {
    try {
      const result = await runCliStatus(claude.cliPath, ['auth', 'status', '--json'], 7000, undefined, SUBSCRIPTION_CHILD_ENV);
      const status = JSON.parse(result.stdout || '{}');
      claude.authStatus = result.code === 0 && status.loggedIn === true
        ? 'signed_in'
        : status.loggedIn === false
        ? 'signed_out'
        : 'unknown';
    } catch {
      claude.authStatus = 'unknown';
    }
  }
  const codex = subscriptions.gpt;
  if (codex?.cliPath) {
    try {
      const result = await runCliStatus(codex.cliPath, ['login', 'status'], 7000, undefined, SUBSCRIPTION_CHILD_ENV);
      const statusText = `${result.stdout}\n${result.stderr}`.toLowerCase();
      codex.authStatus = /not logged in|not authenticated|signed out/.test(statusText)
        ? 'signed_out'
        : result.code === 0 && /\blogged in\b|authenticated/.test(statusText)
        ? 'signed_in'
        : 'unknown';
    } catch {
      codex.authStatus = 'unknown';
    }
  }
  return subscriptions;
}

function summarizeProviderFailure(providerName, error) {
  const detail = error instanceof Error ? error.message.toLowerCase() : '';
  if (detail.includes('timed out')) {
    return `${providerName} took too long to respond. Check the connection and retry.`;
  }
  if (/not logged|login required|not authenticated|unauthorized|credential|sign.in/.test(detail)) {
    return `${providerName} is not signed in. Finish its CLI sign-in from Settings, then retry.`;
  }
  return `${providerName} CLI could not complete the request. Check its sign-in and CLI status, then retry.`;
}

// Execute inference with a provider subscription, without reading its credential store.
async function runSubscriptionInference(modelId, fullPrompt, subs, signal) {
  let error = null;
  const timeoutMs = 90000;
  // Give provider tools an empty working directory. Aspira remains the only
  // path to the selected project and its registered local actions.
  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aspira-provider-'));
  fs.chmodSync(isolatedDir, 0o700);
  const promptFile = path.join(isolatedDir, 'prompt.txt');

  try {
    // Run the supported Antigravity CLI headless; never read its credential store.
    if (modelId === 'argon' && subs.argon?.cliPath) {
      try {
        const out = await runCliProcess(
          subs.argon.cliPath,
          [
            '--sandbox', '--mode', 'plan', '--disable-slash-commands',
            '--input-format', 'text', '--output-format', 'text', '--print-timeout', '90s', '-p',
          ],
          timeoutMs,
          signal,
          SUBSCRIPTION_CHILD_ENV,
          fullPrompt,
          isolatedDir
        );
        if (out) return { text: out, badge: 'ANTIGRAVITY_CLI' };
      } catch (err) {
        if (signal?.aborted) throw err;
        error = summarizeProviderFailure('Antigravity', err);
      }
    }

    // 2. CLAUDE SUBSCRIPTION (via ~/.local/bin/claude -p)
    if (modelId === 'claude' && subs.claude?.cliPath) {
      try {
        try {
        const status = await runCliStatus(subs.claude.cliPath, ['auth', 'status', '--json'], 7000, signal, SUBSCRIPTION_CHILD_ENV);
          const auth = JSON.parse(status.stdout || '{}');
          if (auth.loggedIn === false) {
            return { error: 'Claude Code is signed out. Use Settings → Connections → Open CLI sign-in, then retry.' };
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          // Continue to a real request; report its result if the status check is unavailable.
        }
        const out = await runCliProcess(
          subs.claude.cliPath,
          [
            '-p', '--input-format', 'text', '--output-format', 'text',
            '--system-prompt', 'You are Claude responding inside Aspira. Follow the instructions in the user message and answer naturally and honestly.',
            '--tools', '', '--disallowedTools', 'mcp__*',
            '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
            '--safe-mode', '--no-session-persistence', '--permission-mode', 'plan', '--max-turns', '1',
          ],
          timeoutMs,
          signal,
          SUBSCRIPTION_CHILD_ENV,
          fullPrompt,
          isolatedDir
        );
        if (out) {
          return { text: out, badge: 'CLAUDE_CODE_CLI' };
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        error = summarizeProviderFailure('Claude Code', err);
      }
    }

    // 3. GROK SUBSCRIPTION (via ~/.grok/bin/grok -p)
    if (modelId === 'grok' && subs.grok?.cliPath) {
      try {
        fs.writeFileSync(promptFile, fullPrompt, { mode: 0o600, flag: 'wx' });
        const out = await runCliProcess(
          subs.grok.cliPath,
          [
            '--prompt-file', promptFile,
            '--output-format',
            'plain',
            '--permission-mode',
            'plan',
            '--sandbox',
            'strict',
            '--tools',
            '',
            '--deny',
            'MCPTool',
            '--disable-web-search',
            '--no-subagents',
            '--no-auto-update',
            '--max-turns',
            '1',
          ],
          timeoutMs,
          signal,
          SUBSCRIPTION_CHILD_ENV,
          undefined,
          isolatedDir
        );
        if (out) {
          return { text: out, badge: 'GROK_BUILD_CLI' };
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        error = summarizeProviderFailure('Grok Build', err);
      }
    }

    // 4. CHATGPT PLUS/PRO SUBSCRIPTION (via /opt/homebrew/bin/codex exec)
    if (modelId === 'gpt' && subs.gpt?.cliPath) {
      const tmpOut = path.join(isolatedDir, 'response.txt');
      try {
        await runCliProcess(
          subs.gpt.cliPath,
          [
            'exec',
            '--ephemeral',
          '--ignore-user-config',
          '--ignore-rules',
          '--strict-config',
            '--skip-git-repo-check',
            '--color',
            'never',
          '-C', isolatedDir,
          '-c', 'default_permissions="aspira-bridge"',
          '-c', 'permissions.aspira-bridge.extends=":read-only"',
          '-c', `permissions.aspira-bridge.workspace_roots={"${isolatedDir}"=true}`,
          '-c', 'permissions.aspira-bridge.filesystem={":root"="deny",":minimal"="read",":workspace_roots"={"."="read"}}',
            '-o',
            tmpOut,
          '-',
          ],
        timeoutMs,
        signal,
        SUBSCRIPTION_CHILD_ENV,
        fullPrompt,
        isolatedDir
      );
        if (fs.existsSync(tmpOut)) {
          const text = fs.readFileSync(tmpOut, 'utf8').trim();
          fs.unlinkSync(tmpOut);
          if (text) {
            return { text, badge: 'CODEX_CLI' };
          }
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        error = summarizeProviderFailure('Codex', err);
        try {
          if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
        } catch {
          // ignore
        }
      }
    }

    return error ? { error } : null;
  } finally {
    try {
      fs.rmSync(isolatedDir, { recursive: true, force: true });
    } catch {
      // Keep provider cleanup best-effort so a failed model request is still reportable.
    }
  }
}

// User-managed context stays in ignored server/data/memory.json.
const DEFAULT_MEMORIES = [];

function loadMemories() {
  try {
    if (fs.existsSync(memoryFile)) {
      return JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    }
  } catch {
    // ignore parse error
  }
  fs.writeFileSync(memoryFile, JSON.stringify(DEFAULT_MEMORIES, null, 2));
  return DEFAULT_MEMORIES;
}

function saveMemories(memories) {
  fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
}

// User-created, on-demand local playbooks stay in ignored server/data/routines.json.
const DEFAULT_ROUTINES = [
  {
    id: 'routine-system-snapshot',
    title: 'System and repository snapshot',
    description: 'Reads macOS hardware and provider CLI availability, then reads Git status and recent commits.',
    schedule: 'On demand',
    leadAgent: 'local',
    steps: [
      { tool: 'system_status', label: 'Read system and provider CLI status' },
      { tool: 'shell_exec', args: { command: 'git status -s && git log -n 3 --oneline' }, label: 'Read Git status and recent commits' },
    ],
    lastRunAt: null,
  },
  {
    id: 'routine-components',
    title: 'Inspect workspace components',
    description: 'Lists the component files in this Aspira workspace.',
    schedule: 'On demand',
    leadAgent: 'local',
    steps: [
      { tool: 'shell_exec', args: { command: 'ls -la src/components' }, label: 'List component files' },
    ],
    lastRunAt: null,
  },
  {
    id: 'routine-dev-tools',
    title: 'Check local development tools',
    description: 'Reads Node and npm versions and summarizes the current Git diff.',
    schedule: 'On demand',
    leadAgent: 'local',
    steps: [
      { tool: 'shell_exec', args: { command: 'node -v' }, label: 'Read Node.js version' },
      { tool: 'shell_exec', args: { command: 'npm -v' }, label: 'Read npm version' },
      { tool: 'shell_exec', args: { command: 'git diff --stat' }, label: 'Summarize Git changes' },
    ],
    lastRunAt: null,
  },
];

function loadRoutines() {
  try {
    if (fs.existsSync(routinesFile)) {
      return JSON.parse(fs.readFileSync(routinesFile, 'utf8'));
    }
  } catch {
    // ignore
  }
  fs.writeFileSync(routinesFile, JSON.stringify(DEFAULT_ROUTINES, null, 2));
  return DEFAULT_ROUTINES;
}

function saveRoutines(routines) {
  fs.writeFileSync(routinesFile, JSON.stringify(routines, null, 2));
}

// ============================================================================
// 3. LOCAL ACTION EXECUTION
// ============================================================================
function isInsideDirectory(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveWorkspacePath(input) {
  const relPath = String(input || '').trim();
  if (!relPath || path.isAbsolute(relPath)) throw new Error('Use a relative path inside the Aspira workspace.');
  const fullPath = path.resolve(rootDir, relPath);
  const realRoot = fs.realpathSync(rootDir);
  if (!isInsideDirectory(rootDir, fullPath)) throw new Error('Path traversal outside the workspace is not permitted.');

  let existingAncestor = fullPath;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) throw new Error('Could not resolve a safe workspace path.');
    existingAncestor = parent;
  }
  const realAncestor = fs.realpathSync(existingAncestor);
  if (!isInsideDirectory(realRoot, realAncestor)) throw new Error('Symlink paths outside the workspace are not permitted.');
  const resolvedTarget = fs.existsSync(fullPath)
    ? fs.realpathSync(fullPath)
    : path.resolve(realAncestor, path.relative(existingAncestor, fullPath));
  if (!isInsideDirectory(realRoot, resolvedTarget)) {
    throw new Error('Symlink paths outside the workspace are not permitted.');
  }
  return { fullPath, relPath, safeRelPath: path.relative(realRoot, resolvedTarget) };
}

const WORKSPACE_IGNORED_NAMES = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.venv', 'venv',
]);
const WORKSPACE_TEXT_EXTENSIONS = new Set([
  '.md', '.mdx', '.txt', '.json', '.ts', '.tsx', '.js', '.jsx', '.css', '.html',
  '.py', '.yml', '.yaml', '.toml', '.xml', '.sh', '.sql', '.swift', '.go', '.rs',
]);

function isSensitiveWorkspacePath(relPath) {
  return /(^|[\\/])(?:\.env(?:\.[^\\/]*)?|\.ssh|\.gnupg|credentials?(?:\.[^\\/]*)?|secrets?(?:\.[^\\/]*)?|id_rsa|id_ed25519)(?:[\\/]|$)|\.(?:pem|p12|pfx|key)$/i.test(relPath);
}

function assertReadableWorkspacePath(relPath) {
  if (isSensitiveWorkspacePath(relPath)) {
    throw new Error('This path is excluded from agent file access because it may contain credentials.');
  }
  const segments = relPath.split(/[\\/]+/).filter((segment) => segment && segment !== '.');
  if (
    segments.some((segment) => segment.startsWith('.') || WORKSPACE_IGNORED_NAMES.has(segment)) ||
    /^server[\\/]data(?:[\\/]|$)/i.test(relPath)
  ) {
    throw new Error('Hidden, generated, dependency, and private local-data paths are excluded from agent file access.');
  }
}

function listWorkspaceFiles(relativeDirectory = '.', limit = 160) {
  const { fullPath, relPath, safeRelPath } = resolveWorkspacePath(relativeDirectory || '.');
  assertReadableWorkspacePath(relPath);
  assertReadableWorkspacePath(safeRelPath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    throw new Error('Choose a workspace directory to list.');
  }
  const entries = [];
  const maxEntries = Math.max(1, Math.min(Number(limit) || 160, 240));

  const walk = (directory, depth) => {
    if (depth > 5 || entries.length >= maxEntries) return;
    const children = fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      if (entries.length >= maxEntries) break;
      if (child.name.startsWith('.') || WORKSPACE_IGNORED_NAMES.has(child.name) || child.isSymbolicLink()) continue;
      const fullChildPath = path.join(directory, child.name);
      const relativeChildPath = path.relative(rootDir, fullChildPath);
      if (relativeChildPath === 'server/data' || relativeChildPath.startsWith(`server${path.sep}data${path.sep}`)) continue;
      if (isSensitiveWorkspacePath(relativeChildPath)) continue;
      entries.push(`${child.isDirectory() ? 'dir ' : 'file'} ${relativeChildPath}`);
      if (child.isDirectory()) walk(fullChildPath, depth + 1);
    }
  };

  walk(fullPath, 0);
  const base = relPath === '.' ? '.' : relPath;
  return entries.length ? `Workspace files under ${base}:\n${entries.join('\n')}` : `No readable files found under ${base}.`;
}

function redactLikelySecrets(text) {
  return String(text)
    .replace(/\b(?:sk-ant|sk-proj|xai)-[A-Za-z0-9_-]{20,}\b/g, '[redacted credential]')
    .replace(/\bAIza[0-9A-Za-z_-]{25,}\b/g, '[redacted credential]')
    .replace(/\bBearer\s+[A-Za-z0-9._~-]{20,}/gi, 'Bearer [redacted credential]')
    .replace(/((?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

function searchWorkspaceText(query, limit = 24) {
  const normalizedQuery = String(query || '').trim().slice(0, 120);
  if (normalizedQuery.length < 2) throw new Error('Enter at least two characters to search the workspace.');
  const matches = [];
  const maxMatches = Math.max(1, Math.min(Number(limit) || 24, 40));
  let visitedFiles = 0;

  const walk = (directory, depth) => {
    if (depth > 5 || matches.length >= maxMatches || visitedFiles >= 5000) return;
    const children = fs.readdirSync(directory, { withFileTypes: true });
    for (const child of children) {
      if (matches.length >= maxMatches || visitedFiles >= 5000) break;
      if (child.name.startsWith('.') || WORKSPACE_IGNORED_NAMES.has(child.name) || child.isSymbolicLink()) continue;
      const fullChildPath = path.join(directory, child.name);
      const relativeChildPath = path.relative(rootDir, fullChildPath);
      if (relativeChildPath === 'server/data' || relativeChildPath.startsWith(`server${path.sep}data${path.sep}`)) continue;
      if (isSensitiveWorkspacePath(relativeChildPath)) continue;
      if (child.isDirectory()) {
        walk(fullChildPath, depth + 1);
        continue;
      }
      if (!WORKSPACE_TEXT_EXTENSIONS.has(path.extname(child.name).toLowerCase()) || /^package-lock\./i.test(child.name)) continue;
      const stat = fs.statSync(fullChildPath);
      if (!stat.isFile() || stat.size > 400_000) continue;
      visitedFiles += 1;
      const lines = fs.readFileSync(fullChildPath, 'utf8').split(/\r?\n/);
      for (let index = 0; index < lines.length && matches.length < maxMatches; index += 1) {
        if (lines[index].toLowerCase().includes(normalizedQuery.toLowerCase())) {
          matches.push(`${relativeChildPath}:${index + 1}: ${redactLikelySecrets(lines[index].trim()).slice(0, 280)}`);
        }
      }
    }
  };

  walk(rootDir, 0);
  return matches.length
    ? `Matches for "${normalizedQuery}":\n${matches.join('\n')}`
    : `No matches found for "${normalizedQuery}" in readable workspace files.`;
}

async function runWorkspaceCommand(command) {
  const cmd = String(command || '').trim();
  if (cmd === 'ps -Ao comm,%cpu,%mem -r | head -n 10') {
    const { stdout, stderr } = await execFileAsync('ps', ['-Ao', 'comm,%cpu,%mem', '-r'], {
      cwd: rootDir,
      timeout: 6000,
      maxBuffer: 1024 * 1024,
      env: CHILD_ENV,
    });
    return (stdout || stderr).split('\n').slice(0, 10).join('\n').slice(0, 2500);
  }
  if (cmd === 'ifconfig | grep "inet " | head -n 5') {
    const { stdout, stderr } = await execFileAsync('ifconfig', [], {
      cwd: rootDir,
      timeout: 6000,
      maxBuffer: 1024 * 1024,
      env: CHILD_ENV,
    });
    return (stdout || stderr).split('\n').filter((line) => line.includes('inet ')).slice(0, 5).join('\n').slice(0, 2500);
  }
  if (cmd === 'find src -maxdepth 3') {
    const { fullPath } = resolveWorkspacePath('src');
    const { stdout, stderr } = await execFileAsync('find', [fullPath, '-maxdepth', '3'], {
      cwd: rootDir,
      timeout: 6000,
      maxBuffer: 1024 * 1024,
      env: CHILD_ENV,
    });
    return (stdout || stderr).split('\n').map((entry) => path.relative(rootDir, entry)).slice(0, 150).join('\n').slice(0, 2500);
  }
  const exactCommands = new Map([
    ['git status', ['git', ['status']]],
    ['git status -s', ['git', ['status', '-s']]],
    ['git log -n 3 --oneline', ['git', ['log', '-n', '3', '--oneline']]],
    ['git diff --stat', ['git', ['diff', '--stat']]],
    ['git diff --name-only', ['git', ['diff', '--name-only']]],
    ['pwd', ['pwd', []]],
    ['node -v', ['node', ['-v']]],
    ['npm -v', ['npm', ['-v']]],
    ['python3 --version', ['python3', ['--version']]],
    ['sw_vers', ['sw_vers', []]],
    ['pmset -g batt', ['pmset', ['-g', 'batt']]],
    ['df -h .', ['df', ['-h', '.']]],
    ['git status -s && git log -n 3 --oneline', ['git', ['status', '-s']]],
    ['git status -s || ls -la', ['git', ['status', '-s']]],
  ]);
  let spec = exactCommands.get(cmd);

  // A path argument is accepted only for a short, explicit read-only command.
  if (!spec) {
    const listing = cmd.match(/^ls(?: (-la))?(?: ([A-Za-z0-9_./-]+))?$/);
    if (listing) {
      const rel = listing[2] || '.';
      const { fullPath } = resolveWorkspacePath(rel);
      spec = ['ls', [...(listing[1] ? ['-la'] : []), fullPath]];
    }
  }

  if (!spec) throw new Error('That local command is not in Aspira’s read-only command list.');
  const [binary, args] = spec;
  const { stdout, stderr } = await execFileAsync(binary, args, {
    cwd: rootDir,
    timeout: 6000,
    maxBuffer: 1024 * 1024,
    env: CHILD_ENV,
  });
  let output = stdout || stderr || 'Command completed with no output.';
  if (cmd === 'git status -s && git log -n 3 --oneline') {
    const { stdout: log } = await execFileAsync('git', ['log', '-n', '3', '--oneline'], {
      cwd: rootDir,
      timeout: 6000,
      maxBuffer: 1024 * 1024,
      env: CHILD_ENV,
    });
    output = `${output.trim()}\n${log.trim()}`.trim();
  } else if (cmd === 'git status -s || ls -la' && !output.trim()) {
    const { stdout: listing } = await execFileAsync('ls', ['-la'], {
      cwd: rootDir,
      timeout: 6000,
      maxBuffer: 1024 * 1024,
      env: CHILD_ENV,
    });
    output = listing;
  }
  return output.slice(0, 2500);
}

async function executeAgentTool(tool, args = {}, signal) {
  const start = Date.now();
  try {
    switch (tool) {
      case 'macos_app': {
        const appName = String(args.app || 'Safari').replace(/[^a-zA-Z0-9 ._-]/g, '');
        await execFileAsync('open', ['-a', appName], { env: CHILD_ENV, timeout: 5000 });
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'macos_app',
          title: `Launched macOS App: ${appName}`,
          status: 'success',
          output: `Executed \`open -a "${appName}"\` on macOS host.`,
          durationMs: Date.now() - start,
        };
      }

      case 'subscription_desktop_handoff': {
        const appMap = {
          gpt: 'ChatGPT',
          claude: 'Claude',
          argon: 'Gemini',
          grok: 'Safari',
        };
        const targetApp = String(args.app || appMap[args.modelId] || 'ChatGPT').replace(
          /[^a-zA-Z0-9 ._-]/g,
          ''
        );
        const promptText = String(args.prompt || 'Hello from Aspira');

        // Copy prompt to macOS clipboard via pbcopy and activate the subscription desktop app
        await new Promise((resolve) => {
          const pb = spawn('pbcopy', [], { env: CHILD_ENV });
          pb.stdin.write(promptText);
          pb.stdin.end();
          pb.on('close', resolve);
        });

        if (args.modelId === 'grok' && !fs.existsSync('/Applications/Grok.app')) {
          await execFileAsync('open', ['https://grok.com'], { env: CHILD_ENV, timeout: 5000 });
        } else {
          await execFileAsync('open', ['-a', targetApp], { env: CHILD_ENV, timeout: 5000 });
          // Attempt polite System Events paste if Accessibility is granted
          try {
            const script = `tell application "${targetApp}" to activate\ndelay 0.4\ntell application "System Events" to keystroke "v" using command down`;
            await execFileAsync('osascript', ['-e', script], { env: CHILD_ENV, timeout: 4000 });
          } catch {
            // Accessibility optional — prompt is already on clipboard!
          }
        }

        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'subscription_desktop_handoff',
          title: `Opened ${targetApp}.app`,
          status: 'success',
          output: `Copied the prompt to the clipboard and attempted to paste it into ${targetApp}.app. Review it there and submit it when ready. If it was not pasted, use ⌘V.`,
          durationMs: Date.now() - start,
        };
      }

      case 'macos_notify': {
        const title = String(args.title || 'Aspira Agent').slice(0, 100);
        const message = String(args.message || 'Action completed.').slice(0, 500);
        const escapeAppleScript = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const script = `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}" sound name "Glass"`;
        await execFileAsync('osascript', ['-e', script], { env: CHILD_ENV, timeout: 4000 });
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'macos_notify',
          title: `macOS Notification: ${title}`,
          status: 'success',
          output: `Displayed native macOS banner: "${message}"`,
          durationMs: Date.now() - start,
        };
      }

      case 'open_url': {
        const rawUrl = String(args.url || 'https://news.ycombinator.com');
        const safeUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        if (!['http:', 'https:'].includes(safeUrl.protocol) || safeUrl.username || safeUrl.password) {
          throw new Error('Only public HTTP or HTTPS URLs can be opened.');
        }
        await execFileAsync('open', [safeUrl.toString()], { env: CHILD_ENV, timeout: 5000 });
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'open_url',
          title: `Opened URL in Browser`,
          status: 'success',
          output: `Launched ${safeUrl} in default macOS browser.`,
          durationMs: Date.now() - start,
        };
      }

      case 'system_status': {
        const cpus = os.cpus();
        const totalMem = (os.totalmem() / 1024 ** 3).toFixed(1);
        const freeMem = (os.freemem() / 1024 ** 3).toFixed(1);
        const usedMem = (os.totalmem() - os.freemem()) / 1024 ** 3;
        let battInfo = 'Unavailable';
        try {
          const { stdout } = await execFileAsync('pmset', ['-g', 'batt'], { env: CHILD_ENV, timeout: 4000 });
          battInfo = stdout.split('\n').slice(0, 2).join(' | ').trim();
        } catch {
          // ignore
        }
        const subs = detectSubscriptions();
        const cliSetupList = Object.values(subs)
          .filter((s) => s.cliPath)
          .map((s) => `${s.modelId.toUpperCase()}: ${s.methodLabel}`)
          .join(' • ');

        const summary = `Host: ${os.hostname()} (${os.platform()} ${os.arch()})\nCPU: ${cpus[0]?.model || 'Unavailable'} (${cpus.length} cores, load average: ${os.loadavg().map((n) => n.toFixed(2)).join(', ')})\nMemory: ${usedMem.toFixed(1)} GB used / ${totalMem} GB total (${freeMem} GB free)\nPower: ${battInfo}\nProvider CLI binaries (sign-in not checked): ${cliSetupList || 'None found'}`;
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'system_status',
          title: 'Read macOS hardware and provider setup',
          status: 'success',
          output: summary,
          durationMs: Date.now() - start,
        };
      }

      case 'shell_exec': {
        const cmd = String(args.command || 'git status -s').trim();
        const output = await runWorkspaceCommand(cmd);
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'shell_exec',
          title: `Ran local command: ${cmd}`,
          status: 'success',
          output,
          durationMs: Date.now() - start,
        };
      }

      case 'fs_write': {
        const { fullPath, relPath, safeRelPath } = resolveWorkspacePath(args.path || 'workspace-note.md');
        assertReadableWorkspacePath(relPath);
        assertReadableWorkspacePath(safeRelPath);
        const parent = path.dirname(fullPath);
        if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
          throw new Error('The parent folder must already exist inside the workspace.');
        }
        const realParent = fs.realpathSync(parent);
        if (!isInsideDirectory(fs.realpathSync(rootDir), realParent)) {
          throw new Error('Symlink paths outside the workspace are not permitted.');
        }
        const content = String(args.content || '');
        if (content.length > 200_000) throw new Error('New files are limited to 200 KB.');
        const descriptor = fs.openSync(fullPath, 'wx', 0o600);
        try {
          fs.writeFileSync(descriptor, content, 'utf8');
        } finally {
          fs.closeSync(descriptor);
        }
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'fs_write',
          title: `Wrote File: ${relPath}`,
          status: 'success',
          output: `Created ${content.length} bytes at ${relPath}`,
          durationMs: Date.now() - start,
        };
      }

      case 'fs_read': {
        const { fullPath, relPath, safeRelPath } = resolveWorkspacePath(args.path || 'README.md');
        assertReadableWorkspacePath(relPath);
        assertReadableWorkspacePath(safeRelPath);
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
          throw new Error(`File not found: ${relPath}`);
        }
        if (!WORKSPACE_TEXT_EXTENSIONS.has(path.extname(fullPath).toLowerCase())) {
          throw new Error('Aspira reads text and source files only.');
        }
        if (fs.statSync(fullPath).size > 1_000_000) throw new Error('This file is too large to read through Aspira.');
        const content = redactLikelySecrets(fs.readFileSync(fullPath, 'utf8')).slice(0, 5000);
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'fs_read',
          title: `Read File: ${relPath}`,
          status: 'success',
          output: content,
          durationMs: Date.now() - start,
        };
      }

      case 'fs_list': {
        const output = listWorkspaceFiles(args.path || '.', args.limit);
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'fs_list',
          title: 'Listed workspace files',
          status: 'success',
          output,
          durationMs: Date.now() - start,
        };
      }

      case 'fs_search': {
        const output = searchWorkspaceText(args.query, args.limit);
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'fs_search',
          title: `Searched workspace for "${String(args.query || '').slice(0, 80)}"`,
          status: 'success',
          output,
          durationMs: Date.now() - start,
        };
      }

      case 'web_search': {
        const query = String(args.query || '').trim().slice(0, 200);
        if (!query) throw new Error('A search query is required.');
        const results = await searchPublicWeb(query, signal);
        const output = results.map((result, index) => [
          `${index + 1}. ${result.title}`,
          result.snippet,
          result.url,
        ].filter(Boolean).join('\n')).join('\n\n');
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'web_search',
          title: `Web search: "${query}"`,
          status: 'success',
          output,
          durationMs: Date.now() - start,
        };
      }

      case 'memory_store': {
        const memories = loadMemories();
        const newMem = {
          id: `mem-${Date.now()}`,
          content: String(args.content || ''),
          category: args.category || 'insight',
          status: args.status || 'IN_PROGRESS',
          emotionalTone: args.emotionalTone || 'Focused',
          sourceAgent: args.sourceAgent || 'argon',
          createdAt: new Date().toISOString(),
          tags: Array.isArray(args.tags) ? args.tags : ['conversation'],
        };
        memories.unshift(newMem);
        saveMemories(memories.slice(0, 100));
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'memory_store',
          title: `Saved ${newMem.category} to context`,
          status: 'success',
          output: `[${newMem.status}] ${newMem.content}`,
          durationMs: Date.now() - start,
          memoryItem: newMem,
        };
      }

      default:
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool,
          title: `Unknown Tool: ${tool}`,
          status: 'error',
          output: `Tool "${tool}" is not registered.`,
          durationMs: Date.now() - start,
        };
    }
  } catch (err) {
    return {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tool,
      title: `Action Error (${tool})`,
      status: 'error',
      output: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

const MODEL_ACTION_TOOLS = `Available Aspira tools:
- workspace.git_status {}: read the current branch and working-tree status.
- workspace.list_files {path?: string}: list non-hidden workspace files under a relative folder.
- workspace.search_text {query: string}: search readable source and documentation files.
- workspace.read_file {path: string}: read a workspace text file; credential files are blocked.
- workspace.create_file {path: string, content: string}: create a new file only; existing files cannot be overwritten.
- system.status {}: read basic Mac CPU, memory, battery, and detected provider CLI status.
- app.open {app: string}: open one of Safari, Notes, Calendar, Calculator, Terminal, Finder, Mail, Messages, Reminders, Music, Preview, Activity Monitor, System Settings, Cursor, ChatGPT, Claude, Gemini, Ollama, Spotify, or Xcode.
- browser.open_url {url: string}: open a public HTTP(S) URL in the default browser.
- web.search {query: string}: search public web sources; use only when the user asks for search or current information.
- memory.save {content: string, category?: "goal"|"task"|"preference"|"insight"}: save context only when the user explicitly asks Aspira to remember it.

To request a tool, return exactly one JSON object and no prose:
{"type":"aspira_tool_call","tool":"workspace.git_status","arguments":{}}
Use a tool only when it materially helps the request. Do not claim it ran until the app returns its result. Never request credentials, hidden files, arbitrary shell commands, or edits to existing files. After a tool result, either request one more tool or answer naturally.`;

function parseModelToolCall(text) {
  let candidate = String(text || '').trim();
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidate = fenced[1].trim();
  try {
    const value = JSON.parse(candidate);
    if (value?.type !== 'aspira_tool_call' || typeof value.tool !== 'string') return null;
    return {
      tool: value.tool,
      arguments: value.arguments && typeof value.arguments === 'object' && !Array.isArray(value.arguments)
        ? value.arguments
        : {},
    };
  } catch {
    return null;
  }
}

function toolAuthorizationError(tool, prompt) {
  const text = String(prompt || '').toLowerCase();
  const namesWorkspaceFile = /(?:^|[\s`'"(])(?:[\w.-]+\/)*[\w.-]+\.(?:md|mdx|txt|json|ts|tsx|js|jsx|css|html|py|yml|yaml|toml|xml|sh|sql|swift|go|rs)\b/i.test(text);
  const hasWorkspaceIntent = namesWorkspaceFile || /\b(workspace|repository|repo|codebase|project|folder|file|files|source|git|branch|diff|code)\b/.test(text);
  if (tool.startsWith('workspace.') && !hasWorkspaceIntent) {
    return 'Aspira can inspect workspace files only when the user asks about the project, code, files, or repository.';
  }
  if (tool === 'workspace.git_status' && !/\b(git|repository|repo|branch|working tree|changes|diff|status)\b/.test(text)) {
    return 'The user did not ask to inspect Git or repository changes.';
  }
  if (tool === 'workspace.create_file' && !/\b(create|write|save|generate|make)\b/.test(text)) {
    return 'Creating a file requires an explicit request to create or write one.';
  }
  if (tool === 'system.status' && !/\b(system|mac|macos|cpu|memory|ram|battery|power|hardware)\b/.test(text)) {
    return 'The user did not ask for local system information.';
  }
  if (tool === 'app.open' && !/\b(open|launch|start)\b/.test(text)) {
    return 'Opening an app requires an explicit request to open or launch it.';
  }
  if (tool === 'browser.open_url' && !/\b(open|visit|go to|browse to)\b/.test(text)) {
    return 'Opening a URL requires an explicit request to open or visit it.';
  }
  if (tool === 'web.search' && !/\b(search|look up|latest|current|news|research|browse)\b/.test(text)) {
    return 'Public web search requires an explicit search, research, or current-information request.';
  }
  if (tool === 'memory.save' && !/\b(remember|save to memory|don't forget|do not forget)\b/.test(text)) {
    return 'Saving a memory requires an explicit request to remember or save it.';
  }
  return null;
}

function makeToolFailure(tool, message) {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tool,
    title: `Tool request not run: ${tool}`,
    status: 'error',
    output: message,
    durationMs: 0,
  };
}

async function executeModelToolCall(toolCall, userPrompt, leadAgent, signal) {
  const { tool, arguments: args } = toolCall;
  const denied = toolAuthorizationError(tool, userPrompt);
  if (denied) return makeToolFailure(tool, denied);

  switch (tool) {
    case 'workspace.git_status':
      return executeAgentTool('shell_exec', { command: 'git status' }, signal);
    case 'workspace.list_files':
      return executeAgentTool('fs_list', { path: args.path || '.', limit: 160 }, signal);
    case 'workspace.search_text':
      return executeAgentTool('fs_search', { query: String(args.query || '').slice(0, 120) }, signal);
    case 'workspace.read_file': {
      const filePath = String(args.path || '').trim();
      if (!filePath) return makeToolFailure(tool, 'A relative workspace file path is required.');
      return executeAgentTool('fs_read', { path: filePath }, signal);
    }
    case 'workspace.create_file': {
      const filePath = String(args.path || '').trim();
      if (!filePath) return makeToolFailure(tool, 'A relative path for the new file is required.');
      return executeAgentTool('fs_write', {
        path: filePath,
        content: String(args.content || ''),
      }, signal);
    }
    case 'system.status':
      return executeAgentTool('system_status', {}, signal);
    case 'app.open': {
      const allowedApps = new Set([
        'safari', 'notes', 'calendar', 'calculator', 'terminal', 'finder', 'mail', 'messages',
        'reminders', 'music', 'preview', 'activity monitor', 'system settings', 'cursor',
        'chatgpt', 'claude', 'gemini', 'ollama', 'spotify', 'xcode',
      ]);
      const app = String(args.app || '').trim();
      if (!allowedApps.has(app.toLowerCase())) return makeToolFailure(tool, 'That app is not in Aspira’s local app allowlist.');
      return executeAgentTool('macos_app', { app }, signal);
    }
    case 'browser.open_url': {
      const url = String(args.url || '').trim();
      if (!url) return makeToolFailure(tool, 'A public HTTP(S) URL is required.');
      return executeAgentTool('open_url', { url }, signal);
    }
    case 'web.search': {
      const query = String(args.query || '').trim().slice(0, 200);
      if (!query) return makeToolFailure(tool, 'A search query is required.');
      return executeAgentTool('web_search', { query }, signal);
    }
    case 'memory.save': {
      const content = String(args.content || '').trim().slice(0, 1000);
      if (!content) return makeToolFailure(tool, 'Memory content is required.');
      const categories = new Set(['goal', 'task', 'preference', 'insight']);
      const category = categories.has(args.category) ? args.category : 'insight';
      return executeAgentTool('memory_store', { content, category, sourceAgent: leadAgent }, signal);
    }
    default:
      return makeToolFailure(tool, 'That tool is not available in Aspira.');
  }
}

async function requestProviderCompletion({
  modelId,
  cliPrompt,
  systemPrompt,
  userPrompt,
  apiKeys,
  endpointConfig,
  signal,
  providerFetch,
}) {
  let lastError = null;
  const subscriptions = detectSubscriptions();

  if (!apiKeys[modelId]) {
    const subscription = await runSubscriptionInference(modelId, cliPrompt, subscriptions, signal);
    if (subscription?.text) {
      return { source: 'PROVIDER_CLI', providerBadge: subscription.badge, text: subscription.text };
    }
    if (subscription?.error) lastError = subscription.error;
  }

  const responseText = async (response, extract) => {
    if (!response.ok) {
      lastError = `The ${modelId} provider returned HTTP ${response.status}.`;
      return null;
    }
    const data = await response.json();
    const text = extract(data);
    if (typeof text === 'string' && text.trim()) return text.trim();
    lastError = `The ${modelId} provider returned no text response.`;
    return null;
  };

  const geminiKey = apiKeys.argon;
  if (modelId === 'argon' && geminiKey) {
    const response = await providerFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }] }),
      }
    );
    const text = await responseText(response, (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text);
    if (text) return { source: 'LIVE_API', text };
  }

  const claudeKey = apiKeys.claude;
  if (modelId === 'claude' && claudeKey) {
    const response = await providerFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-latest',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const text = await responseText(response, (data) => data?.content?.[0]?.text);
    if (text) return { source: 'LIVE_API', text };
  }

  const grokKey = apiKeys.grok;
  if (modelId === 'grok' && grokKey) {
    const response = await providerFetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${grokKey}` },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    const text = await responseText(response, (data) => data?.choices?.[0]?.message?.content);
    if (text) return { source: 'LIVE_API', text };
  }

  const gptKey = apiKeys.gpt;
  if (modelId === 'gpt' && gptKey) {
    const response = await providerFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gptKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    const text = await responseText(response, (data) => data?.choices?.[0]?.message?.content);
    if (text) return { source: 'LIVE_API', text };
  }

  if (endpointConfig?.baseUrl) {
    let endpoint;
    try {
      endpoint = new URL(endpointConfig.baseUrl);
    } catch {
      return { error: 'The configured model endpoint URL is invalid.' };
    }
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
      return { error: 'The configured model endpoint must be an HTTP(S) URL without embedded credentials.' };
    }
    const customKey = apiKeys[modelId] || '';
    const headers = { 'Content-Type': 'application/json' };
    if (customKey) headers.Authorization = `Bearer ${customKey}`;
    const response = await providerFetch(`${endpointConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: endpointConfig.apiModelId || modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    const text = await responseText(response, (data) => data?.choices?.[0]?.message?.content);
    if (text) return { source: 'LIVE_API', text };
  }

  return {
    error: lastError || (subscriptions[modelId]?.cliPath
      ? `${modelId} CLI did not return a response. Check its sign-in and connection, then retry.`
      : `${modelId} is not connected. Sign in to its supported CLI or configure a provider in Settings.`),
  };
}

// ============================================================================
// 4. NATURAL LANGUAGE INTENT -> REAL ACTION PARSER
// ============================================================================
async function detectAndRunNaturalActions(prompt, leadAgent = 'argon') {
  const actions = [];
  const lower = prompt.toLowerCase().trim();

  // 0. Hand off prompt directly to native macOS Subscription Desktop App ("send to chatgpt app", "open in claude app", "open in gemini app")
  const handoffMatch = prompt.match(
    /\b(?:send to|open in|hand off to)\s+(chatgpt|claude|gemini|grok)(?:\s+app)?\b/i
  );
  if (handoffMatch) {
    const target = handoffMatch[1].toLowerCase();
    const modelMap = { chatgpt: 'gpt', claude: 'claude', gemini: 'argon', grok: 'grok' };
    actions.push(
      await executeAgentTool('subscription_desktop_handoff', {
        modelId: modelMap[target] || 'gpt',
        prompt,
      })
    );
  }

  // 1. Open macOS App ("open safari", "launch chatgpt", "open claude", "open gemini", "open calculator", "open notes")
  const appMatch = prompt.match(
    /\b(?:open|launch|start)\s+(?:the\s+)?(Safari|Spotify|Notes|Calendar|Calculator|Terminal|Finder|Mail|Messages|Reminders|Music|Preview|Activity Monitor|System Settings|Cursor|ChatGPT|Claude|Gemini|Ollama|Xcode)\b/i
  );
  if (appMatch && !handoffMatch) {
    actions.push(await executeAgentTool('macos_app', { app: appMatch[1] }));
  }

  // 2. Open Website / URL ("open youtube.com", "go to github.com", "open browser to ...")
  const urlMatch = prompt.match(
    /\b(?:open|go to|visit|browse)\s+(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|io|ai|dev|net|edu)[^\s]*)/i
  );
  if (urlMatch) {
    actions.push(await executeAgentTool('open_url', { url: urlMatch[1] }));
  } else if (/\b(?:search google for|open browser for|search on safari for)\s+(.+)/i.test(prompt)) {
    const q = prompt.match(/\b(?:search google for|open browser for|search on safari for)\s+(.+)/i)[1];
    actions.push(
      await executeAgentTool('open_url', {
        url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      })
    );
  }

  // 3. Explicit user-requested memory capture
  const memMatch = prompt.match(
    /\b(?:remember that|remember to|my goal is|remind me to|add a task to|save to memory|don't forget that|i prefer)\s+(.+)/i
  );
  if (memMatch) {
    const isTask = /\b(?:remind|task|todo|need to)\b/i.test(lower);
    const isGoal = /\b(?:goal|objective|target)\b/i.test(lower);
    const isPref = /\b(?:prefer|like|always use)\b/i.test(lower);
    actions.push(
      await executeAgentTool('memory_store', {
        content: memMatch[1].trim(),
        category: isGoal ? 'goal' : isTask ? 'task' : isPref ? 'preference' : 'insight',
        status: isPref ? 'ACTIVE' : 'IN_PROGRESS',
        sourceAgent: leadAgent,
      })
    );
  }

  // 4. Create / Write a File
  const writeMatch = prompt.match(
    /\b(?:create|write|save)\s+(?:a\s+)?(?:file|script|note)\s+(?:called|named)?\s*['"`]?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)['"`]?(?:\s+(?:with|containing)\s+([\s\S]+))?/i
  );
  if (writeMatch) {
    const fileName = writeMatch[1];
    const fileContent =
      writeMatch[2]?.trim() ||
      `# ${fileName}\nCreated by Aspira at ${new Date().toISOString()}\n`;
    actions.push(await executeAgentTool('fs_write', { path: fileName, content: fileContent }));
  }

  // 5. Read a File
  const readMatch = prompt.match(
    /\b(?:read|show me|cat|inspect)\s+(?:the\s+file\s+)?['"`]?([a-zA-Z0-9_./-]+\.(?:md|json|ts|tsx|js|css|html|py|txt))['"`]?/i
  );
  if (readMatch && !writeMatch) {
    actions.push(await executeAgentTool('fs_read', { path: readMatch[1] }));
  }

  // 6. Run Terminal / Git / System Command
  const quotedCommand = prompt.match(/\b(?:run|execute)\s+`([^`]+)`/i);
  const plainCommand = prompt.match(
    /\b(?:run|execute)\s+((?:git|ls|df|uptime|whoami|date|find|cat|head|ps|pmset|pwd|node|npm|python3|sw_vers)\b[\s\S]*)/i
  );
  const requestedCommand = (quotedCommand?.[1] || plainCommand?.[1] || '')
    .trim()
    .split(/\s+(?:and|then)\s+(?=(?:tell|show|explain|summarize|report|describe|let|whether|if|what|why|how|can|could|please)\b)/i)[0]
    .trim();
  if (requestedCommand) {
    actions.push(await executeAgentTool('shell_exec', { command: requestedCommand }));
  } else if (/\b(?:git status|repo status|what changed in git)\b/i.test(lower)) {
    actions.push(await executeAgentTool('shell_exec', { command: 'git status -s && git log -n 3 --oneline' }));
  } else if (/\b(?:battery|power|cpu|memory|ram|system health|hardware|mac status|system status|subscriptions)\b/i.test(lower)) {
    actions.push(await executeAgentTool('system_status', {}));
  } else if (/\b(?:disk space|storage|free space)\b/i.test(lower)) {
    actions.push(await executeAgentTool('shell_exec', { command: 'df -h .' }));
  } else if (/\b(?:running processes|top processes|what is running)\b/i.test(lower)) {
    actions.push(await executeAgentTool('shell_exec', { command: 'ps -Ao comm,%cpu,%mem -r | head -n 10' }));
  }

  // 7. macOS Notification
  const notifyMatch = prompt.match(/\b(?:send a notification|notify me)\s+(?:saying|that)?\s*(.+)/i);
  if (notifyMatch) {
    actions.push(
      await executeAgentTool('macos_notify', {
        title: 'Aspira Personal Agent',
        message: notifyMatch[1].trim(),
      })
    );
  }

  // 8. Live Web / News Search
  const searchMatch = prompt.match(
    /\b(?:search(?:\s+the\s+web)?\s+for|look up|what is the latest on|news about)\s+(.+)/i
  );
  if (searchMatch && !urlMatch) {
    actions.push(await executeAgentTool('web_search', { query: searchMatch[1].trim() }));
  } else if (/\b(?:hackernews|hacker\s+news|top stories|tech news|ai news)\b/i.test(lower) && actions.length === 0) {
    actions.push(await executeAgentTool('web_search', { query: 'HackerNews top stories' }));
  }

  return actions;
}

const app = express();
app.use(express.json({ limit: '5mb' }));

// ============================================================================
// ENDPOINTS: SUBSCRIPTIONS, TELEMETRY, MEMORY, ROUTINES, ACTION EXECUTION
// ============================================================================

app.get('/api/subscriptions', async (_req, res) => {
  res.json({ subscriptions: await getSubscriptionStatuses() });
});

function validateDesktopHandoff(modelIdValue, promptValue) {
  const allowedModels = new Set(['argon', 'claude', 'grok', 'gpt']);
  const modelId = String(modelIdValue || '');
  const prompt = typeof promptValue === 'string' ? promptValue.trim() : '';
  if (!allowedModels.has(modelId)) return { error: 'Choose a supported provider before opening its app.' };
  if (!prompt || prompt.length > 8000) return { error: 'The prompt must contain 1 to 8,000 characters.' };
  return { modelId, prompt };
}

app.post('/api/subscriptions/login', async (req, res) => {
  const { modelId } = req.body || {};
  const subs = await getSubscriptionStatuses();
  const sub = subs[modelId];
  if (!sub) return res.status(404).json({ error: 'Unknown modelId' });

  try {
    // A provider's desktop-app session is not exposed to Aspira for inference.
    if (sub.cliPath) {
      const loginArgs = modelId === 'argon'
        ? []
        : modelId === 'claude'
        ? ['auth', 'login']
        : ['login'];
      const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;
      const cmd = [sub.cliPath, ...loginArgs].map(shellQuote).join(' ');
      const appleScriptCommand = cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const script = `tell application "Terminal" to do script "${appleScriptCommand}"`;
      await execFileAsync(
        'osascript',
        ['-e', script, '-e', 'tell application "Terminal" to activate'],
        { env: CHILD_ENV, timeout: 5000 }
      );
      return res.json({
        launched: true,
        message: `Opened ${modelId.toUpperCase()} CLI in Terminal. Complete its sign-in, then refresh this screen.`,
        subscriptions: await getSubscriptionStatuses(),
      });
    }
  } catch (err) {
    return res.status(500).json({
      launched: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return res.status(409).json({
    launched: false,
    message: `${sub.providerName} has no supported CLI installed. Opening the desktop or web app does not connect its model to Aspira.`,
    subscriptions: detectSubscriptions(),
  });
});

app.post('/api/subscriptions/desktop-handoff', async (req, res) => {
  const { modelId, prompt } = req.body || {};
  const handoff = validateDesktopHandoff(modelId, prompt);
  if (handoff.error) return res.status(400).json({ error: handoff.error });
  const result = await executeAgentTool('subscription_desktop_handoff', handoff);
  res.json({ result });
});

// Saved context endpoints
app.get('/api/memory', (_req, res) => {
  res.json({ memories: loadMemories() });
});

app.post('/api/memory', (req, res) => {
  const {
    content,
    category = 'insight',
    status = 'IN_PROGRESS',
    emotionalTone = 'Focused',
    sourceAgent = 'argon',
    tags = [],
  } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Content required' });
  const memories = loadMemories();
  const item = {
    id: `mem-${Date.now()}`,
    content,
    category,
    status,
    emotionalTone,
    sourceAgent,
    createdAt: new Date().toISOString(),
    tags,
  };
  memories.unshift(item);
  saveMemories(memories);
  res.json({ memory: item, memories });
});

app.patch('/api/memory/:id', (req, res) => {
  const memories = loadMemories();
  const idx = memories.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  memories[idx] = { ...memories[idx], ...req.body };
  saveMemories(memories);
  res.json({ memory: memories[idx], memories });
});

app.delete('/api/memory/:id', (req, res) => {
  const memories = loadMemories().filter((m) => m.id !== req.params.id);
  saveMemories(memories);
  res.json({ memories });
});

// On-demand local playbook endpoints
app.get('/api/routines', (_req, res) => {
  res.json({ routines: loadRoutines() });
});

app.post('/api/routines', (req, res) => {
  const { title, description, schedule = 'On Demand', leadAgent = 'argon', steps = [] } =
    req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const routines = loadRoutines();
  const newRoutine = {
    id: `routine-${Date.now()}`,
    title,
    description: description || 'Custom multi-step local playbook.',
    schedule,
    leadAgent,
    steps: steps.length > 0 ? steps : [{ tool: 'system_status', label: 'Audit System Telemetry' }],
    lastRunAt: null,
  };
  routines.unshift(newRoutine);
  saveRoutines(routines);
  res.json({ routine: newRoutine, routines });
});

app.post('/api/routines/:id/run', async (req, res) => {
  const routines = loadRoutines();
  const idx = routines.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Routine not found' });

  const routine = routines[idx];
  const results = [];
  for (const step of routine.steps) {
    const out = await executeAgentTool(step.tool, step.args || {});
    results.push({ ...out, stepLabel: step.label });
  }
  routines[idx].lastRunAt = new Date().toISOString();
  saveRoutines(routines);
  res.json({
    routine: routines[idx],
    results,
    memories: loadMemories(),
  });
});

// DIRECT TOOL EXECUTION ENDPOINT
app.post('/api/execute-action', async (req, res) => {
  const { tool, args } = req.body || {};
  if (tool !== 'subscription_desktop_handoff') {
    return res.status(403).json({ error: 'This endpoint only supports the explicit Open in App handoff.' });
  }
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return res.status(400).json({ error: 'A provider and prompt are required for the handoff.' });
  }

  const handoff = validateDesktopHandoff(args.modelId, args.prompt);
  if (handoff.error) return res.status(400).json({ error: handoff.error });

  const result = await executeAgentTool('subscription_desktop_handoff', handoff);
  res.json({ result, memories: loadMemories() });
});

// Workspace file index and read-only Git diff endpoints
app.get('/api/git/diff', async (req, res) => {
  try {
    const { fullPath, relPath } = resolveWorkspacePath(req.query.path);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return res.status(404).json({ error: 'Workspace file not found.' });
    }
    const [working, staged] = await Promise.all([
      execFileAsync('git', ['diff', '--no-ext-diff', '--', relPath], {
        cwd: rootDir, timeout: 6000, maxBuffer: 2 * 1024 * 1024, env: CHILD_ENV,
      }),
      execFileAsync('git', ['diff', '--cached', '--no-ext-diff', '--', relPath], {
        cwd: rootDir, timeout: 6000, maxBuffer: 2 * 1024 * 1024, env: CHILD_ENV,
      }),
    ]);
    res.json({
      path: relPath,
      workingDiff: (working.stdout || '').slice(0, 50000),
      stagedDiff: (staged.stdout || '').slice(0, 50000),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/fs-graph', (_req, res) => {
  const nodes = [];
  const links = [];

  function scanDir(dirPath, parentId = null, depth = 0) {
    if (depth > 3) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist'
      ) {
        continue;
      }
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(rootDir, fullPath);
      const id = relPath.replace(/\\/g, '/');

      if (entry.isDirectory()) {
        nodes.push({
          id,
          label: entry.name,
          type: 'directory',
          lines: 0,
          size: 18,
          depth,
        });
        if (parentId) {
          links.push({ source: parentId, target: id, kind: 'contains' });
        }
        scanDir(fullPath, id, depth + 1);
      } else {
        let content = '';
        let lines = 10;
        try {
          content = fs.readFileSync(fullPath, 'utf8');
          lines = content.split('\n').length;
        } catch {
          // ignore binary
        }

        const ext = path.extname(entry.name);
        nodes.push({
          id,
          label: entry.name,
          type: ext === '.tsx' || ext === '.ts' ? 'module' : ext === '.json' ? 'config' : 'file',
          lines,
          size: Math.min(34, Math.max(10, Math.round(Math.sqrt(lines) * 1.6))),
          depth,
          preview: content.slice(0, 4000),
          previewTruncated: content.length > 4000,
        });
        if (parentId) {
          links.push({ source: parentId, target: id, kind: 'contains' });
        }
      }
    }
  }

  nodes.push({
    id: 'root',
    label: 'Aspira',
    type: 'core',
    lines: 0,
    size: 28,
    depth: 0,
  });
  scanDir(rootDir, 'root', 1);

  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const node of nodes) {
    if (!node.preview) continue;
    const imports = [...node.preview.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)];
    for (const match of imports) {
      const baseDir = path.dirname(node.id);
      const candidates = [
        `${baseDir}/${match[1]}.ts`,
        `${baseDir}/${match[1]}.tsx`,
        `${baseDir}/${match[1]}.js`,
      ];
      for (const c of candidates) {
        if (nodeIds.has(c)) {
          links.push({ source: node.id, target: c, kind: 'imports' });
        }
      }
    }
  }

  res.json({ nodes, links });
});

// Curated local command presets. Commands run without a shell.
const SAFE_COMMANDS = {
  'git-status': 'git status -s && git log -n 3 --oneline',
  'sys-procs': 'ps -Ao comm,%cpu,%mem -r | head -n 10',
  'disk-df': 'df -h .',
  'net-stat': 'ifconfig | grep "inet " | head -n 5',
  'tree-scan': 'find src -maxdepth 3',
};

app.post('/api/terminal', (req, res) => {
  const { preset, customCommand } = req.body || {};
  if (customCommand) {
    executeAgentTool('shell_exec', { command: customCommand }).then((r) => {
      res.json({
        command: customCommand,
        output: r.output,
        timestamp: new Date().toISOString(),
      });
    });
    return;
  }
  const cmd = SAFE_COMMANDS[preset] || SAFE_COMMANDS['sys-procs'];
  runWorkspaceCommand(cmd).then((output) => {
    res.json({
      command: cmd,
      output,
      timestamp: new Date().toISOString(),
    });
  }).catch((err) => {
    res.status(400).json({
      command: cmd,
      output: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });
  });
});

// ============================================================================
// 5. SUBSCRIPTION-FIRST + ACTION-EXECUTING MULTI-AGENT DISPATCH (/api/dispatch)
// ============================================================================
app.post('/api/dispatch', async (req, res) => {
  const requestAbort = new AbortController();
  req.once('aborted', () => requestAbort.abort());
  res.once('close', () => {
    if (!res.writableFinished) requestAbort.abort();
  });
  const providerFetch = (input, init = {}) =>
    fetch(input, {
      ...init,
      signal: AbortSignal.any([requestAbort.signal, AbortSignal.timeout(60_000)]),
    });

  const {
    modelId,
    prompt,
    systemPrompt,
    apiKeys = {},
    endpointConfig,
    conversationHistory = [],
    executeActions = false,
  } = req.body || {};
  const startTime = Date.now();

  // Keep deterministic local actions available when the user did not select a model.
  let executedActions = [];
  if (modelId === 'local' && executeActions && prompt) {
    executedActions = await detectAndRunNaturalActions(prompt, modelId);
  }
  if (requestAbort.signal.aborted) return;

  // 2. Load saved user context for the selected provider prompt
  const memories = loadMemories().slice(0, 8);
  const memoryBlock =
    memories.length > 0
      ? `\n\n[DOT LIVING MEMORY BANK (User Context & Active Goals)]:\n${memories
          .map((m) => `- [${m.category.toUpperCase()} | ${m.status}] ${m.content}`)
          .join('\n')}`
      : '';

  const recentHistoryText =
    Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? `\n\n[RECENT CONVERSATION HISTORY]:\n${conversationHistory
          .slice(-6)
          .map((msg) => `${msg.role === 'user' ? 'User' : msg.speaker || 'Agent'}: ${msg.text}`)
          .join('\n')}`
      : '';

  const fullSystemPrompt = `${
    systemPrompt || 'You are a conversational personal AI assistant inside Aspira.'
  }\nRespond naturally and concisely. Be clear about completed actions and uncertainty. Describe actions in plain language; do not expose internal tool IDs unless the user asks. Summarize the relevant result instead of repeating raw output. Only claim an action was completed when its result is included here.${memoryBlock}${executeActions ? `\n\n${MODEL_ACTION_TOOLS}` : ''}`;

  if (modelId === 'local') {
    if (!executedActions.length) {
      return res.status(422).json({
        source: 'UNAVAILABLE',
        modelId,
        text: null,
        error: 'No local action matched that request. Connect and select a provider for a conversation.',
        executedActions,
        memories: loadMemories(),
      });
    }
    const summary = executedActions
      .map((action) => `${action.status === 'success' ? 'Done' : 'Could not complete'}: ${action.title}.`)
      .join('\n');
    return res.json({
      source: 'LOCAL_ACTIONS',
      modelId,
      text: summary,
      executedActions,
      memories: loadMemories(),
      latencyMs: Date.now() - startTime,
    });
  }

  const baseUserPrompt = `${recentHistoryText}\n\nUser: ${prompt}`;
  const toolResults = [];
  let completion = null;
  let toolCallCount = 0;
  const maxToolCalls = 3;

  try {
    while (!requestAbort.signal.aborted) {
      const toolResultContext = toolResults.length
        ? `\n\n[ASPIRA TOOL RESULTS]\n${toolResults.map((action, index) =>
            `${index + 1}. ${action.tool} — ${action.status}: ${action.title}\n${String(action.output || '').slice(0, 3500)}`
          ).join('\n\n')}`
        : '';
      const currentSystemPrompt = toolCallCount >= maxToolCalls
        ? `${fullSystemPrompt}\n\nDo not request more tools. Give the best concise answer using the results already provided.`
        : fullSystemPrompt;
      const currentUserPrompt = `${baseUserPrompt}${toolResultContext}\n\nRespond conversationally and be clear about what you did.`;
      const cliPrompt = `${currentSystemPrompt}\n\n${currentUserPrompt}`;
      completion = await requestProviderCompletion({
        modelId,
        cliPrompt,
        systemPrompt: currentSystemPrompt,
        userPrompt: currentUserPrompt,
        apiKeys,
        endpointConfig,
        signal: requestAbort.signal,
        providerFetch,
      });

      if (requestAbort.signal.aborted) return;
      if (!completion?.text) {
        return res.status(503).json({
          source: 'UNAVAILABLE',
          modelId,
          text: null,
          error: completion?.error || 'The selected provider did not return a response.',
          executedActions,
          memories: loadMemories(),
          latencyMs: Date.now() - startTime,
        });
      }

      const toolCall = executeActions && toolCallCount < maxToolCalls
        ? parseModelToolCall(completion.text)
        : null;
      if (!toolCall) break;

      toolCallCount += 1;
      const action = await executeModelToolCall(toolCall, prompt, modelId, requestAbort.signal);
      if (requestAbort.signal.aborted) return;
      action.tool = toolCall.tool;
      const modelToolTitles = {
        'workspace.git_status': 'Read Git status',
        'workspace.list_files': 'List workspace files',
        'workspace.search_text': 'Search workspace files',
        'workspace.read_file': 'Read workspace file',
        'workspace.create_file': 'Create workspace file',
        'system.status': 'Read system status',
        'app.open': `Open ${String(toolCall.arguments.app || 'app')}`,
        'browser.open_url': 'Open URL in browser',
        'web.search': 'Search public web',
        'memory.save': 'Save requested memory',
      };
      action.title = modelToolTitles[toolCall.tool] || action.title;
      executedActions.push(action);
      toolResults.push(action);
    }
  } catch (error) {
    if (requestAbort.signal.aborted) return;
    const message = error instanceof Error ? error.message : 'The provider request failed.';
    return res.status(503).json({
      source: 'UNAVAILABLE',
      modelId,
      text: null,
      error: message,
      executedActions,
      memories: loadMemories(),
      latencyMs: Date.now() - startTime,
    });
  }

  if (requestAbort.signal.aborted) return;
  return res.json({
    source: completion?.source || 'UNAVAILABLE',
    providerBadge: completion?.providerBadge,
    modelId,
    text: completion?.text || null,
    error: completion?.text ? undefined : 'The selected provider did not return a response.',
    executedActions,
    memories: loadMemories(),
    latencyMs: Date.now() - startTime,
  });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, '127.0.0.1', () => {
  const subs = detectSubscriptions();
  const activeCount = Object.values(subs).filter((s) => s.cliPath).length;
  console.log(
    `\x1b[32m[Aspira local workspace] Online at http://127.0.0.1:${PORT} | ${activeCount}/4 provider CLIs detected\x1b[0m`
  );
});
