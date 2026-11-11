// Menjalankan 3 proses sekaligus: product-service :3000, order-service :3001, gateway :8080.
// (Monolit TIDAK dijalankan di sini karena memakai port 3000 yang sama dengan product-service.)
// Tekan Ctrl+C untuk menghentikan semuanya.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envFile = path.join(root, 'gateway', '.env');
if (!fs.existsSync(envFile)) {
  fs.copyFileSync(path.join(root, 'gateway', '.env.example'), envFile);
  console.log('[start-all] gateway/.env dibuat dari .env.example');
}

const procs = [
  { name: 'product', dir: 'product-service', file: 'product-service.js' },
  { name: 'order  ', dir: 'order-service', file: 'order-service.js' },
  { name: 'gateway', dir: 'gateway', file: 'gateway.js' },
].map(({ name, dir, file }) => {
  const p = spawn(process.execPath, [file], { cwd: path.join(root, dir), env: process.env });
  const out = (d) => d.toString().trimEnd().split('\n').forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on('data', out);
  p.stderr.on('data', out);
  p.on('exit', (code) => console.log(`[${name}] berhenti (kode ${code})`));
  return p;
});

const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
