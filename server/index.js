import express from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const memoryFile = path.join(dataDir, 'memory.json');
const routinesFile = path.join(dataDir, 'routines.json');

// ============================================================================
// 1. DOT-STYLE AGENTIC LIVING MEMORY STORE (server/data/memory.json)
// ============================================================================
const DEFAULT_MEMORIES = [
  {
    id: 'mem-1',
    content: 'Building Aspira — an open-source, conversational, action-executing multi-agent studio on macOS.',
    category: 'project',
    status: 'IN_PROGRESS',
    emotionalTone: 'Focused',
    sourceAgent: 'argon',
    createdAt: new Date().toISOString(),
    tags: ['aspira', 'macos', 'agents'],
  },
  {
    id: 'mem-2',
    content: 'Prefers modern, serene Tier-1 AI Lab aesthetics (Google Gemini, OpenAI, Anthropic, Linear) with real action execution like Muse, Grok Bot, OpenClaw, and Dot.',
    category: 'preference',
    status: 'ACTIVE',
    emotionalTone: 'Decisive',
    sourceAgent: 'claude',
    createdAt: new Date().toISOString(),
    tags: ['design', 'autonomy', 'voice'],
  },
];

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

// ============================================================================
// 2. GROKBOT / OPENCLAW AUTONOMOUS ROUTINES STORE (server/data/routines.json)
// ============================================================================
const DEFAULT_ROUTINES = [
  {
    id: 'routine-morning-brief',
    title: 'Executive Morning & System Briefing',
    description: 'Audits macOS hardware/battery, checks git workspace status, fetches live HackerNews top stories, and synthesizes a spoken briefing.',
    schedule: 'Daily · 09:00',
    leadAgent: 'argon',
    steps: [
      { tool: 'system_status', label: 'Audit macOS CPU, Memory & Battery' },
      { tool: 'shell_exec', args: { command: 'git status -s && git log -n 3 --oneline' }, label: 'Inspect Git Repository State' },
      { tool: 'web_search', args: { query: 'HackerNews top AI & engineering stories' }, label: 'Fetch Live Tech & AI Signals' },
    ],
    lastRunAt: null,
  },
  {
    id: 'routine-deep-work',
    title: 'Deep Focus Workspace Launch',
    description: 'Opens Notes & Terminal, verifies local build health, and logs an active focus session into Dot Living Memory.',
    schedule: 'On Demand / Voice Trigger',
    leadAgent: 'claude',
    steps: [
      { tool: 'macos_notify', args: { title: 'Aspira Deep Focus', message: 'Initializing workspace & silencing distractions.' }, label: 'Trigger macOS Focus Notification' },
      { tool: 'shell_exec', args: { command: 'ls -la src/components' }, label: 'Verify Studio Component Tree' },
      { tool: 'memory_store', args: { content: 'Initiated Deep Focus coding session in Aspira.', category: 'task', status: 'IN_PROGRESS' }, label: 'Log Session in Living Memory' },
    ],
    lastRunAt: null,
  },
  {
    id: 'routine-live-recon',
    title: 'Grok Live X & Web Recon Sweep',
    description: 'Sweeps live web & HackerNews feeds for autonomous AI agents (Muse, Grok Bot, OpenClaw, Dot) and summarizes actionable insights.',
    schedule: 'Every 4 Hours',
    leadAgent: 'grok',
    steps: [
      { tool: 'web_search', args: { query: 'autonomous AI agents macOS computer use 2026' }, label: 'Sweep Live Web Intelligence' },
      { tool: 'system_status', label: 'Check Local Neural Engine Readiness' },
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
// 3. OPENCLAW / MUSE / MACOS-USE REAL ACTION EXECUTION ENGINE
// ============================================================================
const ALLOWED_SHELL_PREFIXES = [
  'git ',
  'ls',
  'pwd',
  'whoami',
  'date',
  'uptime',
  'df ',
  'du ',
  'find ',
  'cat ',
  'head ',
  'tail ',
  'wc ',
  'node -v',
  'npm -v',
  'python3 --version',
  'sw_vers',
  'pmset -g batt',
  'ifconfig',
  'ps ',
  'echo ',
  'mkdir ',
  'touch ',
];

async function executeAgentTool(tool, args = {}) {
  const start = Date.now();
  try {
    switch (tool) {
      case 'macos_app': {
        const appName = String(args.app || 'Safari').replace(/[^a-zA-Z0-9 ._-]/g, '');
        await execAsync(`open -a "${appName}"`);
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'macos_app',
          title: `Launched macOS App: ${appName}`,
          status: 'success',
          output: `Executed \`open -a "${appName}"\` on macOS host.`,
          durationMs: Date.now() - start,
        };
      }

      case 'macos_notify': {
        const title = String(args.title || 'Aspira Agent').replace(/"/g, '\\"');
        const message = String(args.message || 'Action completed.').replace(/"/g, '\\"');
        await execAsync(
          `osascript -e 'display notification "${message}" with title "${title}" sound name "Glass"'`
        );
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'macos_notify',
          title: `macOS Notification: ${title}`,
          status: 'success',
          output: `Displayed native macOS banner: "${message}"`,
          durationMs: Date.now() - start,
        };
      }

      case 'macos_say': {
        const phrase = String(args.text || 'Aspira online').replace(/"/g, '\\"');
        exec(`say "${phrase}"`);
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'macos_say',
          title: 'macOS Native Voice Output',
          status: 'success',
          output: `Spoke via macOS audio engine: "${phrase}"`,
          durationMs: Date.now() - start,
        };
      }

      case 'open_url': {
        const rawUrl = String(args.url || 'https://news.ycombinator.com');
        const safeUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        await execAsync(`open "${safeUrl.replace(/"/g, '')}"`);
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
        let battInfo = 'AC Power / Nominal';
        try {
          const { stdout } = await execAsync('pmset -g batt');
          battInfo = stdout.split('\n').slice(0, 2).join(' | ').trim();
        } catch {
          // ignore
        }
        const summary = `Host: ${os.hostname()} (${os.platform()} ${os.arch()})\nCPU: ${cpus[0]?.model} (${cpus.length} cores, Load: ${os.loadavg().map((n) => n.toFixed(2)).join(', ')})\nMemory: ${usedMem.toFixed(1)} GB used / ${totalMem} GB total (${freeMem} GB free)\nPower: ${battInfo}`;
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'system_status',
          title: 'Audited macOS Hardware & Power Telemetry',
          status: 'success',
          output: summary,
          durationMs: Date.now() - start,
        };
      }

      case 'shell_exec': {
        const cmd = String(args.command || 'git status -s').trim();
        const isSafe = ALLOWED_SHELL_PREFIXES.some((prefix) => cmd.startsWith(prefix));
        if (!isSafe) {
          return {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool: 'shell_exec',
            title: `Sentinel Blocked Command: ${cmd}`,
            status: 'blocked',
            output: `Muse Sentinel blocked "${cmd}" outside safe allowlist. Allowed prefixes: git, ls, find, cat, df, ps, pmset, node -v.`,
            durationMs: Date.now() - start,
          };
        }
        const { stdout, stderr } = await execAsync(cmd, { cwd: rootDir, timeout: 6000 });
        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'shell_exec',
          title: `Executed Shell: ${cmd}`,
          status: 'success',
          output: (stdout || stderr || 'Command completed with 0 output.').slice(0, 2500),
          durationMs: Date.now() - start,
        };
      }

      case 'fs_write': {
        const relPath = String(args.path || 'workspace-note.md').replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.resolve(rootDir, relPath);
        if (!fullPath.startsWith(rootDir)) {
          throw new Error('Path traversal outside workspace is not permitted.');
        }
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
        const relPath = String(args.path || 'README.md').replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.resolve(rootDir, relPath);
        if (!fullPath.startsWith(rootDir) || !fs.existsSync(fullPath)) {
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
          // 1. DuckDuckGo Instant Answer API
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
          // ignore network restrictions
        }

        try {
          // 2. Also fetch top HackerNews stories if query relates to tech/news/AI
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
            : `Live search executed for "${query}". (Tip: Say "open browser for ${query}" to launch full web view).`;

        return {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'web_search',
          title: `Live Web Recon: "${query}"`,
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
          title: `Saved to Dot Living Memory (${newMem.category.toUpperCase()})`,
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
// 4. NATURAL LANGUAGE INTENT -> REAL ACTION PARSER (Works instantaneously!)
// ============================================================================
async function detectAndRunNaturalActions(prompt, leadAgent = 'argon') {
  const actions = [];
  const lower = prompt.toLowerCase().trim();

  // 1. Open macOS App ("open safari", "launch spotify", "open calculator", "open notes", "open terminal")
  const appMatch = prompt.match(
    /\b(?:open|launch|start)\s+(?:the\s+)?(Safari|Spotify|Notes|Calendar|Calculator|Terminal|Finder|Mail|Messages|Reminders|Music|Preview|Activity Monitor|System Settings|Cursor|Visual Studio Code|Xcode)\b/i
  );
  if (appMatch) {
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

  // 3. Dot Living Memory Extraction ("remember that...", "my goal is...", "remind me to...", "add a task...", "note that I prefer...")
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

  // 4. Create / Write a File ("create a file called hello.py with...", "write a file notes.md...")
  const writeMatch = prompt.match(
    /\b(?:create|write|save)\s+(?:a\s+)?(?:file|script|note)\s+(?:called|named)?\s*['"`]?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)['"`]?(?:\s+(?:with|containing)\s+([\s\S]+))?/i
  );
  if (writeMatch) {
    const fileName = writeMatch[1];
    const fileContent =
      writeMatch[2]?.trim() ||
      `# ${fileName}\nCreated autonomously by Aspira (${leadAgent.toUpperCase()}) at ${new Date().toISOString()}\n`;
    actions.push(await executeAgentTool('fs_write', { path: fileName, content: fileContent }));
  }

  // 5. Read a File ("read README.md", "show me package.json", "inspect server/index.js")
  const readMatch = prompt.match(
    /\b(?:read|show me|cat|inspect)\s+(?:the\s+file\s+)?['"`]?([a-zA-Z0-9_./-]+\.(?:md|json|ts|tsx|js|css|html|py|txt))['"`]?/i
  );
  if (readMatch && !writeMatch) {
    actions.push(await executeAgentTool('fs_read', { path: readMatch[1] }));
  }

  // 6. Run Terminal / Git / System Command ("run git status", "check git log", "list files", "check disk space")
  const cmdMatch = prompt.match(/\b(?:run|execute)\s+`?((?:git|ls|df|uptime|whoami|date|find|cat|head|ps|pmset)[^`]*?)`?$/i);
  if (cmdMatch) {
    actions.push(await executeAgentTool('shell_exec', { command: cmdMatch[1].trim() }));
  } else if (/\b(?:git status|repo status|what changed in git)\b/i.test(lower)) {
    actions.push(await executeAgentTool('shell_exec', { command: 'git status -s && git log -n 3 --oneline' }));
  } else if (/\b(?:battery|power|cpu|memory|ram|system health|hardware|mac status|system status)\b/i.test(lower)) {
    actions.push(await executeAgentTool('system_status', {}));
  } else if (/\b(?:disk space|storage|free space)\b/i.test(lower)) {
    actions.push(await executeAgentTool('shell_exec', { command: 'df -h .' }));
  } else if (/\b(?:running processes|top processes|what is running)\b/i.test(lower)) {
    actions.push(await executeAgentTool('shell_exec', { command: 'ps -Ao comm,%cpu,%mem -r | head -n 10' }));
  }

  // 7. macOS Notification ("send a notification...", "notify me...")
  const notifyMatch = prompt.match(/\b(?:send a notification|notify me)\s+(?:saying|that)?\s*(.+)/i);
  if (notifyMatch) {
    actions.push(
      await executeAgentTool('macos_notify', {
        title: 'Aspira Personal Agent',
        message: notifyMatch[1].trim(),
      })
    );
  }

  // 8. Live Web / News Search ("search the web for...", "what's happening on hackernews", "latest news on...")
  const searchMatch = prompt.match(
    /\b(?:search(?:\s+the\s+web)?\s+for|look up|what is the latest on|hackernews|top stories|news about)\s+(.+)/i
  );
  if (searchMatch && !urlMatch) {
    actions.push(await executeAgentTool('web_search', { query: searchMatch[1].trim() }));
  } else if (/\b(?:hackernews|hacker news|tech news|ai news)\b/i.test(lower) && actions.length === 0) {
    actions.push(await executeAgentTool('web_search', { query: 'HackerNews top stories' }));
  }

  return actions;
}

const app = express();
app.use(express.json({ limit: '5mb' }));

// ============================================================================
// ENDPOINTS: TELEMETRY, AST GRAPH, MEMORY, ROUTINES, ACTION EXECUTION
// ============================================================================

app.get('/api/telemetry', (_req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();

  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  const cpuUsagePercent = Math.min(
    99,
    Math.max(4, Math.round(((total - idle) / total) * 100 + loadAvg[0] * 4))
  );

  res.json({
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    cpuModel: cpus[0]?.model || 'Apple Silicon Neural Engine',
    cpuCores: cpus.length,
    cpuUsagePercent,
    loadAvg: loadAvg.map((n) => Number(n.toFixed(2))),
    memoryUsedGB: Number((usedMem / 1024 ** 3).toFixed(2)),
    memoryTotalGB: Number((totalMem / 1024 ** 3).toFixed(2)),
    memoryPercent: Math.round((usedMem / totalMem) * 100),
    uptimeHours: Number((os.uptime() / 3600).toFixed(1)),
    timestamp: Date.now(),
  });
});

// DOT LIVING MEMORY ENDPOINTS
app.get('/api/memory', (_req, res) => {
  res.json({ memories: loadMemories() });
});

app.post('/api/memory', (req, res) => {
  const { content, category = 'insight', status = 'IN_PROGRESS', emotionalTone = 'Focused', sourceAgent = 'argon', tags = [] } = req.body || {};
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

// GROKBOT / OPENCLAW ROUTINES ENDPOINTS
app.get('/api/routines', (_req, res) => {
  res.json({ routines: loadRoutines() });
});

app.post('/api/routines', (req, res) => {
  const { title, description, schedule = 'On Demand', leadAgent = 'argon', steps = [] } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const routines = loadRoutines();
  const newRoutine = {
    id: `routine-${Date.now()}`,
    title,
    description: description || 'Custom multi-step autonomous agent routine.',
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

// REAL WORKSPACE AST & FILE GRAPH ENDPOINT
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
        let symbols = [];
        try {
          content = fs.readFileSync(fullPath, 'utf8');
          lines = content.split('\n').length;
          const fnMatches = [
            ...content.matchAll(
              /(?:export\s+)?(?:async\s+)?(?:function|const|class|interface|type)\s+([A-Za-z0-9_]+)/g
            ),
          ];
          symbols = fnMatches.slice(0, 10).map((m) => m[1]);
        } catch {
          // ignore binary
        }

        const ext = path.extname(entry.name);
        nodes.push({
          id,
          label: entry.name,
          type: ext === '.tsx' || ext === '.ts' ? 'module' : ext === '.json' ? 'config' : 'file',
          lines,
          symbols,
          size: Math.min(34, Math.max(10, Math.round(Math.sqrt(lines) * 1.6))),
          depth,
          preview: content.slice(0, 4000),
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

// SAFE LOCAL TERMINAL EXECUTION BRIDGE
const SAFE_COMMANDS = {
  'git-status': 'git status -s || ls -la',
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
  exec(cmd, { cwd: rootDir, timeout: 4000 }, (err, stdout, stderr) => {
    res.json({
      command: cmd,
      output: stdout || stderr || (err ? err.message : 'Executed with 0 output'),
      timestamp: new Date().toISOString(),
    });
  });
});

// LOCAL NEURAL VOICE AI BRIDGE (Kokoro-82M / mlx-audio / Orpheus)
app.post('/api/tts', async (req, res) => {
  const { text, endpoint, voice = 'af_heart' } = req.body || {};
  const targetUrl = endpoint || process.env.LOCAL_TTS_URL;
  if (!targetUrl || !text) {
    return res.status(404).json({ localNeuralAudio: false });
  }

  try {
    const r = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: text,
        voice,
        response_format: 'mp3',
      }),
    });
    if (r.ok) {
      const arrayBuffer = await r.arrayBuffer();
      res.setHeader('Content-Type', r.headers.get('content-type') || 'audio/mpeg');
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch {
    // Fallback to browser neural voice
  }
  return res.status(404).json({ localNeuralAudio: false });
});

// ============================================================================
// 5. CONVERSATIONAL + ACTION-EXECUTING MULTI-AGENT DISPATCH (/api/dispatch)
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

  // 2. Load Dot Living Memory context to inject into the agent's prompt
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
    systemPrompt || 'You are a conversational, action-executing personal AI agent inside Aspira on macOS.'
  }\nSpeak naturally, warmly, and concisely like a real-time personal companion (inspired by Dot by New Computer, Meta Muse, and OpenClaw). Avoid robotic headers or filler.${memoryBlock}${actionBlock}`;

  try {
    // A. ARGON (Google Gemini API)
    const geminiKey = apiKeys.argon || process.env.GEMINI_API_KEY;
    if (modelId === 'argon' && geminiKey) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${fullSystemPrompt}${recentHistoryText}\n\nUser: ${prompt}`,
                  },
                ],
              },
            ],
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

    // B. CLAUDE (Anthropic API)
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

    // C. GROK (xAI API)
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

    // D. GPT (OpenAI API)
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

    // E. CUSTOM OPENAI-COMPATIBLE OR LOCAL OLLAMA MODEL PLUGIN
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

    // F. ZERO-CONFIG APPLE SILICON LOCAL OLLAMA BRIDGE (llama3.2:latest / llama3:latest)
    // Automatically powers real conversational responses on the user's Mac when cloud keys aren't set!
    const ollamaModel = modelId === 'argon' ? 'llama3.2:latest' : 'llama3.2:latest';
    const ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...conversationHistory.slice(-6).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (ollamaRes.ok) {
      const ollamaData = await ollamaRes.json();
      const text = ollamaData?.message?.content;
      if (text) {
        return res.json({
          source: 'LOCAL_OLLAMA',
          modelId,
          text,
          executedActions,
          memories: loadMemories(),
          latencyMs: Date.now() - startTime,
        });
      }
    }
  } catch {
    // Fall through if offline
  }

  return res.json({
    source: 'NEURAL_SIMULATOR',
    modelId,
    text: null,
    executedActions,
    memories: loadMemories(),
    latencyMs: Date.now() - startTime,
  });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(
    `\x1b[32m[Aspira Personal Agent OS] Telemetry, Dot Memory, OpenClaw Actions & Ollama/Cloud Bridge online at http://localhost:${PORT}\x1b[0m`
  );
});
