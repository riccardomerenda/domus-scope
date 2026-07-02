# DomusScope — UI & UX Design

Goal: a modern, professional "decision lab" — closer to a well-designed analytics product
than to a consumer mortgage calculator. Calm, data-forward, zero clutter, trustworthy.

## 1. Design language

- **Layout:** left sidebar navigation + content area; cards on soft-contrast surfaces;
  generous whitespace; max content width for readability.
- **Typography:** Inter (variable). Numbers always `font-variant-numeric: tabular-nums`.
  Large KPI numerals with small explanatory captions.
- **Color:** neutral slate scale as base, one restrained accent for interactive elements.
  Semantic verdict colors used _only_ for verdicts and chart series identity:
  buy, rent, cash, grey-zone — consistent across every chip, chart, and table in the app.
  Light and dark themes from day one (CSS variables / Tailwind tokens).
- **Tone:** explanatory, neutral (NFR-009). No "congratulations, buy it!" language.
  Every strong claim carries its assumptions inline.
- **Signature interaction:** any number anywhere can be clicked to open its
  **explanation drawer** — formula, resolved inputs, source layer of each assumption
  (engine default / global / scenario override). This is the product's identity feature.
- Charts follow the `dataviz` skill guidance at implementation time (single system,
  light/dark safe, accessible palettes).

## 2. Information architecture

```
Sidebar
├── Dashboard                    # all scenarios at a glance
├── Scenarios                    # list + create
│   └── Scenario workspace       # tabs: Inputs · Results · Sensitivity · Journal
├── Profile & Assumptions        # personal profile, global assumption layers, presets
└── Settings                     # cost catalog editor, formatting, data export/import, theme
```

## 3. Screens

### 3.1 Dashboard

Scenario cards: name, property summary, verdict chip + fragility badge
(Solid / Sensitive / Fragile), year-1 cost delta, wealth advantage at horizon, sparkline
of `advantage_t`, last-updated. Empty state teaches the core concept in three sentences.

### 3.2 Scenario creation — Quick mode (source doc flow 11.1)

One single screen, ~8 fields, completable in under two minutes (NFR-006): price,
equivalent rent, horizon, mortgage-or-cash, down payment, rate, duration, and the preset
picker (conservative/base/optimistic) that fills the rest. Output appears live beside the
form: derived `R*` with its derivation visible, ratio gauge, simplified year-1 cost
comparison (three bars: rent / mortgage / cash), provisional verdict + warnings.
CTA: "Deepen with full analysis →" (upgrades the scenario, keeps the data).

### 3.3 Scenario workspace — Inputs (Analytical mode, flow 11.2)

Sectioned form (not a rigid wizard — sections are freely navigable, with completeness
indicators): Property → Purchase costs (cost-catalog items with IT presets, add/remove/
edit) → Financing (mortgage with live payment preview, or cash with liquidity impact) →
Rent alternative (equivalent vs current rent, comparability selector with consequences
explained) → Assumptions (per-scenario overrides over the global layer, provenance
shown) → Personal constraints (liquidity, emergency fund).
Validation is inline and blocking only where BR rules demand (BR-001/002); sanity-bound
violations warn without blocking (BR-020).

### 3.4 Scenario workspace — Results

- **Verdict banner:** verdict, one-paragraph explanation, fragility badge, active
  warnings as dismissable-but-persistent chips.
- **KPI row:** year-1 unrecoverable cost (rent vs buy), break-even (cost, liquidation),
  break-even (wealth), wealth advantage at horizon, liquidity after purchase.
- **Charts:**
  1. Cumulative unrecoverable costs, rent vs buy (Lens A), nominal/real toggle.
  2. Net worth over time, rent vs buy (Lens B), hold/liquidation toggle.
  3. **Sell-at-year-t advantage** bar chart (`advantage_t`) — the signature chart.
  4. Mortgage anatomy: stacked area of interest vs principal per year + balance line.
  5. Cost composition: stacked breakdown of buy-side line items per year
     (interest, maintenance, opportunity, appreciation credit as negative…).
- **Year table:** the full projection, both lenses, exportable; every cell traceable.
- Lens labeling is explicit and persistent (BR-017): each chart is tagged
  "Cost lens" / "Wealth lens".

### 3.5 Scenario workspace — Sensitivity

- **Tornado chart:** impact of each perturbed assumption on wealth advantage at horizon;
  bars that flip the verdict are visually flagged.
- **Preset triple switch:** conservative / base / optimistic side-by-side KPIs.
- **Verdict heatmap:** rent growth × home appreciation grid colored by verdict — shows
  the frontier where the decision flips.
- **Fragility index** summary with plain-language reading.

### 3.6 Scenario workspace — Journal (FR-016)

Timestamped notes, structured pros/cons (linked to the qualitative factors), visit log,
and a final **decision record** ("decided X on date Y because Z") that freezes a
scenario revision with it — the personal memory the source document asks for.

### 3.7 Comparison view (FR-012)

Pick 2–4 scenarios → aligned KPI table + overlaid `advantage_t` curves. Differences in
assumptions between scenarios are highlighted to prevent apples-to-oranges reading.

### 3.8 Profile & Assumptions

Personal profile (liquidity, emergency fund, current rent, city, qualitative weights) and
the global assumption layer with preset management (create/edit/duplicate presets).

### 3.9 Settings

Cost-catalog editor (built-in IT items + user items, full CostItem shape), formatting
options, theme, PWA install hint, data management (export/import JSON, wipe with
confirmation).

### 3.10 Report / export (FR-017, US-013)

Print-optimized report route: inputs, effective assumptions with provenance, KPIs, the
five charts, year table, qualitative panel, journal decision record, and the
not-financial-advice disclaimer. Browser print → PDF; plus JSON export.

## 4. Qualitative factors presentation (BR-015, critique W4)

The results screen has a two-column epilogue: **"The numbers say"** (financial delta,
break-evens) and **"Your priorities say"** (preference index 0–100 from weighted scores,
with per-factor bars). Deliberately no combined score; the UI copy states why.

## 5. Component inventory (shared)

VerdictChip, FragilityBadge, WarningChip, KpiStat, ExplainableNumber (wraps any figure,
opens the explanation drawer), AssumptionField (value + provenance + reset-to-layer),
CostItemRow/Editor, LensTag, YearTable, ChartCard (title, lens tag, toggles, empty
state), PresetPicker, ComparabilitySelector, ScoreSlider, RevisionDiffView.

## 6. Accessibility & formatting

- WCAG AA contrast in both themes; full keyboard navigation (Radix primitives);
  focus-visible styles; charts include accessible table fallbacks (the year table is the
  canonical data view).
- Currency: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`,
  0 decimals default. Percentages: 1 decimal. UI language: English.
