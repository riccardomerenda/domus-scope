/** True when the user asks the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Spread into every Recharts series (`<Line {...seriesMotion()} />`): entry
 * animations are skipped under prefers-reduced-motion, which global CSS
 * cannot reach (they are JS-driven).
 */
export function seriesMotion(): { isAnimationActive: boolean } {
  return { isAnimationActive: !prefersReducedMotion() };
}
