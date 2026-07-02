# DomusScope — Architecture

## 1. Architectural decision: local-first SPA, pure domain engine

**Decision:** a browser-based single-page application (installable PWA) with **no
backend**, built on a **pure TypeScript domain engine** packaged separately from the UI.

**Why:**

- **Privacy (NFR-004):** financial data never leaves the device. IndexedDB storage,
  JSON export/import for backup. No accounts, no telemetry, no server to secure.
- **Determinism (NFR-002):** the engine is a pure function of its inputs — trivially
  testable, portable to any future host (CLI, desktop, mobile) without rewrite.
- **Cost/maintenance:** a personal tool should have zero infrastructure. A static build
  runs from `file://`, a local server, or any static host.
- **Explainability (NFR-001/FR-019):** explanation traces are a first-class engine
  output, not a UI afterthought.

**Alternatives considered and rejected:**

| Option                         | Why rejected                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js / any server framework | No server-side needs; adds deployment surface and privacy questions for zero benefit                                                      |
| SvelteKit / SolidStart         | Perfectly viable; React chosen for the richer ecosystem in exactly what this app needs (headless UI primitives, form libraries, charting) |
| Tauri / Electron desktop       | Packaging and update burden; the browser + PWA install covers the use case                                                                |
| Backend + database             | Contradicts local-first privacy; overkill for single-user data volumes                                                                    |
| Spreadsheet                    | The status quo this project exists to beat: no traces, no scenarios, no warnings                                                          |

## 2. Stack

| Concern             | Choice                                           | Notes                                                              |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Language            | TypeScript, `strict: true`, ESM                  | Single language across packages                                    |
| Package manager     | pnpm workspaces                                  | Monorepo, fast, strict node_modules                                |
| Domain engine       | `packages/engine` — zero UI deps                 | Zod as its only runtime dependency                                 |
| UI framework        | React 19 + Vite                                  | SPA, code-split by route                                           |
| Styling             | Tailwind CSS v4                                  | Design tokens as CSS variables, dark/light                         |
| Components          | Radix UI primitives + in-house styled components | Accessible by default; no heavyweight kit                          |
| Charts              | Recharts                                         | Cumulative curves, tornado, heatmap, stacked areas                 |
| App state           | Zustand (slices)                                 | Scenarios, profile, settings; engine results are derived, memoized |
| Persistence         | Dexie (IndexedDB)                                | Schema-versioned with migrations; JSON export/import               |
| Forms & validation  | react-hook-form + Zod resolvers                  | The same Zod schemas validate forms, storage, and imports          |
| Unit/property tests | Vitest + fast-check                              | Golden vectors TV-01…10, invariants PT-01…03                       |
| Component tests     | Testing Library                                  | Critical flows: quick mode, results, warnings                      |
| E2E smoke           | Playwright                                       | One happy path per release phase                                   |
| Lint/format         | ESLint (flat config) + Prettier                  | CI gate                                                            |
| PWA                 | vite-plugin-pwa                                  | Offline, installable                                               |

Node 22 LTS. No date libraries needed — the engine works on period indices, which also
protects determinism.

## 3. Repository layout

```
domus-scope/
├── pnpm-workspace.yaml
├── package.json                  # root scripts: build, test, lint, typecheck
├── tsconfig.base.json
├── docs/
├── packages/
│   └── engine/
│       ├── src/
│       │   ├── schemas/          # Zod schemas: ScenarioInput, EngineConfig, CostItem…
│       │   ├── mortgage/         # amortization, rate schedule abstraction
│       │   ├── costs/            # cost-item catalog, resolution, built-in presets
│       │   ├── lenses/
│       │   │   ├── cost.ts       # Lens A
│       │   │   └── wealth.ts     # Lens B
│       │   ├── rules/            # quick rule (derived R*), verdict, warnings
│       │   ├── sensitivity/      # OAT perturbations, fragility index, heatmap grid
│       │   ├── explain/          # trace model: formulaId + resolved inputs per line item
│       │   ├── presets/          # conservative/base/optimistic + IT cost presets (data)
│       │   └── index.ts          # public API
│       └── test/                 # golden/, property/, determinism/
└── apps/
    └── web/
        ├── src/
        │   ├── app/              # routing, providers, layout shell
        │   ├── features/
        │   │   ├── dashboard/    # scenario cards, verdict chips
        │   │   ├── scenario/     # wizard (quick + analytical), inputs tabs
        │   │   ├── results/      # KPIs, charts, explanation drawers
        │   │   ├── sensitivity/  # tornado, presets toggle, verdict heatmap
        │   │   ├── comparison/   # multi-scenario table
        │   │   ├── journal/      # decision diary
        │   │   └── settings/     # presets editor, cost catalog editor, data mgmt
        │   ├── stores/           # Zustand slices
        │   ├── persistence/      # Dexie db, migrations, export/import
        │   ├── components/       # shared styled primitives
        │   └── lib/              # formatting (Intl it-IT), misc
        └── test/
```

