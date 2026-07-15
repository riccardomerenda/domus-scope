import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDebouncedSave } from "../src/lib/hooks";

describe("useDebouncedSave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves after the delay and never on mount alone", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { rerender } = renderHook(({ v }) => useDebouncedSave(save, [v]), {
      initialProps: { v: 1 },
    });
    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();

    rerender({ v: 2 });
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flushes a pending save on unmount instead of dropping it", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { rerender, unmount } = renderHook(({ v }) => useDebouncedSave(save, [v]), {
      initialProps: { v: 1 },
    });
    rerender({ v: 2 });
    unmount(); // before the debounce fires
    expect(save).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(save).toHaveBeenCalledTimes(1); // flushed exactly once
  });

  it("does not flush on unmount when nothing is pending", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { rerender, unmount } = renderHook(({ v }) => useDebouncedSave(save, [v]), {
      initialProps: { v: 1 },
    });
    rerender({ v: 2 });
    vi.advanceTimersByTime(300); // debounce fires normally
    expect(save).toHaveBeenCalledTimes(1);
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
