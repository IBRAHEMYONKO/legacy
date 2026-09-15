'use strict';

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { waitForHttp } = require('./backend/src/service-ready');
const root = __dirname;
const children = new Map();
let stopping = false;
let publicUrl = '';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const cloudflaredCommand = isWindows ? 'cloudflared.exe' : 'cloudflared';
const webPort = process.env.WEB_PORT || '5173';
const activityPort = process.env.ACTIVITY_PORT || '5174';
const apiPort = process.env.API_PORT || '4000';
const host = process.env.LEGACY_HOST || '0.0.0.0';
const enablePublicTunnel = String(process.env.LEGACY_PUBLIC || 'true').toLowerCase() !== 'false';

const DEV_PROCESSES = [
  ['api', ['--workspace', 'backend', 'run', 'dev']],
  ['bot', ['--workspace', 'apps/bot', 'run', 'dev']],
  ['web', ['--workspace', 'apps/web', 'run', 'dev', '--', '--host', host, '--port', webPort]],
  ['activity', ['--workspace', 'apps/activity', 'run', 'dev', '--', '--host', host, '--port', activityPort]]
];

const PROD_PROCESSES = [
  ['api', ['--workspace', 'backend', 'start']],
  ['bot', ['--workspace', 'apps/bot', 'start']],
  ['web', ['--workspace', 'apps/web', 'run', 'preview', '--', '--host', host, '--port', webPort]],
  ['activity', ['--workspace', 'apps/activity', 'run', 'preview', '--', '--host', host, '--port', activityPort]]
];

function log(name, message) {
  process.stdout.write(`[LEGACY:${name}] ${message}\n`);
}

function spawnProcess(name, args) {
  if (children.has(name)) return children.get(name);

  const child = spawn(npmCommand, args, {
    cwd: root,
    env: { ...process.env },
    stdio: 'inherit',
    windowsHide: false,
    shell: isWindows
  });

  children.set(name, child);
  log(name, `started (pid ${child.pid})`);

  child.once('exit', (code, signal) => {
    children.delete(name);
    if (!stopping && code !== 0) log(name, `stopped unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'none'})`);
  });
  child.once('error', (error) => {
    children.delete(name);
    log(name, `failed: ${error.message}`);
  });
  return child;
}

function spawnPublicTunnel() {
  if (!enablePublicTunnel || children.has('public')) return null;

  const candidates = isWindows
    ? [
        path.join(root, 'cloudflared.exe'),
        path.join(root, 'tools', 'cloudflared.exe'),
        cloudflaredCommand
      ]
    : [
        path.join(root, 'cloudflared'),
        path.join(root, 'tools', 'cloudflared'),
        cloudflaredCommand
      ];

  let executable = candidates[0];
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      executable = candidate;
      break;
    }
    if (!path.isAbsolute(candidate)) {
      executable = candidate;
      break;
    }
  }

  const tunnel = spawn(executable, ['tunnel', '--url', `http://127.0.0.1:${webPort}`, '--no-autoupdate'], {
    cwd: root,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false,
    shell: isWindows
  });

  children.set('public', tunnel);
  log('public', `starting Cloudflare public tunnel for http://127.0.0.1:${webPort} (pid ${tunnel.pid})`);

  const consume = (chunk) => {
    const text = String(chunk || '');
    process.stdout.write(text.split(/\r?\n/).filter(Boolean).map(line => `[LEGACY:public] ${line}\n`).join(''));

    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && match[0] !== publicUrl) {
      publicUrl = match[0];
      log('public', `PUBLIC URL: ${publicUrl}`);
    }
  };

  tunnel.stdout.on('data', consume);
  tunnel.stderr.on('data', consume);

  tunnel.once('error', (error) => {
    children.delete('public');
    publicUrl = '';
    if (error?.code === 'ENOENT') {
      log('public', 'cloudflared غير مثبت. نزّله ثم أعد npm run dev؛ الموقع المحلي سيستمر بالعمل.');
      log('public', 'التثبيت الرسمي: https://developers.cloudflare.com/tunnel/downloads/');
    } else {
      log('public', `failed: ${error.message}`);
    }
  });

  tunnel.once('exit', (code, signal) => {
    children.delete('public');
    if (!stopping && code !== 0) log('public', `tunnel stopped (code=${code ?? 'null'}, signal=${signal ?? 'none'})`);
  });

  return tunnel;
}

function printEndpoints(mode) {
  const lanHost = process.env.LEGACY_LAN_HOST || '192.168.100.15';
  log('core', '');
  log('core', `LEGACY ${mode} is starting as one stack`);
  log('core', `Website     : http://localhost:${webPort}`);
  log('core', `Website LAN : http://${lanHost}:${webPort}`);
  log('core', `Activity    : http://localhost:${activityPort}`);
  log('core', `API         : http://localhost:${apiPort}`);
  log('core', `Public Web  : ${enablePublicTunnel ? 'waiting for Cloudflare...' : 'disabled (LEGACY_PUBLIC=false)'}`);
  log('core', 'Discord Bot : starting from the same command');
  log('core', 'Stop all   : Ctrl+C');
}

function buildClients() {
  log('core', 'building web and Activity for production mode...');
  execFileSync(npmCommand, ['--workspace', 'apps/web', 'run', 'build'], { cwd: root, env: { ...process.env }, stdio: 'inherit', shell: isWindows });
  execFileSync(npmCommand, ['--workspace', 'apps/activity', 'run', 'build'], { cwd: root, env: { ...process.env }, stdio: 'inherit', shell: isWindows });
}

async function waitForApi() {
  log('core', `waiting for API health check on http://127.0.0.1:${apiPort}/health...`);
  await waitForHttp(`http://127.0.0.1:${apiPort}/health`, {
    attempts: 60,
    intervalMs: 250,
    timeoutMs: 1500
  });
  log('core', 'API is ready; starting web and Activity');
}

async function start(options = {}) {
  if (children.size) return Object.fromEntries(children);
  stopping = false;
  publicUrl = '';
  const mode = options.mode || process.env.LEGACY_MODE || 'development';
  if (mode === 'production') buildClients();
  const processes = mode === 'production' ? PROD_PROCESSES : DEV_PROCESSES;
  printEndpoints(mode);

  const apiEntry = processes.find(([name]) => name === 'api');
  const botEntry = processes.find(([name]) => name === 'bot');
  const clientProcesses = processes.filter(([name]) => name === 'web' || name === 'activity');

  if (apiEntry) spawnProcess(...apiEntry);
  if (botEntry) spawnProcess(...botEntry);

  await waitForApi();

  for (const [name, args] of clientProcesses) spawnProcess(name, args);

  if (mode !== 'production' && enablePublicTunnel) {
    setTimeout(() => {
      if (!stopping && !children.has('public')) spawnPublicTunnel();
    }, 1500).unref();
  }
  return Object.fromEntries(children);
}

async function stop() {
  if (!children.size) return;
  stopping = true;
  const running = [...children.entries()];
  children.clear();
  await Promise.all(running.map(([name, child]) => new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    child.once('exit', finish);
    if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', shell: true }).once('exit', finish);
    else {
      child.kill('SIGTERM');
      setTimeout(() => { if (!settled) child.kill('SIGKILL'); finish(); }, 5000).unref();
    }
    log(name, 'stopping...');
  })));
  publicUrl = '';
  stopping = false;
}

if (require.main === module) {
  start().catch((error) => { console.error('[LEGACY:core] startup failed:', error); process.exitCode = 1; });
  const shutdown = async (signal) => { log('core', `${signal} received, shutting down...`); await stop(); process.exit(0); };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { start, stop, waitForApi };
