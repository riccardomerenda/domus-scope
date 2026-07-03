import { useEffect, useRef, type DependencyList } from "react";

/**
 * Debounced write-through: runs `save` `delay` ms after the deps settle,
 * skipping the initial mount (nothing changed yet).
 */
export function useDebouncedSave(save: () => void, deps: DependencyList, delay = 300): void {
  const first = useRef(true);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => saveRef.current(), delay);
    return () => clearTimeout(timer);
  }, deps);
}
