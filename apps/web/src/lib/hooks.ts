import { useEffect, useRef, type DependencyList } from "react";

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
