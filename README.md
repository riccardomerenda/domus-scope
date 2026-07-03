# DomusScope

**A local-first decision lab for the rent vs. buy vs. cash-purchase question.**

DomusScope is a personal decision-support tool for real-estate choices. It does not answer
"is buying better than renting?" with a slogan — it simulates both paths over time,
separates _unrecoverable costs_ from _wealth accumulation_, makes every assumption
explicit and editable, and shows how fragile each conclusion is when assumptions change.

> Derived from the domain document `documento_progetto_app_dominio_immobiliare.md`
> (Italian). This repository contains the English-language critique, refined domain
> specification, architecture, UI design, and implementation roadmap — followed by the
> implementation itself.

---

## The core idea

Comparing a mortgage payment to a rent payment is the classic mistake: a mortgage payment
contains a **principal portion** (which becomes your wealth) and an **interest portion**
(which is a pure cost). The correct comparison unit is the **unrecoverable cost** of each
scenario:

| Scenario          | Main unrecoverable costs                                                |
| ----------------- | ----------------------------------------------------------------------- |
| Rent              | Rent itself, renter fees, moving costs                                  |
| Buy with mortgage | Interest, maintenance, taxes/fees, opportunity cost of invested capital |
| Buy cash          | Maintenance, taxes/fees, opportunity cost of the _entire_ price         |

DomusScope evaluates every scenario through **two complementary lenses**:

1. **Cost lens** — year-by-year unrecoverable costs, itemized and cumulated. Fast to
   understand, mirrors the "5% rule" reasoning (with the threshold _derived_ from your
   own assumptions, not hardcoded).
2. **Wealth lens** — a full cash-flow simulation where the renter invests the capital the
   buyer locks into the house. Compares total net worth over time on a liquidation basis.

## Product principles

- **Explainable** — every number can be expanded into its formula and inputs.
- **Neutral** — no ideological bias toward buying or renting; the model only reports.
- **Extremely configurable** — every economic parameter (rates, growth, maintenance,
  thresholds, cost items, presets) is data, validated by schema, never hardcoded truth.
- **Local-first & private** — financial data never leaves the device. No backend, no
  telemetry. Storage in the browser (IndexedDB) with JSON export/import.
- **Deterministic** — same inputs, same outputs, always. Rounding policy is explicit.
- **Separation of concerns** — the financial verdict is kept strictly separate from
  personal qualitative factors (stability, flexibility, family, work).

## Technology

| Layer         | Choice                                | Why                                                      |
| ------------- | ------------------------------------- | -------------------------------------------------------- |
| Language      | TypeScript (strict)                   | One language across engine and UI, strong domain typing  |
| Domain engine | Pure TS package, zero UI deps         | Deterministic, portable, exhaustively testable           |
| UI            | React 19 + Vite                       | Mature ecosystem for forms, charts, components           |
| Styling       | Tailwind CSS v4 + Radix UI primitives | Modern, accessible, fast to build a polished UI          |
| Charts        | Recharts                              | Declarative, fits the required chart set                 |
| State         | Zustand                               | Minimal, explicit stores                                 |
| Persistence   | IndexedDB via Dexie                   | Local-first, schema-versioned, migratable                |
| Validation    | Zod                                   | Schemas double as domain validation and config contracts |
| Testing       | Vitest + fast-check + Testing Library | Golden tests, property-based invariants                  |
| Tooling       | pnpm workspaces, ESLint, Prettier     | Monorepo hygiene                                         |

Full rationale and rejected alternatives: [`docs/03-architecture.md`](docs/03-architecture.md).

## Planned repository layout

```
domus-scope/
├── packages/
│   └── engine/          # Pure domain engine: schemas, mortgage math, simulation,
│                        # rules, sensitivity, explanation traces, presets
├── apps/
│   └── web/             # React SPA (PWA): scenario workspace, results, sensitivity,
│                        # comparison, decision journal, settings
├── docs/                # Project documentation (this planning set)
└── documento_progetto_app_dominio_immobiliare.md   # Original domain document (Italian)
```

## Documentation

