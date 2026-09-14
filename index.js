'use strict';

const { spawn, execFileSync } = require('child_process');
const root = __dirname;
const children = new Map();
let stopping = false;

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const webPort = process.env.WEB_PORT || '5173';
const activityPort = process.env.ACTIVITY_PORT || '5174';
const apiPort = process.env.API_PORT || '4000';
const host = process.env.LEGACY_HOST || '0.0.0.0';

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

function printEndpoints(mode) {
  const lanHost = process.env.LEGACY_LAN_HOST || '192.168.100.15';
  log('core', '');
  log('core', `LEGACY ${mode} is starting as one stack`);
  log('core', `Website     : http://localhost:${webPort}`);
  log('core', `Website LAN : http://${lanHost}:${webPort}`);
  log('core', `Activity    : http://localhost:${activityPort}`);
  log('core', `API         : http://localhost:${apiPort}`);
  log('core', 'Discord Bot : starting from the same command');
  log('core', 'Stop all   : Ctrl+C');
}

function buildClients() {
  log('core', 'building web and Activity for production mode...');
  execFileSync(npmCommand, ['--workspace', 'apps/web', 'run', 'build'], { cwd: root, env: { ...process.env }, stdio: 'inherit', shell: isWindows });
  execFileSync(npmCommand, ['--workspace', 'apps/activity', 'run', 'build'], { cwd: root, env: { ...process.env }, stdio: 'inherit', shell: isWindows });
}

async function start(options = {}) {
  if (children.size) return Object.fromEntries(children);
  stopping = false;
  const mode = options.mode || process.env.LEGACY_MODE || 'development';
  if (mode === 'production') buildClients();
  const processes = mode === 'production' ? PROD_PROCESSES : DEV_PROCESSES;
  printEndpoints(mode);
  for (const [name, args] of processes) spawnProcess(name, args);
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
  stopping = false;
}

if (require.main === module) {
  start().catch((error) => { console.error('[LEGACY:core] startup failed:', error); process.exitCode = 1; });
  const shutdown = async (signal) => { log('core', `${signal} received, shutting down...`); await stop(); process.exit(0); };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = { start, stop };
