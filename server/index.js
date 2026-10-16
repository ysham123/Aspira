import express from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

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

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const memoryFile = path.join(dataDir, 'memory.json');
const routinesFile = path.join(dataDir, 'routines.json');

// Provider CLI discovery and subscription-first inference bridge.
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
  // Detect local sign-in state. A desktop app alone does not provide an inference bridge.
  // 1. CLAUDE (Claude Pro / Max via `claude` CLI OAuth)
  const claudeCli = firstExistingPath([
    path.join(homeDir, '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]);
  const claudeDesktopApp = firstExistingPath([
    '/Applications/Claude.app',
    '/Applications/Claude Science.app',
  ]);

  // 2. GPT / CHATGPT (ChatGPT Plus / Pro via `codex` CLI OAuth)
  const codexCli = firstExistingPath([
    '/opt/homebrew/bin/codex',
    path.join(homeDir, '.local', 'bin', 'codex'),
    '/usr/local/bin/codex',
  ]);
  const chatgptDesktopApp = firstExistingPath([
    '/Applications/ChatGPT.app',
    '/Applications/ChatGPT Classic.app',
  ]);

  // 3. GROK (SuperGrok / X Premium+ via `grok` CLI OAuth ~/.grok/auth.json)
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
      providerName: 'Claude Pro / Max Subscription',
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
      providerName: 'Grok / X Premium+ Subscription',
      cliPath: grokCli,
      desktopAppPath: null,
      methodLabel: grokCli
        ? 'Grok Build CLI found · sign-in checked on first request'
        : 'No supported CLI detected',
      loginCommand: grokCli ? `${grokCli} login` : 'open "https://grok.com"',
    },
    gpt: {
      modelId: 'gpt',
      providerName: 'ChatGPT Plus / Pro Subscription',
      cliPath: codexCli,
      desktopAppPath: chatgptDesktopApp,
      methodLabel: codexCli
        ? 'Codex CLI found · sign-in checked on first request'
        : chatgptDesktopApp
        ? 'ChatGPT desktop app found · install Codex CLI to connect inference'
        : 'Not connected',
      loginCommand: codexCli ? `${codexCli} login` : 'open -a "ChatGPT"',
    },
  };
}

