import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * Extract normalized option objects from React children (<option>) or an options prop array.
 */
function extractOptions(children, optionsProp) {
  if (optionsProp && Array.isArray(optionsProp)) {
    return optionsProp.map((opt, idx) => {
      if (opt == null) return { value: '', label: '', key: `opt-${idx}` };
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt), key: `opt-${idx}-${opt}` };
      }
      const val = opt.value !== undefined ? String(opt.value) : (opt.id != null ? String(opt.id) : (opt.name != null ? String(opt.name) : ''));
      const lbl = opt.label != null ? String(opt.label) : (opt.name != null ? String(opt.name) : (opt.title != null ? String(opt.title) : val));
      return {
        value: val,
        label: lbl,
        disabled: !!opt.disabled,
        key: opt.key || `opt-${idx}-${val}`
      };
    });
  }

  if (!children) return [];

  const result = [];
  const walk = (nodes) => {
    React.Children.forEach(nodes, (child, idx) => {
      if (child == null) return;
      if (React.isValidElement(child)) {
        if (child.type === 'option') {
          const val = child.props.value !== undefined ? String(child.props.value) : (child.props.children != null ? String(child.props.children) : '');
          let lbl = '';
          const c = child.props.children;
          if (typeof c === 'string' || typeof c === 'number') {
            lbl = String(c);
          } else if (Array.isArray(c)) {
            lbl = c.map(item => (typeof item === 'string' || typeof item === 'number' ? item : '')).join('');
          } else if (c == null) {
            lbl = val;
          } else {
            lbl = String(val);
          }
          result.push({
            value: val,
            label: lbl || val,
            disabled: !!child.props.disabled,
            key: child.key || `opt-${idx}-${val}`
          });
        } else if (child.props && child.props.children) {
          walk(child.props.children);
        }
      }
    });
  };
  walk(children);
  return result;
}

/**
 * SearchableSelect
 * High-performance searchable dropdown for ERP forms & filters.
 * When clicked, displays a sticky search bar directly above all options.
 * Typing in the search bar immediately filters option names in real-time.
 */
