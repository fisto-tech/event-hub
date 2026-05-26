/** ISO-2 country + dial code (India default). */
export const COUNTRY_PHONE_OPTIONS = [
  { iso: 'IN', dial: '91', name: 'India' },
  { iso: 'US', dial: '1', name: 'United States' },
  { iso: 'GB', dial: '44', name: 'United Kingdom' },
  { iso: 'AE', dial: '971', name: 'UAE' },
  { iso: 'SG', dial: '65', name: 'Singapore' },
  { iso: 'AU', dial: '61', name: 'Australia' },
  { iso: 'CA', dial: '1', name: 'Canada' },
  { iso: 'SA', dial: '966', name: 'Saudi Arabia' },
  { iso: 'MY', dial: '60', name: 'Malaysia' },
  { iso: 'BD', dial: '880', name: 'Bangladesh' },
  { iso: 'LK', dial: '94', name: 'Sri Lanka' },
  { iso: 'NP', dial: '977', name: 'Nepal' },
];

export const DEFAULT_PHONE_ISO = 'IN';

const DIAL_SORTED = [...COUNTRY_PHONE_OPTIONS].sort((a, b) => b.dial.length - a.dial.length);

export function getDialByIso(iso) {
  return COUNTRY_PHONE_OPTIONS.find((c) => c.iso === iso)?.dial || '91';
}

export function getIsoByDial(dial) {
  const match = COUNTRY_PHONE_OPTIONS.find((c) => c.dial === dial);
  return match?.iso || DEFAULT_PHONE_ISO;
}

export function digitsOnly(value, maxLen = 15) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, maxLen);
}

/**
 * Parse stored phone into ISO + national (up to 10 digits while typing).
 * Handles: +919876543210, 9876543210, partial 98765, legacy formats.
 */
export function parseStoredPhone(raw, defaultIso = DEFAULT_PHONE_ISO) {
  const defaultDial = getDialByIso(defaultIso);
  const trimmed = String(raw || '').trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return { iso: defaultIso, dial: defaultDial, national: '' };
  }

  const hasPlus = trimmed.startsWith('+');

  if (hasPlus) {
    for (const opt of DIAL_SORTED) {
      if (!digits.startsWith(opt.dial)) continue;
      const national = digits.slice(opt.dial.length);
      return { iso: opt.iso, dial: opt.dial, national };
    }
  }

  return { iso: defaultIso, dial: defaultDial, national: digits };
}

/**
 * Full international value for API storage (+91xxxxxxxxxx).
 * Partial national (<10 digits) is stored without prefix to avoid parse loops while typing.
 */
export function formatPhoneForStorage(iso, national) {
  const digits = digitsOnly(national, 15);
  if (!digits) return '';
  const dial = getDialByIso(iso);
  return `+${dial}${digits}`;
}

/** Normalize any stored value to +[dial][10digits] before submit. */
export function normalizePhoneForSubmit(raw, defaultIso = DEFAULT_PHONE_ISO) {
  const parsed = parseStoredPhone(raw, defaultIso);
  const dial = parsed.dial || getDialByIso(parsed.iso);
  const nat = digitsOnly(parsed.national, 15);
  if (!nat) return '';
  return `+${dial}${nat}`;
}

export function isValidNationalNumber(national) {
  return /^\d{10}$/.test(digitsOnly(national, 10));
}

export function validatePhoneField(iso, national, { required = true } = {}) {
  const digits = digitsOnly(national, 15);
  if (!digits) {
    return required ? 'Phone number is required' : '';
  }
  if (required && digits.length < 5) {
    return 'Phone number is too short';
  }
  return '';
}

/** Validate stored value (partial or full). */
export function validateStoredPhone(raw, { required = true, defaultIso = DEFAULT_PHONE_ISO } = {}) {
  const { iso, national } = parseStoredPhone(raw, defaultIso);
  return validatePhoneField(iso, national, { required });
}
