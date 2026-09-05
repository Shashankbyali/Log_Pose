"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/types";

interface PlaceSearchProps {
  onSelect: (result: GeocodeResult) => void;
  selected: GeocodeResult | null;
  onClear: () => void;
  disabled?: boolean;
  /** Field label shown once a place is chosen, e.g. "Destination". */
  label: string;
  placeholder: string;
  /** Extra control rendered under the input, e.g. "Use my location". */
  footer?: React.ReactNode;
}

const DEBOUNCE_MS = 450;
const MIN_QUERY_LENGTH = 3;
const RETRY_DELAY_MS = 900;

/**
 * Real place search backed by Nominatim through our API route. Used for both
 * the starting point and the destination.
 *
 * Requests are debounced, deduplicated against the last query and aborted when
 * superseded, to respect the Nominatim usage policy. Nothing is suggested that
 * OpenStreetMap did not return.
 */
export function PlaceSearch({
  onSelect,
  selected,
  onClear,
  disabled = false,
  label,
  placeholder,
  footer,
}: PlaceSearchProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [state, setState] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastQuery = useRef("");

  const trimmed = query.trim();
  // Whether a search is currently meaningful. Derived rather than stored, so
  // the effect never has to synchronously reset state.
  const searchable = !selected && trimmed.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!searchable) return;
    if (trimmed === lastQuery.current) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      lastQuery.current = trimmed;
      setState("searching");
      setErrorMessage(null);

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(
            `/api/geocode?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal },
          );
          const data = (await response.json()) as {
            results?: GeocodeResult[];
            error?: string;
          };

          if (!response.ok) {
            if (attempt === 0 && (response.status === 502 || response.status === 503)) {
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
              continue;
            }
            setState("error");
            setErrorMessage(data.error ?? "Destination search is unavailable.");
            setResults([]);
            return;
          }

          setResults(data.results ?? []);
          setState("done");
          return;
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
          setState("error");
          setErrorMessage("Destination search is unavailable. Try again.");
          setResults([]);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchable]);

  if (selected) {
    return (
      <div className="lp-fade-up flex items-start justify-between gap-3 rounded-xl border border-teal-400/30 bg-teal-400/[0.06] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-teal-300/80">
            {label}
          </p>
          <p className="truncate font-medium text-white">{selected.name}</p>
          {selected.detail && (
            <p className="truncate text-xs text-zinc-400">{selected.detail}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            lastQuery.current = "";
            onClear();
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={listId} className="sr-only">
        {label}
      </label>
      <input
        id={listId}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        aria-describedby={`${listId}-status`}
        suppressHydrationWarning
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-white transition placeholder:text-zinc-500 focus:border-teal-400/50 focus:bg-black/45 focus:outline-none focus:ring-2 focus:ring-teal-400/20 disabled:opacity-50"
      />

      <p id={`${listId}-status`} className="mt-1.5 min-h-4 text-xs text-zinc-500">
        {!searchable && trimmed.length > 0 && "Keep typing..."}
        {searchable && state === "searching" && "Searching OpenStreetMap..."}
        {searchable && state === "error" && (
          <span className="text-orange-300">{errorMessage}</span>
        )}
        {searchable && state === "done" && results.length === 0 && (
          <span>No matching place found. Try a different search.</span>
        )}
      </p>

      {searchable && results.length > 0 && (
        <ul
          className="lp-scroll lp-fade-up mt-1 max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-white/8 bg-black/25 p-1"
          role="listbox"
        >
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => {
                  setResults([]);
                  onSelect(result);
                }}
                className="lp-focus w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/5"
              >
                <span className="block truncate text-sm font-medium text-zinc-100">
                  {result.name}
                </span>
                {result.detail && (
                  <span className="block truncate text-xs text-zinc-500">
                    {result.detail}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchable && results.length > 0 && (
        <p className="mt-1 text-[11px] text-zinc-600">
          Search results from OpenStreetMap / Nominatim
        </p>
      )}

      {footer}
    </div>
  );
}
