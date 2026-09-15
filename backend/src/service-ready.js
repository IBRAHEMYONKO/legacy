'use strict';

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForHttp(url, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const attempts = Math.max(1, Number(options.attempts || 30));
  const intervalMs = Math.max(0, Number(options.intervalMs ?? 250));
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 2000));

  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (response?.ok) return response;
        lastError = new Error(`HTTP ${response?.status ?? 'unknown'}`);
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) await sleep(intervalMs);
  }

  throw new Error(`الخدمة لم تصبح جاهزة بعد: ${url}${lastError?.message ? ` — ${lastError.message}` : ''}`);
}

module.exports = { waitForHttp };
