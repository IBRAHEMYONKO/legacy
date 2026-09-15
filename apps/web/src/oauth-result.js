export function readOAuthResult(locationLike) {
  const search = typeof locationLike?.search === 'string' ? locationLike.search : '';
  const params = new URLSearchParams(search);
  return {
    token: params.get('token') || '',
    error: params.get('auth_error') || ''
  };
}
