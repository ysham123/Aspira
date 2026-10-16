import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('\x1b[36mAspira · local workspace\x1b[0m');

const serverProc = spawn('node', ['server/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001' },
});

const viteProc = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
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
