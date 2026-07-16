import { useEffect, useRef, useState, type DependencyList } from "react";

/**
 * Debounced write-through: runs `save` `delay` ms after the deps settle,
 * skipping the initial mount (nothing changed yet). A save still pending when
 * the component unmounts (navigation, mode switch re-keying the editor) is
 * flushed immediately — edits must never be dropped.
 */
export function useDebouncedSave(save: () => void, deps: DependencyList, delay = 300): void {
  const first = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;
  const pending = useRef(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = true;
    const timer = setTimeout(() => {
      pending.current = false;
      saveRef.current();
    }, delay);
    return () => clearTimeout(timer);
  }, deps);
  useEffect(
    () => () => {
      if (pending.current) {
        pending.current = false;
        saveRef.current();
      }
    },
    [],
  );
}

/**
 * Whether IndexedDB is exempt from storage-pressure eviction (requested at
 * startup in main.tsx). `null` while resolving or when the API is missing.
 */
export function useStoragePersistence(): boolean | null {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void navigator.storage
      ?.persisted?.()
      .then((value) => {
        if (!cancelled) setPersisted(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return persisted;
}
