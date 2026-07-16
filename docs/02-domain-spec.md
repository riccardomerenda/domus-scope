# DomusScope — Refined Domain Specification

This specification supersedes the formulas and catalogs of the source document while
preserving its intent, its FR/BR/NFR identifiers, and its test examples. It incorporates
the corrections and gap-fills from [`01-critique.md`](01-critique.md).

Conventions: monthly index `m = 1..M`, yearly index `t = 1..T`, horizon `T` years.
All rates are annual unless suffixed `_m` (monthly). Money is computed in double
precision; see §10 (rounding policy).

---

## 1. Methodology: two lenses, never mixed

DomusScope evaluates every comparison through two complementary, clearly-labeled lenses.
Mixing them double-counts the value of liquidity (critique W1); each output in the app is
tagged with its lens.

### Lens A — Cost lens (unrecoverable costs)

Answers: _"How much money leaves each scenario and never comes back?"_
Itemized, year-by-year, cumulative. Includes an explicit opportunity-cost line **and** an
explicit appreciation-credit line (critique W2), so nothing is silently netted. No
portfolio is simulated on the rent side.

### Lens B — Wealth lens (net-worth simulation)

Answers: _"If both people start with the same money and spend the same total budget,
who is richer at year t?"_
A full monthly cash-flow simulation. The renter invests the capital the buyer locks into
the house, plus any monthly outflow difference; the buyer invests any surplus in later
years symmetrically. **No opportunity-cost line item exists in this lens** — it is
implicit in the portfolio. Comparison is on a liquidation basis by default.

The Quick mode uses Lens A (plus the derived quick rule). The Analytical mode computes
both and presents Lens B as the primary financial verdict input.

---

## 2. Quick rule (derived threshold, replaces the fixed "5% rule")

```
R      = (equivalent_monthly_rent × 12) / property_price          # rent-to-price ratio
R*     = m% + tax% + LTV·i + (1 − LTV)·r_alt − g                  # derived threshold
```

| Symbol  | Meaning                                    | Example default                     |
| ------- | ------------------------------------------ | ----------------------------------- |
| `m%`    | Maintenance, % of value/year               | 1%                                  |
| `tax%`  | Recurring ownership taxes, % of value/year | 0% (IT primary residence), editable |
| `LTV`   | Loan-to-value of the hypothetical mortgage | 80%                                 |
| `i`     | Mortgage annual rate                       | user input                          |
| `r_alt` | Expected alternative return (net)          | 4–5%                                |
| `g`     | Expected home appreciation                 | 0–1.5%                              |

Cash purchase: `LTV = 0` → `R* = m% + tax% + r_alt − g`.

Interpretation with a configurable grey band `b` (default 0.5 pp):

| Condition           | Reading                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `R > R* + b`        | Rent is expensive relative to owning — buying deserves full analysis   |
| `R within ±b of R*` | Grey zone — quick rule cannot decide; run Analytical mode              |
| `R < R* − b`        | Renting is relatively cheap — buying needs non-financial justification |

Consistency check (source doc §16.1 parameters: m=1%, tax=0, LTV=0.8, i=3%, r_alt=5%,
g=0): `R* = 4.4%`, matching the document's own year-1 cost of 8,800 € on 200,000 €
(4.4%). The classic 5%/6% emerge only under the assumptions that generate them
(critique W3). The UI always shows how `R*` was derived.

---

## 3. Mortgage engine

French amortization, fixed rate, monthly.

```
i_m   = i / 12
n     = duration_years × 12
P     = mortgage_principal

payment = P × [i_m (1+i_m)^n] / [(1+i_m)^n − 1]      if i_m > 0
payment = P / n                                       if i_m = 0   (BR/edge: zero rate)

interest_m       = balance_{m−1} × i_m
principal_m      = payment − interest_m
balance_m        = balance_{m−1} − principal_m
```

- After month `n`: `payment = 0`, `balance = 0` (horizon may exceed duration — G7).
- Mortgage duration and simulation horizon are independent (BR-004).
- Invariants (property-tested): `Σ principal_m = P`; `balance` strictly decreasing to 0;
  `payment` constant; `interest_m ≥ 0`.
- **Simplified year-1 preview** (Quick mode only): `interest_year1 ≈ P × i`. Always
  labeled "simplified"; Analytical mode uses the exact schedule (critique W9).
- Extension point: the rate is internally a _rate schedule_ `i(m)` (constant for MVP) so
  variable-rate mortgages can be added without redesign (G9).

---

## 4. Cost catalog (the configurability backbone)

Every cost in the system — built-in or user-defined — is a **cost item** with the same
shape. This is what makes the model extensible and Italy-ready without hardcoding.

