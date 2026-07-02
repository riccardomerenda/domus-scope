# DomusScope — Implementation Roadmap

Phased plan. Each phase ends **green** (typecheck + lint + tests) and **usable** — no
phase leaves the app in a broken intermediate state. FR/BR/TV identifiers refer to
[`02-domain-spec.md`](02-domain-spec.md). Sizes: S (≤ half day), M (~1 day), L (2–3 days)
of focused work.

---

## Phase 0 — Foundation (scaffold + engine skeleton)

**Goal:** a monorepo where `pnpm test` already proves domain correctness on paper
examples.

| #   | Task                                                                                                                           | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 0.1 | `git init`; pnpm workspace; root scripts; `tsconfig.base.json` strict; ESLint flat + Prettier; `.gitignore`, `.editorconfig`   | S    |
| 0.2 | `packages/engine` package: Zod schemas for `QuickInput`, `ScenarioInput`, `EngineConfig`, `CostItem`; `LineItem` + trace model | M    |
| 0.3 | Mortgage module: French amortization on a `RateSchedule`, zero-rate branch, post-payoff behavior                               | M    |
| 0.4 | Test harness: Vitest + fast-check; golden TV-04, TV-05, TV-07; properties PT-01                                                | M    |

**Exit criteria:** amortization invariants hold under fast-check; determinism test green;
CI-able scripts run clean.

## Phase 1 — Quick engine (the 5%-rule replacement)

**Goal:** `quickAssess()` complete — the source document's MVP brain.

| #   | Task                                                                      | Size |
| --- | ------------------------------------------------------------------------- | ---- |
| 1.1 | Derived threshold `R*` with derivation trace; grey band; interpretations  | M    |
| 1.2 | Simplified year-1 costs for rent / mortgage / cash (labeled "simplified") | M    |
| 1.3 | Warnings W-001…W-005 needed at quick level; validation BR-001/002/003     | S    |
| 1.4 | Golden tests TV-01, TV-02, TV-03, TV-08                                   | S    |

**Exit criteria:** TV-01 (8,800 € vs 15,000 €) and TV-02 (12,000 €) byte-exact;
derived R* reproduces 4.4% on the reference parameters.

## Phase 2 — Full simulation engine (both lenses)

**Goal:** `simulate()` complete: the analytical core.

| #   | Task                                                                                                                              | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 2.1 | Cost-item catalog: resolution engine + built-in IT presets (data)                                                                 | L    |
| 2.2 | Lens A: yearly projections, opportunity + appreciation-credit lines, deduction credit, cumulatives, hold/liquidation, break-evens | L    |
| 2.3 | Lens B: monthly budget-symmetric simulation, portfolios, cgt, wealth curves, `advantage_t`, break-even                            | L    |
| 2.4 | Verdict + ranked reasons; warnings W-006…W-009; comparability cap (BR-022)                                                        | M    |
| 2.5 | Real-terms deflation view; config layering with provenance (`resolveConfig`)                                                      | M    |
| 2.6 | Golden TV-06, TV-09, TV-10; properties PT-02, PT-03; full-simulation snapshot on the reference scenario                           | M    |

**Exit criteria:** all TV/PT green; every output `LineItem` carries a complete trace.

## Phase 3 — Web app MVP (Quick mode end-to-end)

**Goal:** first usable app: create a scenario, get a quick verdict, persist it.

| #   | Task                                                                                                          | Size |
| --- | ------------------------------------------------------------------------------------------------------------- | ---- |
| 3.1 | `apps/web` scaffold: Vite + React + Tailwind v4 tokens (light/dark), router, layout shell, sidebar            | M    |
| 3.2 | Persistence: Dexie schema + migrations; Zustand slices; export/import JSON                                    | M    |
| 3.3 | Dashboard with scenario cards + empty state                                                                   | M    |
| 3.4 | Quick-mode screen with live results panel (gauge, three-bar year-1 comparison, provisional verdict, warnings) | L    |
| 3.5 | ExplainableNumber + explanation drawer (the signature interaction)                                            | M    |
| 3.6 | Component tests for the quick flow; Playwright smoke #1                                                       | M    |

