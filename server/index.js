import express from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const app = express();
app.use(express.json({ limit: '5mb' }));

// 1. REAL MACOS HARDWARE & SYSTEM TELEMETRY ENDPOINT
app.get('/api/telemetry', (_req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();

  // Compute aggregate CPU active %
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

// 2. REAL WORKSPACE 3D FILE & AST DEPENDENCY GRAPH ENDPOINT (For Mode 2: 3D Code Forge)
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
          symbols = fnMatches.slice(0, 8).map((m) => m[1]);
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
          preview: content.slice(0, 1200),
        });
        if (parentId) {
          links.push({ source: parentId, target: id, kind: 'contains' });
        }
      }
    }
  }

  nodes.push({
    id: 'root',
    label: 'archon-hud',
    type: 'core',
    lines: 0,
    size: 28,
    depth: 0,
  });
  scanDir(rootDir, 'root', 1);

  // Detect import links between TS/TSX modules
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

// 3. SAFE LOCAL TERMINAL EXECUTION BRIDGE (For Mode 2 & Mode 3)
const SAFE_COMMANDS = {
  'git-status': 'git status -s || ls -la',
  'sys-procs': 'ps -Ao comm,%cpu,%mem -r | head -n 10',
  'disk-df': 'df -h .',
  'net-stat': 'ifconfig | grep "inet " | head -n 5',
  'tree-scan': 'find src -maxdepth 3',
};

app.post('/api/terminal', (req, res) => {
  const { preset } = req.body || {};
  const cmd = SAFE_COMMANDS[preset] || SAFE_COMMANDS['sys-procs'];
  exec(cmd, { cwd: rootDir, timeout: 4000 }, (err, stdout, stderr) => {
    res.json({
      command: cmd,
      output: stdout || stderr || (err ? err.message : 'Executed with 0 output'),
      timestamp: new Date().toISOString(),
    });
  });
});

// 4. UNIVERSAL MULTI-MODEL GATEWAY (Connects Live APIs for Argon/Gemini, Claude, Grok, GPT + Fallback Neural Engine)
app.post('/api/dispatch', async (req, res) => {
  const { modelId, prompt, systemPrompt, apiKeys = {} } = req.body || {};

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
            contents: [{ parts: [{ text: `${systemPrompt || ''}\n\nUser: ${prompt}` }] }],
          }),
        }
      );
      if (r.ok) {
        const data = await r.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return res.json({ source: 'LIVE_API', modelId, text });
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
          system: systemPrompt || 'You are CLAUDE, the Forgemaster & OS Operator core inside the A.R.C.H.O.N. spatial HUD.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data?.content?.[0]?.text;
        if (text) return res.json({ source: 'LIVE_API', modelId, text });
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
            {
              role: 'system',
              content:
                systemPrompt ||
                'You are GROK, the Live Recon & Adversarial Red-Team core inside the A.R.C.H.O.N. spatial HUD.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return res.json({ source: 'LIVE_API', modelId, text });
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
            {
              role: 'system',
              content:
                systemPrompt ||
                'You are GPT, the Realtime Voice Conductor & Rapid Tool Sprinter core inside the A.R.C.H.O.N. spatial HUD.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return res.json({ source: 'LIVE_API', modelId, text });
      }
    }
  } catch (err) {
    // Fall through to Live Neural Simulator if offline or key invalid
  }

  return res.json({
    source: 'NEURAL_SIMULATOR',
    modelId,
    text: null,
  });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`\x1b[32m[A.R.C.H.O.N. Server] Local Telemetry & Multi-Model Bridge online at http://localhost:${PORT}\x1b[0m`);
});
