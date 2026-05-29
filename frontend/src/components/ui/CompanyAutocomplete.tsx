import { useCallback, useEffect, useRef, useState } from "react";

import { ensureAuthToken } from "../../api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface Suggestion {
  name: string;
  hint: string;
  type: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function CompanyAutocomplete({ value, onChange, placeholder, id }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    try {
      const token = await ensureAuthToken();
      const r = await fetch(`${API_URL}/api/enrich/company?q=${encodeURIComponent(q)}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setSuggestions(data.suggestions || []);
      setOpen((data.suggestions || []).length > 0);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchSuggestions]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#2de08a] focus:outline-none"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => {
                onChange(s.name);
                setOpen(false);
                setSuggestions([]);
              }}
              className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors"
            >
              <span className="text-sm font-medium text-white">{s.name}</span>
              {s.hint && <span className="text-xs text-zinc-500 mt-0.5">{s.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