// Run a CLI binary safely with argument array (no shell injection) and timeout
function runCliProcess(binary, args, timeoutMs = 16000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(binary, args, {
      cwd: rootDir,
      env: CHILD_ENV,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Subscription CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Exited with code ${code}`));
      }
    });
  });
}

function runCliStatus(binary, args, timeoutMs = 7000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn(binary, args, {
      cwd: rootDir,
      env: CHILD_ENV,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Provider status check timed out.'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 20000) stdout += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, code });
    });
  });
}

async function getSubscriptionStatuses() {
  const subscriptions = detectSubscriptions();
  const claude = subscriptions.claude;
  if (claude?.cliPath) {
    try {
      const result = await runCliStatus(claude.cliPath, ['auth', 'status', '--json']);
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
async function runSubscriptionInference(modelId, fullPrompt, subs) {
  let error = null;
  const timeoutMs = 90000;
  // Run the supported Antigravity CLI headless; never read its credential store.
  if (modelId === 'argon' && subs.argon?.cliPath) {
    try {
      const out = await runCliProcess(
        subs.argon.cliPath,
        ['--sandbox', '--mode', 'plan', '-p', fullPrompt, '--output-format', 'text', '--print-timeout', '90s'],
        timeoutMs
      );
      if (out) return { text: out, badge: 'ANTIGRAVITY_CLI' };
    } catch (err) {
      error = summarizeProviderFailure('Antigravity', err);
    }
  }

  // 2. CLAUDE SUBSCRIPTION (via ~/.local/bin/claude -p)
  if (modelId === 'claude' && subs.claude?.cliPath) {
    try {
      try {
        const status = await runCliStatus(subs.claude.cliPath, ['auth', 'status', '--json']);
        const auth = JSON.parse(status.stdout || '{}');
        if (auth.loggedIn === false) {
          return { error: 'Claude Code is signed out. Use Settings → Connections → Open CLI sign-in, then retry.' };
        }
      } catch {
        // Continue to a real request; report its result if the status check is unavailable.
      }
      const out = await runCliProcess(
        subs.claude.cliPath,
        ['-p', fullPrompt, '--output-format', 'text', '--permission-mode', 'plan', '--max-turns', '1'],
        timeoutMs
      );
      if (out) {
        return { text: out, badge: 'CLAUDE_SUBSCRIPTION' };
      }
    } catch (err) {
      error = summarizeProviderFailure('Claude Code', err);
    }
  }

  // 3. GROK SUBSCRIPTION (via ~/.grok/bin/grok -p)
  if (modelId === 'grok' && subs.grok?.cliPath) {
    try {
      const out = await runCliProcess(
        subs.grok.cliPath,
        [
          '-p',
          fullPrompt,
          '--output-format',
          'plain',
          '--permission-mode',
          'plan',
          '--no-subagents',
          '--no-auto-update',
          '--max-turns',
          '1',
        ],
        timeoutMs
      );
      if (out) {
        return { text: out, badge: 'GROK_SUBSCRIPTION' };
      }
    } catch (err) {
      error = summarizeProviderFailure('Grok Build', err);
    }
  }

  // 4. CHATGPT PLUS/PRO SUBSCRIPTION (via /opt/homebrew/bin/codex exec)
  if (modelId === 'gpt' && subs.gpt?.cliPath) {
    const tmpOut = path.join(os.tmpdir(), `aspira-codex-${Date.now()}.txt`);
    try {
      await runCliProcess(
        subs.gpt.cliPath,
        [
          'exec',
          '--ephemeral',
          '--skip-git-repo-check',
          '--color',
          'never',
          '-s',
          'read-only',
          '-o',
          tmpOut,
          fullPrompt,
        ],
        timeoutMs
      );
      if (fs.existsSync(tmpOut)) {
        const text = fs.readFileSync(tmpOut, 'utf8').trim();
        fs.unlinkSync(tmpOut);
        if (text) {
          return { text, badge: 'CHATGPT_SUBSCRIPTION' };
        }
      }
    } catch (err) {
      error = summarizeProviderFailure('Codex', err);
      try {
        if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
      } catch {
        // ignore
      }
    }
  }

  return error ? { error } : null;
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
  if (fs.existsSync(fullPath) && !isInsideDirectory(realRoot, fs.realpathSync(fullPath))) {
    throw new Error('Symlink paths outside the workspace are not permitted.');
  }
  return { fullPath, relPath };
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

async function executeAgentTool(tool, args = {}) {
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
          title: `Handed Off to ${targetApp}.app Subscription`,
          status: 'success',
          output: `Copied prompt to macOS Clipboard and focused ${targetApp}.app (Press ⌘V + Return if not auto-pasted).`,
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
        const { fullPath, relPath } = resolveWorkspacePath(args.path || 'workspace-note.md');
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, String(args.content || ''), 'utf8');
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'fs_write',
          title: `Wrote File: ${relPath}`,
          status: 'success',
          output: `Saved ${String(args.content || '').length} bytes to ${relPath}`,
          durationMs: Date.now() - start,
        };
      }

      case 'fs_read': {
        const { fullPath, relPath } = resolveWorkspacePath(args.path || 'README.md');
        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
          throw new Error(`File not found: ${relPath}`);
        }
        const content = fs.readFileSync(fullPath, 'utf8').slice(0, 2500);
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'fs_read',
          title: `Read File: ${relPath}`,
          status: 'success',
          output: content,
          durationMs: Date.now() - start,
        };
      }

      case 'web_search': {
        const query = String(args.query || 'AI agents');
        const results = [];
        try {
          const ddgRes = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
          );
          if (ddgRes.ok) {
            const ddg = await ddgRes.json();
            if (ddg.AbstractText) {
              results.push(`Summary: ${ddg.AbstractText} (${ddg.AbstractURL || 'DuckDuckGo'})`);
            }
            if (Array.isArray(ddg.RelatedTopics)) {
              for (const topic of ddg.RelatedTopics.slice(0, 4)) {
                if (topic.Text) results.push(`• ${topic.Text}`);
              }
            }
          }
        } catch {
          // ignore
        }

        try {
          if (results.length < 2) {
            const hnRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
            if (hnRes.ok) {
              const ids = (await hnRes.json()).slice(0, 5);
              const stories = await Promise.all(
                ids.map((id) =>
                  fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json())
                )
              );
              for (const s of stories) {
                if (s?.title) {
                  results.push(`• [HN ${s.score || 0} pts] ${s.title} (${s.url || 'news.ycombinator.com'})`);
                }
              }
            }
          }
        } catch {
          // ignore
        }

        const output =
          results.length > 0
            ? results.join('\n')
            : '';

        if (!output) {
          return {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool: 'web_search',
            title: `No quick search results for "${query}"`,
            status: 'error',
            output: 'The quick lookup returned no result. Try a more specific query or open a search page in your browser.',
            durationMs: Date.now() - start,
          };
        }

        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'web_search',
          title: `Quick lookup: "${query}"`,
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
  const cmdMatch = prompt.match(
    /\b(?:run|execute)\s+`?((?:git|ls|df|uptime|whoami|date|find|cat|head|ps|pmset)[^`]*?)`?$/i
  );
  if (cmdMatch) {
    actions.push(await executeAgentTool('shell_exec', { command: cmdMatch[1].trim() }));
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
  const result = await executeAgentTool('subscription_desktop_handoff', { modelId, prompt });
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
  const { tool, args = {} } = req.body || {};
  const result = await executeAgentTool(tool, args);
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

function isLoopbackHttpUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

// Local MLX-Audio TTS bridge. Audio requests stay on the user's machine.
app.post('/api/tts', async (req, res) => {
  const {
    text,
    endpoint = process.env.LOCAL_TTS_URL || 'http://127.0.0.1:8000/v1/audio/speech',
    model = 'mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit',
    voice = 'Ryan',
  } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Speech text is required.' });
  }
  if (!isLoopbackHttpUrl(endpoint)) {
    return res.status(400).json({ error: 'Voice endpoint must use localhost.' });
  }

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: text.trim(),
        voice,
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (r.ok) {
      const arrayBuffer = await r.arrayBuffer();
      res.setHeader('Content-Type', r.headers.get('content-type') || 'audio/wav');
      return res.send(Buffer.from(arrayBuffer));
    }
    return res.status(502).json({ error: 'The local voice service rejected the request.' });
  } catch (error) {
    return res.status(503).json({
      error: 'Local voice service is unavailable. Start it with npm run voice:local.',
    });
  }
});

// Local-only speech recognition through the same MLX-Audio server.
app.post(
  '/api/voice/transcribe',
  express.raw({ type: ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'], limit: '20mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'A recorded audio message is required.' });
    }

    const baseUrl = process.env.LOCAL_MLX_AUDIO_URL || 'http://127.0.0.1:8000';
    if (!isLoopbackHttpUrl(baseUrl)) {
      return res.status(400).json({ error: 'Voice endpoint must use localhost.' });
    }

    try {
      const url = new URL('/v1/audio/transcriptions', baseUrl);
      const audioType = String(req.get('content-type') || 'audio/webm').split(';')[0];
      const form = new FormData();
      form.append('file', new Blob([req.body], { type: audioType }), audioType.includes('mp4') ? 'voice.m4a' : 'voice.webm');
      form.append('model', 'mlx-community/whisper-large-v3-turbo-asr-fp16');
      const response = await fetch(url, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) {
        return res.status(502).json({ error: 'The local speech service rejected the recording.' });
      }
      const data = await response.json();
      return res.json({ text: typeof data?.text === 'string' ? data.text.trim() : '' });
    } catch {
      return res.status(503).json({ error: 'Local speech service is unavailable. Start it with npm run voice:local.' });
    }
  }
);

app.get('/api/voice/status', async (_req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:8000/v1/models', {
      signal: AbortSignal.timeout(1500),
    });
    return res.json({ ready: response.ok, engine: response.ok ? 'MLX-Audio' : null });
  } catch {
    return res.json({ ready: false, engine: null });
  }
});

