const STORAGE_KEY = 'crm_custom_departments';

const DEFAULT_DEPARTMENTS = ['Sales', 'Marketing', 'IT', 'HR', 'Operations', 'Finance'];

export function loadCustomDepartments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function saveCustomDepartment(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return loadCustomDepartments();
  const existing = loadCustomDepartments();
  const lower = trimmed.toLowerCase();
  if (existing.some((d) => d.toLowerCase() === lower)) return existing;
  const next = [...existing, trimmed].sort((a, b) => a.localeCompare(b));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeCustomDepartment(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return loadCustomDepartments();
  const lower = trimmed.toLowerCase();
  const existing = loadCustomDepartments();
  const next = existing.filter((d) => String(d).trim().toLowerCase() !== lower);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function mergeDepartmentOptions(employees = [], customList = null) {
  const custom = customList ?? loadCustomDepartments();
  const fromEmployees = employees
    .map((e) => e.department)
    .filter((d) => d && String(d).trim());
  const all = [...DEFAULT_DEPARTMENTS, ...custom, ...fromEmployees];
  return [...new Set(all.map((d) => String(d).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}
