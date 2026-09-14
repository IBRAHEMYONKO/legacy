'use strict';

const { spawn, execFileSync } = require('child_process');
const path = require('path');

const root = __dirname;
const children = new Map();
let stopping = false;

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const DEV_PROCESSES = [
  ['api', ['--workspace', 'backend', 'run', 'dev']],
  ['bot', ['--workspace', 'apps/bot', 'run', 'dev']],
  ['web', ['--workspace', 'apps/web', 'run', 'dev']],
  ['activity', ['--workspace', 'apps/activity', 'run', 'dev']]
];

const PROD_PROCESSES = [
  ['api', ['--workspace', 'backend', 'start']],
  ['bot', ['--workspace', 'apps/bot', 'start']],
  ['web', ['--workspace', 'apps/web', 'run', 'preview']],
  ['activity', ['--workspace', 'apps/activity', 'run', 'preview']]
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
    windowsHide: false
  });

  children.set(name, child);
  log(name, `started (pid ${child.pid})`);

  child.once('exit', (code, signal) => {
    children.delete(name);
    if (!stopping && code !== 0) {
      log(name, `stopped unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'none'})`);
    }
  });

  child.once('error', (error) => {
    children.delete(name);
    log(name, `failed: ${error.message}`);
  });

  return child;
}

function buildClients() {
  log('core', 'building web and Activity for production mode...');
  execFileSync(npmCommand, ['--workspace', 'apps/web', 'run', 'build'], {
    cwd: root,
    env: { ...process.env },
    stdio: 'inherit'
  });
  execFileSync(npmCommand, ['--workspace', 'apps/activity', 'run', 'build'], {
    cwd: root,
    env: { ...process.env },
    stdio: 'inherit'
  });
}

async function start(options = {}) {
  if (children.size) return Object.fromEntries(children);

  stopping = false;
  const mode = options.mode || process.env.LEGACY_MODE || 'development';
  const processes = mode === 'production' ? PROD_PROCESSES : DEV_PROCESSES;

  if (mode === 'production') buildClients();

  log('core', `starting LEGACY in ${mode} mode...`);
  for (const [name, args] of processes) spawnProcess(name, args);

  return Object.fromEntries(children);
}

async function stop() {
  if (!children.size) return;

  stopping = true;
  const running = [...children.entries()];
  children.clear();

  await Promise.all(running.map(([name, child]) => new Promise((resolve) => {
    const done = () => resolve();
    child.once('exit', done);

    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' }).once('exit', resolve);
    } else {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
        resolve();
      }, 5000).unref();
    }

    log(name, 'stopping...');
  })));

  stopping = false;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('[LEGACY:core] startup failed:', error);
    process.exitCode = 1;
  });

  const shutdown = async (signal) => {
    log('core', `${signal} received, shutting down...`);
    await stop();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { start, stop };
