export function getPaibanToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('paiban_satoken') || '';
}

export function paibanFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getPaibanToken();
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { satoken: token } : {}),
    },
  });
}
