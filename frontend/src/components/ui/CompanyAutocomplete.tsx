import { useCallback, useEffect, useRef, useState } from "react";

import { ensureAuthToken } from "../../api";
import { TextInput } from "./TextField";

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
  /** company = работодатель, institution = учебное заведение */
  kind?: "company" | "institution";
}

export function CompanyAutocomplete({
  value,
  onChange,
  placeholder,
  id,
  kind = "company",
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  /** После выбора из списка не дергаем DaData повторно — иначе dropdown открывается снова. */
  const pickedValueRef = useRef<string | null>(null);

  const endpoint = kind === "institution" ? "/api/enrich/institution" : "/api/enrich/company";

  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      try {
        const token = await ensureAuthToken();
        const r = await fetch(`${API_URL}${endpoint}?q=${encodeURIComponent(q)}&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        const next = data.suggestions || [];
        setSuggestions(next);
        setOpen(next.length > 0);
      } catch {
        /* silent */
      }
    },
    [endpoint],
  );

  useEffect(() => {
    if (value === pickedValueRef.current) {
      setOpen(false);
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
    return () => clearTimeout(debounceRef.current);
  }, [value, fetchSuggestions]);

  const handleInputChange = (next: string) => {
    pickedValueRef.current = null;
    onChange(next);
  };

  const pickSuggestion = (name: string) => {
    pickedValueRef.current = name;
    onChange(name);
    setOpen(false);
    setSuggestions([]);
  };

  const hintText =
    kind === "institution"
      ? "Достаточно аббревиатуры — подскажем полное название вуза"
      : "Достаточно аббревиатуры — подскажем полное название компании";

  return (
    <div className="relative">
      <TextInput
        id={id}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <p className="mt-1.5 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
        {hintText}
      </p>
      {open && suggestions.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border shadow-xl"
          style={{
            borderColor: "var(--border-subtle)",
            background: "var(--surface-elevated)",
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pickSuggestion(s.name);
              }}
              className="flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:opacity-90"
              style={{ color: "var(--tg-text)" }}
            >
              <span className="text-sm font-medium">{s.name}</span>
              {s.hint && (
                <span className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {s.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