| Document                                             | Content                                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`docs/01-critique.md`](docs/01-critique.md)         | Critical review of the source domain document: validated strengths, weaknesses, gaps                                 |
| [`docs/02-domain-spec.md`](docs/02-domain-spec.md)   | Refined domain specification: methodology, corrected formulas, input/output catalogs, validation rules, test vectors |
| [`docs/03-architecture.md`](docs/03-architecture.md) | Stack decision, monorepo layout, engine design, configuration system, persistence, testing strategy                  |
| [`docs/04-ui-design.md`](docs/04-ui-design.md)       | Information architecture, screens, design language, chart set, component inventory                                   |
| [`docs/05-roadmap.md`](docs/05-roadmap.md)           | Phased implementation plan with milestones, tasks, and acceptance criteria                                           |

## Status

**Phase 4 complete** — the analytical mode is fully usable end-to-end (source-doc flow
11.2). On top of the engine (Phases 0–2) and the Quick-mode MVP (Phase 3), the app now
ships: one-click **upgrade from Quick to full analysis** (data seeded, mode switchable
back); the sectioned **Inputs screen** — property, editable **cost catalog** (Italian
presets generated from the scenario's own numbers + a full custom-item editor with
one-time/recurring timing, percent bases, recoverability), financing with live exact
payment preview, rent alternative, **assumptions with per-value provenance**
(engine-default / global / scenario) and preset chips, horizon & selling costs, and the
liquidity check against the global profile; the **Results screen** — verdict banner with
advantage at horizon and warnings (FR-015), KPI tiles, hold/liquidation and
nominal/real toggles, the five charts (cumulative unrecoverable costs, net worth,
**sell-at-year-t advantage**, mortgage anatomy, buy-side cost composition, all
CVD-validated colors with hover tooltips), wealth compositions at horizon, and the
expandable **year table** whose line items all open the explanation drawer; plus the
**Profile & Assumptions** page (personal profile, global assumption layer with
provenance, built-in + user presets). Storage migrated to schema v2 (v1 exports still
import). 63 tests green across the workspace. Playwright smoke remains deferred
(component tests cover both flows). Next: Phase 5 — sensitivity & comparison
(see [`docs/05-roadmap.md`](docs/05-roadmap.md)).

Run it: `pnpm --filter @domus-scope/web dev` → http://localhost:5173

## Getting started

### Prerequisites

- **Node.js ≥ 22** (24.x works)
- **pnpm ≥ 9** — if you don't have it: `npm install -g pnpm` (or `corepack enable pnpm`
  in an elevated shell on Windows)

### Setup and daily commands

```bash
pnpm install     # install all workspace dependencies (once)
pnpm check       # the full gate: typecheck + lint + test
```

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm test`      | Engine test suite (golden + property-based + determinism) |
| `pnpm typecheck` | TypeScript strict check across all packages               |
| `pnpm lint`      | ESLint (type-checked rules)                               |
| `pnpm format`    | Prettier over the whole repo                              |
| `pnpm build`     | Compile packages to `dist/`                               |

To work on a single package: `pnpm --filter @domus-scope/engine test` (add `--watch`
via `pnpm --filter @domus-scope/engine exec vitest` for TDD).

### Is there something to run yet?

Not as an app: until Phase 3 this repository is a **domain engine library plus its test
suite** — the test suite _is_ the executable specification. The web app (`apps/web`)
arrives in Phase 3. You can already use the engine as a library, though:

```ts
import { quickAssess, quickInputSchema, defaultEngineConfig } from "@domus-scope/engine";

const input = quickInputSchema.parse({
  propertyPrice: 200_000,
  equivalentMonthlyRent: 1_250,
  horizonYears: 10,
  financing: { kind: "mortgage", downPayment: 40_000, annualRate: 0.03, durationYears: 25 },
});

const result = quickAssess(input, defaultEngineConfig);
console.log(result.rule.threshold); // derived R*, e.g. 0.028 with default assumptions
console.log(result.verdict.kind); // "BUY_MORTGAGE" | "BUY_CASH" | "RENT" | "GREY_ZONE"
console.log(result.yearOne.mortgage?.items); // traced year-1 cost lines
```

## Disclaimer

DomusScope is a personal analysis tool. It is **not** financial, tax, notarial, or
investment advice. All defaults are editable assumptions, not predictions.