```
CostItem {
  id            string
  label         string
  scenario      "buy" | "rent" | "both"
  timing        oneTime { month }                        # e.g. notary at month 0
              | recurring { base: fixedAnnual €          # e.g. condo fees
                                | percentOfValue %       # e.g. maintenance
                                | percentOfRent %        # e.g. renter insurance
                            growth: rate | tracksValue | tracksRent }
  recoverability "none" | "full" | "partial(p%)"         # deposit = full, renovation = partial
  sign          "cost" | "credit"                        # credit: tax deductions
  enabled       boolean
  notes         string
}
```

### Built-in preset items (all rates editable — G1/G2/G3/G4)

| Item                             | Scenario   | Default                                 | Notes                                                         |
| -------------------------------- | ---------- | --------------------------------------- | ------------------------------------------------------------- |
| Registration tax (primary res.)  | buy        | 2% of cadastral value                   | 9% non-primary; VAT 4%/10% for new builds — selectable regime |
| Notary — deed                    | buy        | fixed €, editable                       |                                                               |
| Notary — mortgage deed           | buy        | fixed €, editable                       | only if mortgage                                              |
| Imposta sostitutiva              | buy        | 0.25% of mortgage                       | 2% if non-primary                                             |
| Buyer agency fee                 | buy        | 3% + VAT of price                       |                                                               |
| Bank fees (istruttoria, perizia) | buy        | fixed €, editable                       |                                                               |
| Renovation                       | buy        | fixed €, partial recoverability p%      | p% adds to home value                                         |
| Furniture                        | buy/both   | fixed €, recoverability none            |                                                               |
| Maintenance                      | buy        | 1% of value/year, tracksValue           | BR-010                                                        |
| Condominium fees (owner share)   | buy        | fixed €/year                            |                                                               |
| Home + mortgage life insurance   | buy        | fixed €/year                            | quasi-mandatory in IT                                         |
| IMU                              | buy        | 0 (primary) / editable                  | non-primary residences                                        |
| Mortgage interest deduction      | buy        | credit: 19% of interest, cap 4,000 €/yr | primary residence (G4)                                        |
| Selling costs                    | buy (exit) | 3% + VAT of value                       | used in liquidation basis                                     |
| Rental agency fee                | rent       | 1 month + VAT, oneTime                  |                                                               |
| Deposit                          | rent       | 2–3 months, recoverability full         | opportunity cost only                                         |
| Contract registration            | rent       | ~0.5×2% annual, tenant half             |                                                               |
| Moving costs                     | rent/both  | fixed €, oneTime                        |                                                               |
| Renter insurance                 | rent       | fixed €/year                            |                                                               |

---

## 5. Lens A — formulas

### Rent scenario, year t

```
rent_t             = rent_0 × (1 + rent_growth)^t                 # smooth model; step model = G10 ext.
cost_rent_t        = rent_t × 12 + Σ recurring_renter_items_t + Σ oneTime_renter_items_t
cum_cost_rent_t    = Σ_{k≤t} cost_rent_k
```

Recoverable items (deposit) contribute only their opportunity cost:
`deposit × r_alt` per year, as a separate small line item (enabled by default).

### Buy scenario, year t

```
value_t            = price × (1 + g)^t
interest_t         = Σ interest_m for months of year t             # exact schedule
maintenance_t      = value_t × m%
recurring_own_t    = Σ recurring_owner_items_t                      # condo, insurance, IMU…
invested_capital_t = down_payment + oneTime_buy_costs
                     + Σ principal repaid up to t
                     + non-recoverable share of renovation
opportunity_t      = invested_capital_t × r_alt                     # GROSS, visible line
appreciation_t     = −(value_t − value_{t−1})                       # CREDIT, visible line (W2)
deduction_t        = −min(interest_t × 19%, 760)                    # if enabled (G4)

cost_buy_t         = interest_t + maintenance_t + recurring_own_t
                     + opportunity_t + appreciation_t + deduction_t
cum_cost_buy_t     = oneTime_buy_costs + Σ_{k≤t} cost_buy_k
cum_cost_buy_sell_t= cum_cost_buy_t + selling_costs(value_t)        # liquidation basis (W7)
```

Cash purchase: `interest_t = 0`, `invested_capital_t = price + oneTime_buy_costs + …`
(BR-014), no mortgage items.

### Cost-lens break-evens

```
break_even_cost_hold = min t : cum_cost_buy_t      ≤ cum_cost_rent_t
break_even_cost_sell = min t : cum_cost_buy_sell_t ≤ cum_cost_rent_t   # honest default
```

