export function readOAuthResult(locationLike) {
  const search = typeof locationLike?.search === 'string' ? locationLike.search : '';
  const params = new URLSearchParams(search);
  return {
    token: params.get('token') || '',
    error: params.get('auth_error') || ''
  };
}

export function resolveApiOrigin(configuredApi, browserOrigin) {
  const configured = String(configuredApi || '').replace(/\/$/, '');
  const browser = String(browserOrigin || '').replace(/\/$/, '');

  if (!browser) return configured;

  try {
    const browserUrl = new URL(browser);
    const configuredUrl = configured ? new URL(configured) : null;

    // When the UI is reached through a public tunnel, localhost API URLs would
    // point at the visitor's own machine. Keep API/auth calls on the same origin.
    if (
      configuredUrl &&
      (configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1') &&
      browserUrl.hostname !== 'localhost' &&
      browserUrl.hostname !== '127.0.0.1'
    ) {
      return browserUrl.origin;
    }
  } catch {
    return configured || browser;
  }

  return configured || browser;
}
