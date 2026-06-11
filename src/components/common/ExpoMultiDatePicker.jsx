import React, { useMemo, useState } from 'react';

const toIso = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const formatChip = (iso) => {
  try {
    const parts = String(iso).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  } catch {
    return iso;
  }
};

const normalizeDateString = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return toIso(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
};

const ExpoMultiDatePicker = ({ selectedDates = [], onChange }) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const first = selectedDates[0];
    if (first) {
      const d = new Date(`${first}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  const sorted = useMemo(
    () => [...selectedDates].filter(Boolean).sort(),
    [selectedDates]
  );

  const toggle = (iso) => {
    const next = sorted.includes(iso)
      ? sorted.filter((d) => d !== iso)
      : [...sorted, iso].sort();
    onChange(next);
  };

  const { year, month, days, startPad } = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let d = 1; d <= count; d++) cells.push(toIso(y, m, d));
    return { year: y, month: m, days: cells, startPad: firstDow };
  }, [viewMonth]);

  const monthLabel = viewMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-2 min-h-[2.5rem]">
          {sorted.map((iso) => (
            <span
              key={iso}
              className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-crm-primary/30 bg-crm-primaryLighter text-crm-primary text-sm font-medium"
            >
              <i className="ph ph-calendar-blank text-base shrink-0" />
              {formatChip(iso)}
              <button
                type="button"
                onClick={() => toggle(iso)}
                className="p-0.5 rounded hover:bg-crm-primary/10 text-crm-primary"
                aria-label={`Remove ${formatChip(iso)}`}
              >
                <i className="ph-bold ph-x text-xs" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border border-gray-200 rounded-xl p-4 bg-white max-w-md shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <i className="ph-bold ph-caret-left" />
          </button>
          <span className="font-semibold text-crm-textDark">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <i className="ph-bold ph-caret-right" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((iso) => {
            const isSelected = sorted.includes(iso);
            const dayNum = parseInt(iso.split('-')[2], 10);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => toggle(iso)}
                className={`
                  relative aspect-square rounded-lg text-sm font-medium transition-all
                  ${isSelected
                    ? 'bg-crm-primary text-white shadow-sm'
                    : 'text-gray-700 hover:bg-crm-primaryLighter hover:text-crm-primary'
                  }
                `}
              >
                {dayNum}
                {isSelected && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-gray-500">Click dates to select or deselect. Selected dates appear above.</p>
    </div>
  );
};

export { normalizeDateString, formatChip };
export default ExpoMultiDatePicker;