// ============================================================================
// 5. SUBSCRIPTION-FIRST + ACTION-EXECUTING MULTI-AGENT DISPATCH (/api/dispatch)
// ============================================================================
app.post('/api/dispatch', async (req, res) => {
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

  // 1. If this agent is the lead executor for this turn, detect & execute real host actions first!
  let executedActions = [];
  if (executeActions && prompt) {
    executedActions = await detectAndRunNaturalActions(prompt, modelId);
  }

  // 2. Load saved user context for the selected provider prompt
  const memories = loadMemories().slice(0, 8);
  const memoryBlock =
    memories.length > 0
      ? `\n\n[DOT LIVING MEMORY BANK (User Context & Active Goals)]:\n${memories
          .map((m) => `- [${m.category.toUpperCase()} | ${m.status}] ${m.content}`)
          .join('\n')}`
      : '';

  const actionBlock =
    executedActions.length > 0
      ? `\n\n[REAL ACTIONS ALREADY EXECUTED ON USER'S MAC FOR THIS TURN]:\n${executedActions
          .map((a) => `- Tool \`${a.tool}\` (${a.title}): ${a.output}`)
          .join('\n')}\nAcknowledge these completed actions naturally and conversationally in your response.`
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
  }\nRespond naturally and be concise. Be clear about completed actions and uncertainty. Do not claim to have used a tool unless its result is included here.${memoryBlock}${actionBlock}`;

  const combinedPromptForCli = `${fullSystemPrompt}${recentHistoryText}\n\nUser: ${prompt}\n\nRespond directly in 2-3 concise conversational sentences:`;
  let unavailableReason = 'No connected model returned a response. Check its connection in Settings.';

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

  try {
    // ========================================================================
    // TIER 1: Provider CLI subscription bridge (API keys remain optional).
    const subs = detectSubscriptions();
    if (!apiKeys[modelId] && !subs[modelId]?.cliPath && !endpointConfig?.baseUrl) {
      unavailableReason = `${modelId} is not connected. Sign in to its supported CLI or configure a provider in Settings.`;
    } else if (subs[modelId]?.cliPath) {
      unavailableReason = `${modelId} CLI did not return a response. Sign in or refresh its session, then try again.`;
    }
    if (!apiKeys[modelId]) {
      const subOut = await runSubscriptionInference(modelId, combinedPromptForCli, subs);
      if (subOut?.text) {
        return res.json({
          source: 'SUBSCRIPTION_OAUTH',
          subscriptionBadge: subOut.badge,
          modelId,
          text: subOut.text,
          executedActions,
          memories: loadMemories(),
          latencyMs: Date.now() - startTime,
        });
      }
      if (subOut?.error) unavailableReason = subOut.error;
    }

    // ========================================================================
    // TIER 2: OPTIONAL CLOUD API KEYS (If user explicitly configured BYOK)
    // ========================================================================
    const geminiKey = apiKeys.argon || process.env.GEMINI_API_KEY;
    if (modelId === 'argon' && geminiKey) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: combinedPromptForCli }] }],
          }),
        }
      );
      if (r.ok) {
        const data = await r.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return res.json({
            source: 'LIVE_API',
            modelId,
            text,
            executedActions,
            memories: loadMemories(),
            latencyMs: Date.now() - startTime,
          });
        }
      }
    }

    const claudeKey = apiKeys.claude || process.env.ANTHROPIC_API_KEY;
    if (modelId === 'claude' && claudeKey) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 600,
          system: fullSystemPrompt,
          messages: [{ role: 'user', content: `${recentHistoryText}\n\nUser: ${prompt}` }],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data?.content?.[0]?.text;
        if (text) {
          return res.json({
            source: 'LIVE_API',
            modelId,
            text,
            executedActions,
            memories: loadMemories(),
            latencyMs: Date.now() - startTime,
          });
        }
      }
    }

    const grokKey = apiKeys.grok || process.env.XAI_API_KEY;
    if (modelId === 'grok' && grokKey) {
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${grokKey}`,
        },
        body: JSON.stringify({
          model: 'grok-3-latest',
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: `${recentHistoryText}\n\nUser: ${prompt}` },
          ],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return res.json({
            source: 'LIVE_API',
            modelId,
            text,
            executedActions,
            memories: loadMemories(),
            latencyMs: Date.now() - startTime,
          });
        }
      }
    }

    const gptKey = apiKeys.gpt || process.env.OPENAI_API_KEY;
    if (modelId === 'gpt' && gptKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gptKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: `${recentHistoryText}\n\nUser: ${prompt}` },
          ],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return res.json({
            source: 'LIVE_API',
            modelId,
            text,
            executedActions,
            memories: loadMemories(),
            latencyMs: Date.now() - startTime,
          });
        }
      }
    }

    // ========================================================================
    // TIER 3: CUSTOM OPENAI-COMPATIBLE OR CLIProxyAPI SUBSCRIPTION BRIDGE
    // ========================================================================
    if (endpointConfig?.baseUrl) {
      const customKey = apiKeys[modelId] || '';
      const headers = { 'Content-Type': 'application/json' };
      if (customKey) headers.Authorization = `Bearer ${customKey}`;

      const r = await fetch(`${endpointConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: endpointConfig.apiModelId || modelId,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: `${recentHistoryText}\n\nUser: ${prompt}` },
          ],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return res.json({
            source: 'LIVE_API',
            modelId,
            text,
            executedActions,
            memories: loadMemories(),
            latencyMs: Date.now() - startTime,
          });
        }
      }
    }

  } catch (error) {
    unavailableReason = error instanceof Error ? error.message : unavailableReason;
  }

  return res.status(503).json({
    source: 'UNAVAILABLE',
    modelId,
    text: null,
    error: unavailableReason,
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
