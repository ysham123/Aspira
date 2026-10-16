import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('\x1b[36m╔══════════════════════════════════════════════════════════════════╗\x1b[0m');
console.log('\x1b[36m║  A.R.C.H.O.N. // MULTI-MODEL SPATIAL EXOCORTEX BOOTING...        ║\x1b[0m');
console.log('\x1b[36m║  Models: ARGON (Gemini) • CLAUDE • GROK • GPT                    ║\x1b[0m');
console.log('\x1b[36m╚══════════════════════════════════════════════════════════════════╝\x1b[0m');

const serverProc = spawn('node', ['server/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001' },
});

const viteProc = spawn('npx', ['vite', '--port', '5173', '--host'], {
  cwd: rootDir,
  stdio: 'inherit',
});

const cleanup = () => {
  serverProc.kill();
  viteProc.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
