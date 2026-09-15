'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getCloudflareTunnelArgs } = require('../index');

test('forces Cloudflare HTTP/2 transport for restrictive networks', () => {
  assert.deepEqual(
    getCloudflareTunnelArgs('5173'),
    ['tunnel', '--protocol', 'http2', '--url', 'http://127.0.0.1:5173', '--no-autoupdate']
  );
});
