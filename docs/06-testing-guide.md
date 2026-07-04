# DomusScope — Testing Guide

A hands-on guide for trying the app: setup in three commands, then a guided tour of
every feature with things worth checking along the way. No prior knowledge of the
codebase needed.

## 1. Setup (≈2 minutes)

You need **Node.js ≥ 22** (https://nodejs.org) and **pnpm**:

```bash
npm install -g pnpm        # once, if you don't have pnpm
```

Then, from the repository root:

```bash
pnpm install
pnpm --filter @domus-scope/web dev
```

Open **http://localhost:5173**. That's it — there is no backend, no account, no
configuration. Everything you enter is stored in your browser's IndexedDB and never
leaves your machine.

> **Resetting:** Settings → _Danger zone_ → _Delete all data_ wipes everything.
> **Sharing a scenario with someone** (e.g. to report something odd you found): open the
> scenario → _Report_ → _Export JSON_, and send the file; they import it from Settings.

To verify the code itself rather than the UI:

```bash
pnpm check                                # typecheck + lint + 79 unit/component tests
pnpm --filter @domus-scope/web exec playwright install chromium   # once
pnpm --filter @domus-scope/web e2e        # browser smoke test of the whole journey
```

## 2. What this app is (60 seconds of context)

Comparing a rent payment to a mortgage payment is the classic mistake: part of the
mortgage payment becomes your own wealth (principal), only the rest is a true cost
(interest). DomusScope compares **unrecoverable costs** and simulates **net worth** for
renting vs. buying, with every assumption explicit, editable, and traceable. It is
calibrated for the Italian market (registration tax, notary, agency, mortgage-interest
deduction…) but every rate is editable data.

Two modes per scenario:

- **Quick** — a first screening in ~8 fields, with a threshold _derived from your own
  assumptions_ instead of the folklore "5% rule".
- **Full analysis** — a monthly, two-lens simulation over your horizon.

## 3. Guided tour

### 3.1 First scenario (Quick mode)

1. From the dashboard, click **Create your first scenario**.
2. You land on the Quick form with sensible defaults and a live results panel:
   - the **verdict chip** (e.g. _Buy (mortgage)_),
   - the **gauge**: your rent-to-price ratio _R_ against the derived threshold _R\*_
     with its grey band,
   - the **three-bar comparison** of year-1 unrecoverable costs (rent / mortgage / cash),
   - itemized breakdowns underneath.
3. **The signature interaction:** click any number with a dotted underline — a drawer
   opens with the formula, the exact input values used, and which methodology ("lens")
   produced it. Also try _"How is the threshold R\* derived?"_ under the gauge.
   The input-side twin: every field label carries a small **ⓘ** — click it for what the
   field is, why it matters, typical Italian values, pitfalls, and which way it pushes
   the verdict.
4. Play with the inputs: switch financing to **Cash** (verdict entity changes), set the
   horizon to 2 years (a warning about one-time costs appears), set comparability to
   _Low_ (the verdict becomes _indicative_), enable the liquidity check with savings
   below the price (strong warnings fire).
5. Everything auto-saves ~300 ms after you stop typing. **Reload the page** — nothing is
   lost.

### 3.2 Full analysis

1. Click **Deepen with full analysis →**. The full form is seeded from your quick
   inputs; you can always go back with _← Quick view_ (both datasets are kept).
2. **Inputs tab**, worth trying:
   - **Cost catalog** → _+ Italian purchase costs_: registration tax, notary, agency,
     imposta sostitutiva etc. are generated **from your scenario's own numbers** and are
     fully editable (toggle, edit, delete, or add custom one-time/recurring items with
     recoverability — a deposit is fully recoverable, a renovation partially).
   - **Financing**: the exact monthly payment updates live.
   - **Assumptions**: each value shows its **provenance** (engine default / your global
     value / scenario override). Edit one → it becomes a scenario override with an
     _inherit_ reset. Try the Conservative / Base / Optimistic chips.
3. **Results tab**:
   - Verdict banner with the net-worth advantage at your horizon and a **fragility
     badge** (how robust the verdict is under perturbations).
   - Toggles: **If sold / If held** (include selling costs or not) and **Real terms**
     (deflate by inflation).
   - Five charts — the key one is **"If you sold in year t"**: the advantage of having
     bought if you liquidated at each year. Hover everything.
   - The **year table**: expand any row → every line item opens the explanation drawer.
   - At the bottom, the two-column epilogue: _The numbers say_ vs _Your priorities say_
     — deliberately never merged.
4. **Sensitivity tab**: which assumption moves the result most (tornado), which flips
   the verdict (outlined in red and listed), the conservative/base/optimistic
   side-by-side, and the **verdict heatmap** across rent growth × home appreciation.
5. **Journal tab**:
   - Score the qualitative factors (stability, flexibility, …) → the preference index
     appears (weights are in Profile & Assumptions).
   - Add notes / visits / pros / cons.
   - **Record the final decision** — it freezes a snapshot of today's inputs.
   - **History**: save labeled snapshots, then change an input and use _Compare to now_
     to see exactly which inputs differ ("why did the result change?").

### 3.3 The rest

- **Report** (top-right in the workspace): a print-optimized page — _Print / save as
  PDF_ — with inputs, assumptions + provenance, projection, journal, decision, and the
  disclaimer. Also exports the single scenario as JSON.
- **Compare** (sidebar): select 2–4 full-analysis scenarios → aligned KPIs, overlaid
  advantage curves, and an assumptions table that highlights every difference.
- **Profile & Assumptions** (sidebar): your liquidity/emergency fund (drives the
  affordability warnings), the global assumption layer, preset management, and the
  qualitative weights.
- **Glossary** (sidebar): the full field guide — every concept, input, and assumption
  with typical Italian values and the direction of its effect; the same content the ⓘ
  popovers show.
- **Settings**: light/dark theme, **language** (Auto / English / Italiano — the whole
  UI is bilingual; numbers and dates stay in Italian format either way), full JSON
  export/import (backups are additive, never overwrite), wipe.
- **PWA**: in a Chromium browser you can install the app (icon in the address bar);
  it works offline after the first load.

## 4. Known scope limits (by design, not bugs)

- Fixed-rate mortgages only (variable rates are a designed extension point).
- Rent grows smoothly at a yearly rate (no Italian 4+4 step contracts yet).
- All money is nominal unless you enable the _Real terms_ toggle; no NPV discounting.
- Quick mode uses a simplified year-1 interest preview and says so; the full analysis
  uses the exact amortization schedule — the two intentionally differ slightly.
- It is a personal analysis tool, **not financial advice**.

## 5. Reporting something odd

The most useful bug report is the scenario itself: open it → _Report_ → **Export JSON**
and attach the file, together with what you expected vs. what you saw. Numbers are
deterministic — the same file reproduces the same results anywhere.