export default function SearchableSelect({
  value,
  defaultValue,
  onChange,
  onClick,
  onBlur,
  onFocus,
  style,
  tabIndex,
  children,
  options,
  placeholder,
  searchPlaceholder,
  className = '',
  disabled = false,
  required = false,
  name,
  id,
  title,
  'aria-label': ariaLabel
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [openUpward, setOpenUpward] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [internalVal, setInternalVal] = useState(defaultValue != null ? String(defaultValue) : '');

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Extract all options
  const allOptions = useMemo(() => {
    return extractOptions(children, options);
  }, [children, options]);

  // If selecting items is less than 8, do not show search bar
  const showSearchBar = allOptions.length >= 8;

  // Current effective value
  const currentValue = value !== undefined ? (value == null ? '' : String(value)) : internalVal;

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return allOptions.find(opt => String(opt.value) === currentValue);
  }, [allOptions, currentValue]);

  // Fallback label to show on the trigger button
  const displayLabel = useMemo(() => {
    if (selectedOption) {
      return selectedOption.label;
    }
    // If value is empty string, check for empty-value option
    const emptyOption = allOptions.find(opt => opt.value === '');
    if (emptyOption && currentValue === '') {
      return emptyOption.label;
    }
    if (currentValue && currentValue !== '') {
      return currentValue;
    }
    return placeholder || (allOptions[0]?.label) || '-- Select --';
  }, [selectedOption, allOptions, currentValue, placeholder]);

  // Filter options based on search query (only active if search bar is shown)
  const filteredOptions = useMemo(() => {
    if (!showSearchBar || !searchQuery.trim()) return allOptions;
    const q = searchQuery.toLowerCase().trim();
    const qParts = q.split(/\s+/).filter(Boolean);
    return allOptions.filter(opt => {
      const lbl = (opt.label || '').toLowerCase();
      const val = (opt.value || '').toLowerCase();
      return qParts.every(part => lbl.includes(part) || val.includes(part));
    });
  }, [allOptions, searchQuery, showSearchBar]);

  // Check viewport space to determine whether to open upwards or downwards
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 260 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }

      if (rect.left + 260 > window.innerWidth && rect.right > 260) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }

      // Auto-focus search input when opened (only if search bar is displayed)
      let timer;
      if (showSearchBar) {
        timer = setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 50);
      }

      // Reset highlighted index to selected item or 0
      const selIdx = filteredOptions.findIndex(opt => String(opt.value) === currentValue);
      setHighlightedIndex(selIdx >= 0 ? selIdx : 0);

      return () => {
        if (timer) clearTimeout(timer);
      };
    } else {
      setSearchQuery('');
    }
  }, [isOpen, currentValue, showSearchBar]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Handle option selection
  const handleSelect = (optValue) => {
    setIsOpen(false);
    setSearchQuery('');
    if (value === undefined) {
      setInternalVal(optValue);
    }
    if (onChange) {
      const syntheticEvent = {
        target: { value: optValue, name, id },
        currentTarget: { value: optValue, name, id },
        stopPropagation: () => {},
        preventDefault: () => {}
      };
      onChange(syntheticEvent);
    }
    triggerRef.current?.focus();
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev + 1 >= filteredOptions.length ? 0 : prev + 1;
        scrollIndexIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const next = prev - 1 < 0 ? Math.max(0, filteredOptions.length - 1) : prev - 1;
        scrollIndexIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    }
  };

  const scrollIndexIntoView = (index) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  // Layout sizing check
  const isFullWidth = className.includes('w-full');
  const hasMaxWidth = className.includes('max-w-');
  const maxWidthMatch = className.match(/max-w-\[[^\]]+\]|max-w-\S+/);
  const maxWidthClass = maxWidthMatch ? maxWidthMatch[0] : '';

  return (
    <div
      ref={containerRef}
      className={`relative ${isFullWidth ? 'w-full' : 'inline-block'} ${maxWidthClass}`}
      style={{ verticalAlign: 'middle' }}
    >
      {/* Hidden select for standard form compliance & test runners */}
      <select
        name={name}
        id={id}
        value={currentValue}
        onChange={onChange}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none absolute opacity-0 w-0 h-0"
      >
        {allOptions.map((opt) => (
          <option key={opt.key} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Select trigger button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          if (onClick) onClick(e);
          if (!disabled) setIsOpen(!isOpen);
        }}
        onBlur={onBlur}
        onFocus={onFocus}
        style={style}
        tabIndex={tabIndex}
        onKeyDown={handleKeyDown}
        title={title}
        aria-label={ariaLabel || title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-1.5 transition-colors cursor-pointer select-none text-left ${className} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isOpen ? 'ring-2 ring-emerald-500/50 border-emerald-500' : ''}`}
      >
        <span className="truncate flex-1 font-normal">
          {displayLabel}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 ml-1 text-slate-400">
          {showSearchBar && <Search className="w-3 h-3 text-slate-500 opacity-60" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
        </div>
      </button>

      {/* Dropdown popup with Search Bar directly above options */}
      {isOpen && (
        <div
          className={`absolute ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          } ${alignRight ? 'right-0' : 'left-0'} z-[70] ${
            isFullWidth ? 'w-full' : 'min-w-[240px] max-w-[420px]'
          } bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 ring-1 ring-black/40`}
        >
          {/* SEARCH BAR ABOVE EVERY OPTION - Only shown when 8 or more items */}
          {showSearchBar && (
            <div className="p-2 bg-slate-950/95 border-b border-slate-800 sticky top-0 z-10">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={searchPlaceholder || 'Type to filter options...'}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 px-1">
                <span>{filteredOptions.length} of {allOptions.length} options</span>
                {searchQuery ? (
                  <span className="text-emerald-400 truncate max-w-[120px]">
                    Matching: "{searchQuery}"
                  </span>
                ) : (
                  <span className="text-slate-500">Type letters to filter</span>
                )}
              </div>
            </div>
          )}

          {/* OPTIONS LIST */}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-800/30 scrollbar-thin scrollbar-thumb-slate-700"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-slate-400">
                <p className="mb-1 text-slate-300">No matching options</p>
                <p className="text-[10px] text-slate-500 mb-2">No results found for "{searchQuery}"</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 rounded font-medium cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === currentValue;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.key || `${opt.value}-${idx}`}
                    data-option-item
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(opt.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                        : isHighlighted
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                    } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
