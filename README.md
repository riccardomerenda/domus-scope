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

**Phase 0 complete** — monorepo scaffold, engine schemas (Zod), explanation-trace model,
and the French amortization engine with golden, property-based (fast-check), and
determinism tests, all green. Next step: Phase 1 — the quick engine with the derived
threshold rule (see [`docs/05-roadmap.md`](docs/05-roadmap.md)).

### Development

```bash
pnpm install     # once
pnpm check       # typecheck + lint + test
pnpm test        # engine test suite (golden + property + determinism)
```

## Disclaimer

DomusScope is a personal analysis tool. It is **not** financial, tax, notarial, or
investment advice. All defaults are editable assumptions, not predictions.
