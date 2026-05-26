import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchCities } from '../../utils/citySearch';

const CityAutocomplete = ({
  value = '',
  onChange,
  name,
  placeholder = 'Type city name…',
  className = 'w-full px-3 py-1.5 crm-input',
  inputClassName,
  required = false,
  disabled = false,
  id,
  country = 'in',
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const runSearch = useCallback(
    async (text) => {
      if (text.trim().length < 2) {
        setSuggestions([]);
        setLoading(false);
        setError('');
        return;
      }
      const reqId = ++requestIdRef.current;
      setLoading(true);
      setError('');
      try {
        const results = await searchCities(text, { country });
        if (reqId !== requestIdRef.current) return;
        setSuggestions(results);
        setHighlightIndex(results.length ? 0 : -1);
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        setSuggestions([]);
        setError(e.message || 'City lookup unavailable');
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    },
    [country]
  );

  const handleInputChange = (e) => {
    const next = e.target.value;
    setInputValue(next);
    onChange?.(next);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next), 280);
  };

  const selectSuggestion = (item) => {
    const city = item.city || item.label || '';
    setInputValue(city);
    onChange?.(city);
    setSuggestions([]);
    setOpen(false);
    setHighlightIndex(-1);
    setError('');
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && inputValue.trim().length >= 2) {
        setOpen(true);
        runSearch(inputValue);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
    }
  };

  useEffect(() => {
    const onDocClick = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const showList = open && (loading || suggestions.length > 0 || error);

  return (
    <div ref={wrapRef} className={`relative ${className.includes('mt-') ? '' : ''}`}>
      <input
        type="text"
        id={id}
        name={name}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (inputValue.trim().length >= 2) {
            setOpen(true);
            runSearch(inputValue);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        className={inputClassName || className}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-crm-primary pointer-events-none">
          <i className="ph-bold ph-circle-notch animate-spin text-sm" />
        </span>
      )}
      {showList && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          role="listbox"
        >
          {error && (
            <li className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">{error}</li>
          )}
          {!loading && !error && suggestions.length === 0 && inputValue.trim().length >= 2 && (
            <li className="px-3 py-2 text-sm text-gray-500">No cities found — you can still type your own.</li>
          )}
          {suggestions.map((item, idx) => (
            <li key={`${item.label}-${idx}`} role="option" aria-selected={idx === highlightIndex}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  idx === highlightIndex ? 'bg-crm-primaryLighter text-crm-primary' : 'hover:bg-gray-50 text-gray-800'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item)}
              >
                <span className="font-medium">{item.city}</span>
                {item.state ? <span className="text-gray-500">, {item.state}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CityAutocomplete;
