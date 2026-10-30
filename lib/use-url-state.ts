"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

/** Native history integrates with Next's search params without a server navigation.
 * Always patch the current URL so campaign/unknown parameters and hashes survive.
 */
const subscribeHydration = () => () => {};
const clientHydration = () => true;
const serverHydration = () => false;

export function useUrlState() {
  const nextParams = useSearchParams();
  // Static HTML has no per-request query. Match that first render, then read
  // the real URL after hydration; direct links must not replace the SSR tree.
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydration, serverHydration);
  const search = hydrated ? nextParams.toString() : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const update = useCallback((patch: Record<string, string | undefined>, replace = false) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (url.href === window.location.href) return;
    window.history[replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search + url.hash);
  }, []);
  return { params, update, hydrated };
}

/** A navigation invalidates an outstanding draft, so Back never writes stale text. */
export function useUrlSearch(key = "q") {
  const { params, update } = useUrlState();
  const base = params.toString();
  const urlValue = params.get(key) || "";
  const [draft, setDraft] = useState({ base, value: urlValue });
  const value = draft.base === base ? draft.value : urlValue;
  useEffect(() => {
    if (draft.base !== base || draft.value === urlValue) return;
    const timer = window.setTimeout(() => update({ [key]: draft.value || undefined }, true), 250);
    return () => window.clearTimeout(timer);
  }, [base, draft, key, update, urlValue]);
  return [value, (value: string) => setDraft({ base, value })] as const;
}