If no such `t ≤ T` exists, the result explicitly states "not within horizon" (US-008).

---

## 6. Lens B — formulas

Monthly simulation. Both agents share the same total monthly budget; whoever spends less
invests the difference at `r_alt` (source doc §9.6 note, made rigorous).

```
outflow_buy_m   = payment_m + monthly_owner_costs_m + oneTime at their month
outflow_rent_m  = rent_m + monthly_renter_costs_m + oneTime at their month
budget_m        = max(outflow_buy_m, outflow_rent_m)

# Renter's portfolio (P) and buyer's portfolio (Q):
P_0 = down_payment + oneTime_buy_costs − oneTime_rent_costs        # capital not spent on the house
P_m = P_{m−1} × (1 + r_alt/12) + (budget_m − outflow_rent_m)
Q_m = Q_{m−1} × (1 + r_alt/12) + (budget_m − outflow_buy_m)        # Q_0 = 0

wealth_rent_t  = P_t − cgt × max(P_t − contributions, 0) + deposit
wealth_buy_t   = value_t − balance_t − selling_costs(value_t)      # liquidation basis
                 + Q_t − cgt × max(Q_t − contributions, 0)
                 [+ capital-gains tax on the property if sold < 5y and non-primary — config]

break_even_wealth = min t : wealth_buy_t ≥ wealth_rent_t
advantage_t       = wealth_buy_t − wealth_rent_t                    # the sell-at-year-t curve (G11)
```

- `cgt` = capital-gains tax on the portfolio, default 26%, configurable; `r_alt` may
  alternatively be entered as net with `cgt = 0` (G5 — one choice, stated in UI).
- A **hold-basis** variant omits `selling_costs`. Both are shown; liquidation is default.
- Real-terms view: every cumulative/terminal figure can be deflated by
  `(1 + inflation)^t` (critique W5). Inflation is a first-class assumption, default 2%.

---

## 7. Inputs catalog (consolidated)

Everything from the source doc §8, plus the additions. All inputs are schema-validated
(Zod) with units, bounds, and defaults; defaults come from the preset system (§9).

| Group                | Inputs                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Property             | price, zone, size, condition, cadastral value, quality notes                                                   |
| Purchase costs       | cost items from catalog (§4), tax regime (primary/non-primary/new-build)                                       |
| Mortgage             | down payment (€ or %), principal, rate, duration; derived: LTV, payment                                        |
| Cash plan            | capital used, remaining liquidity                                                                              |
| Rent alternative     | equivalent rent, current rent (separate! FR-004), rent growth, comparability (low/med/high), renter cost items |
| Economic assumptions | r_alt, g (home appreciation), rent growth, inflation, cgt, maintenance %                                       |
| Personal profile     | liquidity, minimum emergency fund, horizon, city, stability/flexibility scores, notes                          |
| Simulation           | horizon T (3/5/10/20/30 presets), grey band b, lens toggles                                                    |

---

## 8. Outputs, verdicts, warnings

### Key outputs (per scenario, per year, with explanation traces)

