// Tiny API client. In the browser the API is on the same origin (Vite proxy / served by Express).
// For the Android app (Capacitor), set VITE_API_URL to your server, e.g. https://api.yourdomain.com
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TOKEN_KEY = 'ge_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Cannot reach the server. Is it running?', 0);
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (res.status === 401 && path !== '/api/auth/login') {
    setToken(null);
    window.dispatchEvent(new Event('ge:logout'));
  }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  return data;
}

/** Fetch a protected file (photo, PDF) and return an object URL for <img>/<iframe>. */
export async function fetchBlobUrl(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError('File not available', res.status);
  return URL.createObjectURL(await res.blob());
}

export const absolute = (path) => (path?.startsWith('http') ? path : `${API_BASE}${path || ''}`);
