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

// 2. REAL WORKSPACE AST & FILE GRAPH ENDPOINT (For Workbench Mode)
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

// 3. SAFE LOCAL TERMINAL EXECUTION BRIDGE
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

// 4. LOCAL NEURAL VOICE AI BRIDGE (Supports Kokoro-82M / mlx-audio / Orpheus OpenAI-compatible TTS)
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

// 5. UNIVERSAL MULTI-MODEL GATEWAY (Argon/Gemini, Claude, Grok, GPT + Custom Ollama/OpenAI Plugins)
app.post('/api/dispatch', async (req, res) => {
  const { modelId, prompt, systemPrompt, apiKeys = {}, endpointConfig } = req.body || {};
  const startTime = Date.now();

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
        if (text) {
          return res.json({
            source: 'LIVE_API',
            modelId,
            text,
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
          system:
            systemPrompt ||
            'You are Claude, the Code Forgemaster & OS Operator core inside Aspira.',
          messages: [{ role: 'user', content: prompt }],
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
            {
              role: 'system',
              content:
                systemPrompt ||
                'You are Grok, the Live Recon & Adversarial Red-Team core inside Aspira.',
            },
            { role: 'user', content: prompt },
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
            {
              role: 'system',
              content:
                systemPrompt ||
                'You are GPT, the Realtime Voice Conductor & Rapid Tool Sprinter core inside Aspira.',
            },
            { role: 'user', content: prompt },
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
            { role: 'system', content: systemPrompt || 'You are an AI agent inside Aspira.' },
            { role: 'user', content: prompt },
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
            latencyMs: Date.now() - startTime,
          });
        }
      }
    }
  } catch {
    // Fall through to Live Neural Simulator if offline or key invalid
  }

  return res.json({
    source: 'NEURAL_SIMULATOR',
    modelId,
    text: null,
    latencyMs: Date.now() - startTime,
  });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`\x1b[32m[Aspira Server] Local Telemetry, Voice AI & Multi-Model Bridge online at http://localhost:${PORT}\x1b[0m`);
});
