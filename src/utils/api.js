const PRODUCTION_API = 'https://www.fist-o.com/stall_event_app/backend/api';

// In dev, use Vite proxy (/api) to avoid CORS; override with VITE_API_BASE_URL in .env
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api' : PRODUCTION_API);

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
    throw new Error(
      `Server returned non-JSON (${response.status}). Check that the PHP API is deployed, not the React app. ${preview}`
    );
  }

  if (!response.ok && !data.message) {
    data.message = data.message || `Request failed (${response.status})`;
  }

  return data;
};
