const PRODUCTION_API = 'https://www.fist-o.com/stall_event_app/backend/api';

// In dev, use Vite proxy (/api) to avoid CORS; override with VITE_API_BASE_URL in .env
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : PRODUCTION_API);

// Public root where static assets like "uploads/..." live.
// Production API is hosted under ".../backend/api" but uploads are stored under ".../uploads".
export const PUBLIC_BASE_URL = (() => {
  if (typeof API_BASE_URL === 'string' && API_BASE_URL.startsWith('http')) {
    return API_BASE_URL
      .replace(/\/backend\/api\/?$/, '')
      .replace(/\/api\/?$/, '');
  }
  // In dev we proxy API as "/api". For hosted builds, uploads are usually on the same origin.
  return '';
})();

export const resolvePublicUrl = (path) => {
  const p = String(path || '').trim();
  if (!p) return '';
  if (p.startsWith('http://') || p.startsWith('https://')) return p;

  // Normalise common variants we might store in DB or receive from APIs
  const normalised = p
    .replace(/^\.\/+/, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\/+/, '');

  // Uploads are stored outside the dev server's document root (PHP serves from backend/api),
  // so in DEV we must stream them via an API endpoint.
  // Also safe for production: avoids relying on static /uploads routing rules.
  if (normalised.startsWith('uploads/')) {
    const file = normalised.split('/').pop();
    if (!file) return '';
    return `${API_BASE_URL}/uploads.php?file=${encodeURIComponent(file)}`;
  }

  return PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/${normalised}` : `/${normalised}`;
};

export const fetchApi = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}/${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const preview = text.slice(0, 120).replace(/\s+/g, ' ');
    const hint =
      response.status === 404
        ? ' Endpoint not found — for local dev run "npm run dev:api" in another terminal, or deploy the PHP file to production.'
        : ' Check that the PHP API is running, not the React app.';
    throw new Error(`Server returned non-JSON (${response.status}).${hint} ${preview}`);
  }

  if (!response.ok && !data.message) {
    data.message = data.message || `Request failed (${response.status})`;
  }

  return data;
};
