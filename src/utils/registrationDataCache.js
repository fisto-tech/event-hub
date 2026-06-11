import { fetchApi } from './api';

const TTL_MS = 5 * 60 * 1000; // 5 minutes — avoids refetch on every tab visit

let cached = null;
let cachedAt = 0;
let inflight = null;

const emptyLookups = () => ({
  source: [],
  enquiry_type: [],
  industry_type: [],
});

/**
 * Load registration dropdown data once per session (deduped in-flight).
 * @param {boolean} force — bypass cache after save or manual refresh
 */
const STORAGE_KEY = 'crm_registration_bootstrap_data';

export async function loadRegistrationBootstrap(force = false) {
  const now = Date.now();
  if (!force && cached && now - cachedAt < TTL_MS) {
    return cached;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    // Try to load from localStorage first as an offline fallback
    const stored = localStorage.getItem(STORAGE_KEY);
    let offlineData = null;
    if (stored) {
      try {
        offlineData = JSON.parse(stored);
      } catch (e) {}
    }

    if (!navigator.onLine) {
      if (offlineData) {
        cached = offlineData;
        cachedAt = Date.now();
        return offlineData;
      } else {
        return { expos: [], whatsappTemplates: [], lookups: emptyLookups() };
      }
    }

    try {
      const res = await fetchApi('registration_bootstrap.php');
      if (res.status === 'success' && res.data) {
        const data = {
          expos: res.data.expos || [],
          whatsappTemplates: res.data.whatsapp_templates || [],
          lookups: res.data.lookups || emptyLookups(),
        };
        cached = data;
        cachedAt = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch {
      /* bootstrap not deployed — fall back to parallel calls */
    }

    try {
      const [expoRes, templateRes, lookupRes] = await Promise.all([
        fetchApi('expos.php'),
        fetchApi('whatsapp_templates.php'),
        fetchApi('master_data.php?type=all&registry=1'),
      ]);

      if (expoRes.status !== 'success') {
        throw new Error(expoRes.message || 'Failed to load expos');
      }

      const data = {
        expos: expoRes.data || [],
        whatsappTemplates: templateRes.status === 'success' ? templateRes.data || [] : [],
        lookups:
          lookupRes.status === 'success' && lookupRes.data
            ? {
                source: lookupRes.data.source || [],
                enquiry_type: lookupRes.data.enquiry_type || [],
                industry_type: lookupRes.data.industry_type || [],
              }
            : emptyLookups(),
      };

      cached = data;
      cachedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    } catch (err) {
      // If API fails (e.g. network error), try to use localStorage
      if (offlineData) {
        cached = offlineData;
        cachedAt = Date.now();
        return offlineData;
      }
      throw err;
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** After saving a customer with custom dropdown values, extend cache without a full refetch. */
export function appendLookupToCache(type, name, expoId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed || !cached?.lookups?.[type]) return;

  const exists = cached.lookups[type].some(
    (item) => item.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) return;

  cached.lookups[type] = [
    ...cached.lookups[type],
    {
      id: null,
      lookup_type: type,
      name: trimmed,
      expo_id: expoId,
      expo_name: null,
      created_at: new Date().toISOString(),
    },
  ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
}

export function invalidateRegistrationCache() {
  cached = null;
  cachedAt = 0;
}

/** Read current cache synchronously (e.g. after appendLookupToCache). */
export function getCachedRegistrationData() {
  return cached;
}