**Exit criteria:** a user can create, edit, duplicate, archive, delete scenarios (FR-001)
and get an explained quick verdict that survives reload.

## Phase 4 — Analytical mode UI

**Goal:** the full decision flow on top of `simulate()`.

| #   | Task                                                                                                                                                                           | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 4.1 | Sectioned inputs screen: property, cost catalog editor (add/edit/toggle items), financing, rent alternative + comparability, assumptions with provenance, personal constraints | L    |
| 4.2 | Results screen: verdict banner, KPI row, charts 1–5 (per `04-ui-design.md` §3.4, following the dataviz skill), lens tags, nominal/real + hold/liquidation toggles              | L    |
| 4.3 | Year table with traceable cells                                                                                                                                                | M    |
| 4.4 | Profile & Assumptions screen; preset management (built-ins + user presets)                                                                                                     | M    |
| 4.5 | Liquidity/emergency-fund warnings surfaced in verdict banner (FR-015)                                                                                                          | S    |

**Exit criteria:** flow 11.2 of the source document is fully executable; every number in
Results opens a correct explanation drawer.

## Phase 5 — Sensitivity & comparison

**Goal:** answer "how fragile is this conclusion?".

| #   | Task                                                                                                      | Size |
| --- | --------------------------------------------------------------------------------------------------------- | ---- |
| 5.1 | Engine `runSensitivity()`: OAT plan, tornado entries, verdict-flip flags, fragility index                 | M    |
| 5.2 | Heatmap grid (rent growth × appreciation) with verdict regions                                            | M    |
| 5.3 | Sensitivity tab UI: tornado, preset triple switch, heatmap, fragility summary                             | L    |
| 5.4 | Comparison view (2–4 scenarios, aligned KPIs, overlaid `advantage_t`, assumption-difference highlighting) | L    |

**Exit criteria:** fragility badge appears on dashboard cards and verdict banners;
flipping variables are identifiable at a glance.

## Phase 6 — Journal, report, polish

**Goal:** complete personal decision tool.

| #   | Task                                                                                                   | Size |
| --- | ------------------------------------------------------------------------------------------------------ | ---- |
| 6.1 | Decision journal: notes, structured pros/cons, visit log, decision record freezing a revision (FR-016) | M    |
| 6.2 | Revision history + diff view ("why did the result change?") (FR-020/NFR-007)                           | M    |
| 6.3 | Print report route + disclaimer; JSON scenario export (FR-017/US-013)                                  | M    |
| 6.4 | Qualitative panel: scores × weights → preference index, two-column epilogue (BR-015)                   | M    |
| 6.5 | PWA (offline, install), final a11y pass, dark-mode audit, Playwright smoke #2                          | M    |

**Exit criteria:** the blueprint question of source-doc §21 is answerable end-to-end,
printable, and remembered.

---

## Traceability

- **Must FRs (FR-001…010, 013…015, 019):** Phases 0–4.
- **Should FRs (FR-011/012/016/018):** Phases 4–6.
- **Could FRs (FR-017/020):** Phase 6.
- **All BR rules:** enforced in engine validation (Phases 1–2), surfaced in UI (3–4).
- **NFRs:** determinism/explainability are engine-structural (Phase 0 decisions);
  privacy is architectural (local-first); usability is Phase 3's exit criterion.

## Risks & mitigations

| Risk                            | Mitigation                                                      |
| ------------------------------- | --------------------------------------------------------------- |
| Numeric drift while refactoring | Full-simulation snapshot + golden vectors as contract           |
| Lens confusion in UI            | Persistent LensTag on every chart/table (BR-017)                |
| Config sprawl                   | Single layered `resolveConfig` with provenance; no ad-hoc reads |
| Scope creep (fiscal detail)     | Cost catalog absorbs new items as data, not code                |
| IndexedDB data loss             | Export reminders; import is additive, never destructive         |

## Immediate next step

Phase 0, task 0.1: initialize git and scaffold the workspace. First implementation
session should complete Phase 0 and Phase 1 (the engine proves the source document's
examples before any UI exists).
