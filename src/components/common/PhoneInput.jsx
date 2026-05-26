import React, { useState, useEffect, useRef } from 'react';

const PhoneInput = ({
  value = '',
  onChange,
  name,
  required = false,
  disabled = false,
  inputClassName = 'flex-1 min-w-0 px-3 py-1.5 crm-input',
  selectClassName = 'w-[5.5rem] shrink-0 px-2 py-1.5 crm-input text-sm text-center',
  placeholder = 'Phone number',
  showError = true,
  maxLength = 15, // Provide a generous max length to remove the 10-digit strict restriction
}) => {
  // Parse initial value
  const parseInitial = (val) => {
    const str = String(val || '').trim();
    if (str.startsWith('+')) {
      const spaceIdx = str.indexOf(' ');
      if (spaceIdx > 0) {
        return { dial: str.slice(0, spaceIdx), nat: str.slice(spaceIdx + 1).replace(/\D/g, '') };
      }
      // If no space, guess first 3 chars or just fallback to +91
      const match = str.match(/^(\+\d{1,3})\s*(.*)$/);
      if (match) return { dial: match[1], nat: match[2].replace(/\D/g, '') };
    }
    // If just digits, assume +91
    return { dial: '+91', nat: str.replace(/\D/g, '') };
  };

  const initial = parseInitial(value);
  const [dial, setDial] = useState(initial.dial);
  const [national, setNational] = useState(initial.nat);
  const [touched, setTouched] = useState(false);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const parsed = parseInitial(value);
    setDial(parsed.dial);
    setNational(parsed.nat);
  }, [value]);

  const emitChange = (nextDial, nextNat) => {
    const cleanNat = nextNat.replace(/\D/g, '');
    const stored = cleanNat ? `${nextDial} ${cleanNat}` : '';
    lastEmittedRef.current = stored;
    onChange?.(stored);
  };

  const handleDialChange = (e) => {
    let val = e.target.value.replace(/[^\d+]/g, '');
    if (!val.startsWith('+') && val.length > 0) {
      val = '+' + val;
    }
    setDial(val);
    emitChange(val, national);
  };

  const handleNationalChange = (e) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, maxLength);
    setNational(next);
    emitChange(dial, next);
  };

  const isInvalid = required && touched && !national;
  const displayError = showError && isInvalid;

  return (
    <div className="w-full min-w-0">
      <div className="flex gap-2 items-stretch w-full min-w-0">
        <input
          type="text"
          value={dial}
          onChange={handleDialChange}
          disabled={disabled}
          className={selectClassName}
          placeholder="+91"
        />
        <input
          type="tel"
          name={name}
          value={national}
          onChange={handleNationalChange}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          maxLength={maxLength}
          inputMode="numeric"
          placeholder={placeholder}
          className={inputClassName}
          aria-invalid={!!displayError}
        />
      </div>
      {displayError && <p className="text-xs text-red-600 mt-1">Phone number is required</p>}
    </div>
  );
};

export default PhoneInput;