Year-1 unrecoverable cost (both lenses' Quick preview), cumulative unrecoverable costs
(nominal + real), net worth curves, debt balance, total interest, total principal
accumulated, invested capital, liquidity after purchase, `advantage_t` curve, four
break-evens (cost/wealth × hold/liquidation), quick-rule `R` vs derived `R*`.

### Verdict

`BUY_MORTGAGE | BUY_CASH | RENT | GREY_ZONE`, always with:

- the ranked reasons (top contributing line items),
- the lens that produced it,
- a **fragility index**: fraction of sensitivity perturbations (§9 of roadmap; W6) that
  flip the verdict — shown as Solid / Sensitive / Fragile,
- comparability cap: if rent comparability = low, verdict strength is capped at
  "indicative" and W-001 fires (G8).

### Warnings catalog

| ID    | Trigger                                                     | Source         |
| ----- | ----------------------------------------------------------- | -------------- |
| W-001 | Rent used is not comparable / comparability low             | BR-007, FR-014 |
| W-002 | Liquidity after purchase < emergency fund                   | BR-006, FR-015 |
| W-003 | Horizon < 3 years — one-time costs dominate                 | BR-005         |
| W-004 | Cash purchase drains liquidity below fund                   | §16.4          |
| W-005 | LTV > 80% (rate assumptions may be optimistic)              | new            |
| W-006 | Opportunity cost disabled                                   | BR-011         |
| W-007 | Negative-equity years present in projection                 | new            |
| W-008 | Horizon exceeds mortgage duration (post-payoff years shown) | G7             |
| W-009 | Assumption outside sanity bounds (e.g. rent growth > 15%)   | new            |

### Qualitative layer (critique W4)

Stability, flexibility, space, family, school, work: user scores (0–10) × user weights →
a normalized 0–100 **preference index**, displayed _beside_ the financial delta, never
summed with it. The report shows both columns explicitly (BR-015).

---

## 9. Presets and configuration layering

Precedence: **engine defaults < user global assumptions < scenario overrides**. Every
effective value shows its provenance in the UI (NFR-005, FR-019).

| Preset                         | Rent growth | Home appreciation | r_alt | Maintenance |
| ------------------------------ | ----------- | ----------------- | ----- | ----------- |
| Conservative (stresses buying) | +2%         | 0%                | 3%    | 1.2%        |
| Base                           | +3%         | +1.5%             | 4.5%  | 1%          |
| Optimistic (favors buying)     | +5%         | +2.5%             | 5.5%  | 1%          |

Presets are data (JSON), user-editable, user-creatable. Sensitivity deltas, grey band,
warning thresholds, cost-catalog defaults, and formatting are all configuration.

---

## 10. Determinism and rounding policy (critique W8)

- Engine: pure functions, no clock, no randomness; same input object → deeply equal
  output (NFR-002, asserted by a determinism test).
- Arithmetic: IEEE-754 double precision, **no intermediate rounding**.
- Comparisons: absolute tolerances, each matched to its quantity's natural
  scale — money comparisons (break-evens, zero checks) use `MONEY_EPSILON`
  (1e-6 €, one shared constant); rate and band comparisons use
  `config.epsilon` (1e-9, configurable).
- Presentation only: `Intl.NumberFormat('it-IT', { currency: 'EUR' })`, 0 decimals by
  default (configurable). Percentages: 1 decimal. The engine never formats.

---

## 11. Business rules

BR-001 … BR-015 adopted verbatim from the source document, plus:

| ID     | Rule                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| BR-016 | Recoverable items (deposit) contribute opportunity cost only, never principal.                             |
| BR-017 | Lens A and Lens B outputs are never combined in a single figure.                                           |
| BR-018 | The quick-rule threshold is always derived, never a stored constant.                                       |
| BR-019 | Appreciation credit is always displayed whenever opportunity cost is displayed.                            |
| BR-020 | Sanity bounds on assumptions: rates and growths in [−10%, +15%]; violations warn (W-009) but do not block. |
| BR-021 | Every output figure carries a trace: formula id + resolved inputs (FR-019/NFR-001).                        |
| BR-022 | Verdict strength is capped at "indicative" when comparability is low.                                      |

---

## 12. Test vectors

Golden tests (exact) and property tests (invariants). TV-01/02/03 come from the source
document §16 and must pass byte-identically in Quick mode.

| ID    | Case                                                          | Expected                                                                                              |
| ----- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| TV-01 | §16.1 mortgage example, Quick mode (simplified interest, g=0) | buy year-1 cost = 8,800 €; rent = 15,000 €                                                            |
| TV-02 | §16.2 cash example                                            | year-1 cost = 12,000 €                                                                                |
| TV-03 | §16.3 quick-rule table                                        | ratios 7.5% / ≈5.0% / 2.26% / 4.0%; interpretations per derived R* with the doc's parameters          |
| TV-04 | Zero-rate mortgage                                            | payment = P/n, no division by zero                                                                    |
| TV-05 | Horizon 30y, duration 20y                                     | payment = 0 after month 240; costs continue (G7)                                                      |
| TV-06 | Negative appreciation −2%                                     | net worth declines; W-007 possible                                                                    |
| TV-07 | Determinism                                                   | simulate(x) deep-equals simulate(x)                                                                   |
| TV-08 | Exact vs simplified year-1 interest                           | exact < simplified; both traced with method label (W9)                                                |
| TV-09 | Cash drains liquidity below fund                              | W-004 + W-002 fire                                                                                    |
| TV-10 | Low comparability                                             | verdict capped, W-001 fires                                                                           |
| PT-01 | Amortization invariants (fast-check)                          | Σ principal = P; balance ↓ to 0; payment constant                                                     |
| PT-02 | Lens B budget symmetry                                        | with identical outflows and no one-time costs, wealth paths differ only by house-vs-portfolio returns |
| PT-03 | Monotonicity                                                  | higher rent growth never favors renting more                                                          |

---

## 13. Explicit exclusions (MVP)

Variable-rate mortgages (G9 — extension point designed), Italian rent-contract step
dynamics (G10 — extension point designed), refinancing, buy-to-let / exit-to-landlord
strategy, Monte-Carlo simulation, multi-currency, professional tax advice. Each exclusion
is stated in the UI where relevant (NFR-009 honesty).
