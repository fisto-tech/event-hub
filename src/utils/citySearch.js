import { fetchApi } from './api';

const GEOAPIFY_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function normalizeGeoapify(features = []) {
  const seen = new Set();
  const out = [];
  for (const feature of features) {
    const props = feature.properties || {};
    const city = String(props.city || props.name || props.county || '').trim();
    if (!city) continue;
    const state = String(props.state || '').trim();
    const country = String(props.country || '').trim();
    const key = `${city.toLowerCase()}|${state.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parts = [city, state, country && country !== 'India' ? country : ''].filter(Boolean);
    out.push({
      city,
      state,
      country,
      label: props.formatted || parts.join(', '),
    });
  }
  return out;
}

function normalizeNominatim(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const addr = item.address || {};
    const city = String(
      addr.city || addr.town || addr.village || addr.municipality || addr.county || item.name || ''
    ).trim();
    if (!city) continue;
    const state = String(addr.state || '').trim();
    const country = String(addr.country || '').trim();
    const key = `${city.toLowerCase()}|${state.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parts = [city, state, country && country !== 'India' ? country : ''].filter(Boolean);
    out.push({ city, state, country, label: parts.join(', ') });
  }
  return out;
}

async function searchViaBackend(query, country) {
  const params = new URLSearchParams({ q: query, limit: '8' });
  if (country) params.set('country', country);
  const res = await fetchApi(`cities.php?${params.toString()}`);
  if (res.status === 'error') {
    throw new Error(res.message || 'City lookup failed');
  }
  if (res.status === 'success' && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

async function searchViaGeoapify(query, apiKey, country = 'in') {
  const params = new URLSearchParams({
    text: query,
    limit: '8',
    apiKey,
    lang: 'en',
  });
  if (country && country !== 'all') {
    params.set('filter', `countrycode:${country}`);
  }
  const response = await fetch(`${GEOAPIFY_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`City lookup failed (${response.status})`);
  }
  const data = await response.json();
  return normalizeGeoapify(data.features || []);
}

async function searchViaNominatim(query, country = 'in') {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '8',
    featuretype: 'city',
  });
  if (country && country !== 'all') {
    params.set('countrycodes', country);
  }
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`City lookup failed (${response.status})`);
  }
  const data = await response.json();
  return normalizeNominatim(Array.isArray(data) ? data : []);
}

/**
 * Search cities as the user types (min 2 characters).
 */
export async function searchCities(query, { country = 'in' } = {}) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return [];

  const attempts = [];

  try {
    const backend = await searchViaBackend(trimmed, country);
    if (backend.length > 0) return backend;
    attempts.push('backend-empty');
  } catch (e) {
    attempts.push(`backend:${e.message}`);
  }

  const apiKey = import.meta.env.VITE_CITY_API_KEY;
  if (apiKey && apiKey !== 'YOUR_GEOAPIFY_API_KEY') {
    try {
      const geo = await searchViaGeoapify(trimmed, apiKey, country);
      if (geo.length > 0) return geo;
      attempts.push('geoapify-empty');
    } catch (e) {
      attempts.push(`geoapify:${e.message}`);
    }
  }

  try {
    const nom = await searchViaNominatim(trimmed, country);
    if (nom.length > 0) return nom;
    attempts.push('nominatim-empty');
  } catch (e) {
    attempts.push(`nominatim:${e.message}`);
  }

  console.warn('City search returned no results', { query: trimmed, attempts });
  return [];
}
