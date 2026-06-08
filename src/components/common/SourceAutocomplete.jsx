import React, { useState, useEffect, useRef } from 'react';

const SourceAutocomplete = ({
  value = '',
  onChange,
  name,
  placeholder = 'Enter source name...',
  className = 'w-full px-3 py-1.5 crm-input',
  inputClassName,
  required = false,
  disabled = false,
  id,
  options = [],
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const handleInputChange = (e) => {
    const next = e.target.value;
    setInputValue(next);
    onChange?.(next);
    
    if (next.trim().length > 0) {
      const filtered = options.filter(opt => 
        opt.name.toLowerCase().includes(next.toLowerCase())
      );
      setSuggestions(filtered);
      setOpen(true);
      setHighlightIndex(filtered.length ? 0 : -1);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  };

  const selectSuggestion = (item) => {
    const sourceName = item.name || '';
    setInputValue(sourceName);
    onChange?.(sourceName);
    setSuggestions([]);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && inputValue.trim().length > 0) {
        const filtered = options.filter(opt => 
          opt.name.toLowerCase().includes(inputValue.toLowerCase())
        );
        setSuggestions(filtered);
        setOpen(true);
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

  const showList = open && (suggestions.length > 0);

  return (
    <div ref={wrapRef} className={`relative ${className.includes('mt-') ? '' : ''}`}>
      <input
        type="text"
        id={id}
        name={name}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (inputValue.trim().length > 0) {
            const filtered = options.filter(opt => 
              opt.name.toLowerCase().includes(inputValue.toLowerCase())
            );
            setSuggestions(filtered);
            setOpen(true);
          } else {
            setSuggestions(options);
            setOpen(true);
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
      {showList && (
        <ul
          className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto custom-scrollbar bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          role="listbox"
        >
          {suggestions.map((item, idx) => (
            <li key={`${item.name}-${idx}`} role="option" aria-selected={idx === highlightIndex}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                  idx === highlightIndex ? 'bg-crm-primaryLighter text-crm-primary' : 'hover:bg-gray-50 text-gray-800'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item)}
              >
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-crm-primary font-semibold bg-crm-primary/10 px-2 py-0.5 rounded-md">Already Registered</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SourceAutocomplete;
