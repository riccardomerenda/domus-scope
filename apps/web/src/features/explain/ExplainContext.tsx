import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { type LineItem, type QuickRuleAssessment } from "@domus-scope/engine";
import { ExplanationDrawer } from "./ExplanationDrawer";

/**
 * The signature interaction (FR-019/NFR-001): any number can be opened into an
 * explanation drawer showing its formula, resolved inputs, and lens.
 */
export type ExplainPayload =
  { kind: "lineItem"; item: LineItem } | { kind: "threshold"; rule: QuickRuleAssessment };

interface ExplainContextValue {
  openExplanation: (payload: ExplainPayload) => void;
}

const ExplainContext = createContext<ExplainContextValue | null>(null);

export function ExplainProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<ExplainPayload | null>(null);
  const openExplanation = useCallback((next: ExplainPayload) => setPayload(next), []);
  const value = useMemo(() => ({ openExplanation }), [openExplanation]);

  return (
    <ExplainContext.Provider value={value}>
      {children}
      <ExplanationDrawer payload={payload} onClose={() => setPayload(null)} />
    </ExplainContext.Provider>
  );
}

export function useExplain(): ExplainContextValue {
  const context = useContext(ExplainContext);
  if (!context) throw new Error("useExplain must be used inside ExplainProvider");
  return context;
}