## 4. Engine public API (sketch)

```ts
// All inputs validated at the boundary; the engine assumes valid data internally.
export function validateScenario(raw: unknown): Result<ScenarioInput, ValidationIssue[]>;

export function quickAssess(input: QuickInput, config: EngineConfig): QuickResult;
// -> ratio R, derived threshold R* (with derivation trace), band verdict,
//    simplified year-1 costs for rent / mortgage / cash, warnings

export function simulate(input: ScenarioInput, config: EngineConfig): SimulationResult;
// -> per-year projections (both lenses), four break-evens, advantage_t curve,
//    verdict + reasons + fragility, warnings, full explanation traces

export function runSensitivity(
  input: ScenarioInput,
  config: EngineConfig,
  plan?: SensitivityPlan,
): SensitivityResult;
// -> tornado entries, flipped-verdict flags, fragility index, heatmap grid

export const builtinPresets: PresetLibrary; // data, not code
export const builtinCostItems: CostItem[]; // IT-flavored defaults, all editable
```

Every monetary output is a `LineItem`:

```ts
interface LineItem {
  id: string; // e.g. "buy.opportunityCost"
  label: string;
  amount: number; // EUR, unrounded
  formulaId: string; // links to the formula registry shown in the UI
  inputs: Record<string, number | string>; // resolved values used
  lens: "cost" | "wealth" | "quick";
  sign: "cost" | "credit";
}
```

This single structure satisfies FR-019/NFR-001 (auditability): the UI renders any number
as expandable "why this number" content with zero extra engine work.

## 5. Configuration system

- **Layering:** engine defaults → user global assumptions → scenario overrides.
  Resolution happens in the engine (`resolveConfig`) and the result records, for every
  value, _which layer supplied it_ — surfaced in the UI (NFR-005).
- **Schemas:** one Zod schema per config section; presets and the cost catalog are plain
  JSON validated by the same schemas. User-created presets are stored alongside built-ins
  and are exportable.
- **Feature toggles:** opportunity-cost line (BR-011/W-006), real-terms view, liquidation
  vs hold basis, mortgage interest deduction — all config, all traced.

## 6. Persistence and data safety

- Dexie tables: `profiles`, `scenarios`, `scenarioRevisions`, `journalEntries`,
  `userPresets`, `settings`.
- **Revisions (FR-020/NFR-007):** every explicit save stores an immutable snapshot of
  inputs + assumptions; the UI can diff two revisions to answer "why did the result
  change?". Cheap at personal-use volumes.
- **Migrations:** every persisted object carries `schemaVersion`; Dexie migrations
  upgrade in place; import validates + migrates before writing.
- **Export/import:** single JSON file (all data or one scenario), Zod-validated on
  import; imports never overwrite silently — collisions create copies.

## 7. Calculation flow in the app

Engine runs are synchronous and fast (a 30-year monthly simulation is ~360 iterations;
sensitivity ≲ 50 runs; the heatmap ≲ 400 runs — well under a frame budget in the worst
case, so **no web worker initially**; the engine's purity makes moving it into a worker a
non-breaking change if the heatmap grows). Results are derived state: memoized on
`(scenarioRevision, effectiveConfig)`, never stored, so stored data and computed data can
never disagree (NFR-002).

## 8. Quality gates

- `pnpm typecheck && pnpm lint && pnpm test` green at every phase boundary.
- Golden vectors TV-01…TV-10 and properties PT-01…PT-03 from the domain spec live in
  `packages/engine/test` and are the contract with the source document.
- One full-simulation snapshot test on the reference scenario (§16.1 of the source doc)
  guards against silent numeric drift.
- Playwright smoke: create scenario → quick verdict → analytical results → export.

## 9. Extension points (designed now, built later)

| Extension                                | Mechanism already in place                                               |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Variable-rate mortgages                  | `RateSchedule` abstraction instead of scalar rate                        |
| Italian rent-contract steps (4+4, ISTAT) | Rent evolution is a strategy function, smooth-growth is just the default |
| New cost types                           | Cost-item catalog is data + one resolution function                      |
| Monte-Carlo / ranges                     | Engine purity + `SensitivityPlan` generalizes to sampled plans           |
| CLI / desktop / mobile host              | Engine package has no DOM or storage dependencies                        |
| Buy-to-let exit strategy                 | Lens B liquidation step is pluggable                                     |
