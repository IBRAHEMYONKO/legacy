'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForHttp } = require('../src/service-ready');

test('waits for the API health endpoint before continuing', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('ECONNREFUSED');
    return { ok: true, status: 200 };
  };

  await waitForHttp('http://127.0.0.1:4000/health', {
    fetchImpl,
    attempts: 3,
    intervalMs: 0
  });

  assert.equal(attempts, 3);
});

test('fails clearly when the service never becomes ready', async () => {
  await assert.rejects(
    () => waitForHttp('http://127.0.0.1:4000/health', {
      fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
      attempts: 2,
      intervalMs: 0
    }),
    /الخدمة لم تصبح جاهزة/
  );
});
