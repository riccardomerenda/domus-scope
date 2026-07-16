# DomusScope — Variable Rates & Partial Early Repayments (Phase 10)

Phase 10 closes the biggest modeling gap for the Italian market: until now the
engine priced every mortgage at a single fixed rate, while for a
tasso-variabile borrower the *trajectory* of the rate — not its starting
level — decides the rent-vs-buy outcome. It also adds partial early
repayments (estinzioni anticipate parziali), routine in Italy where they are
penalty-free on primary residences (art. 40 TUB / Legge Bersani).

Both features live at the **amortization-schedule level**, so the cost lens,
the wealth lens, the negotiation lens, and sensitivity inherit them without
special cases: the schedule's monthly `payment`, `interest`, `principal`, and
`closingBalance` are already the single source both lenses consume.

## Rate paths (FR-025)

A mortgage carries an ordered list of **rate steps**:

```ts
rateSteps: [{ fromYear: 4, annualRate: 0.055 }]   // 3.4% → 5.5% from year 4
```

Semantics (`steppedRateFromYears` → `steppedRate`):

- `annualRate` is the year-1 rate; each step overrides it **from the first
  month of `fromYear`** onward. Empty list = fixed rate — pre-Phase-10 inputs
  are untouched.
- At every rate change the engine **re-amortizes the remaining balance over
  the remaining contractual months** at the new rate (the standard bank
  recalculation), producing a new French payment.
- Steps must have strictly increasing years within the contract duration
  (validated at the schema boundary, BR-level, and again in the constructor).
- Paths are **explicit, deterministic scenarios the user chooses** — data,
  never a stochastic forecast (NFR-002 determinism holds; same input, same
  schedule, always).

**W-011 (payment shock).** When a rate path pushes any regular payment above
the initial payment by more than `warningThresholds.paymentShock` (default
10%), the result carries warning W-011 with the initial payment, the peak
payment, and the month it occurs. Prepayment months are excluded from the
peak scan — their spike is a chosen extra payment, not a rate effect.

**Sensitivity.** The `mortgageRate ±1pp` perturbation shifts the **whole
path** (initial rate and every step), so a variable mortgage keeps its shape
under the tornado's rate bump.

## Partial early repayments (FR-026)

```ts
prepayments: [{ year: 5, amount: 15_000, mode: "reducePayment" }]
```

Conventions (`PrepaymentEvent` in the amortization input):

- The extra principal is paid **together with the last payment of `year`**
  (month `year × 12`). The schedule row for that month carries the true cash
  out — payment *and* extra principal — so the wealth lens sees a real
  outflow and budget symmetry lets the renter invest the same amount.
- `mode: "reducePayment"` re-amortizes the remaining balance over the
  remaining contractual months (the common Italian bank default): same end
  date, lower payment.
- `mode: "reduceDuration"` keeps the payment: the loan simply closes earlier;
  the schedule ends at payoff and later years show a closed mortgage (G7).
- Amounts beyond the open balance are **clamped**; events after payoff are
  ignored; several events may share a month.
- Structural invariants survive arbitrary paths and events (PT-05):
  Σ principal = loan, the balance never increases, the loan closes at exactly
  zero.

Economically the trade-off is honest on both sides: prepaying cuts future
interest (cost lens) but the capital stops earning the alternative return —
in the cost lens it joins the invested capital carrying opportunity cost, in
the wealth lens it leaves the buyer's cash flow in the event month.

## UI

The analytical **Financing** section gains two editors (mortgage only):

- **Rate path** — rows of *from year / new rate (TAN)*, with an ⓘ help topic
  (Euribor context, the 2022–2024 lesson, "scenario, not forecast").
- **Partial early repayments** — rows of *year / amount / afterwards
  (lower the payment | shorten the duration)*.

When a path or repayment is present and valid, a preview line shows the
**initial payment, the peak payment, and the payoff year** from the real
schedule. While an edit is mid-flight (out-of-order years, empty fields) the
preview pauses and an inline hint explains what to fix; the schema boundary
reports the same issue in Results.

Quick mode intentionally stays fixed-rate — path modeling is analytical-mode
depth (the quick lens is a labeled simplification, spec §2).

## Persistence & compatibility

- `AnalyticalData` gains optional `rateSteps` / `prepayments`; records and
  exports from before Phase 10 lack them and are read as `[]` — **no Dexie
  version bump, no export-format bump** (v1/v2/v3 files still import).
- Engine schemas default both arrays to `[]`, so every pre-existing golden
  vector and snapshot is byte-identical (verified: the full pre-Phase-10 test
  suite passes unchanged).

## Exclusions (unchanged honesty)

- **No stochastic model**: paths are user-chosen scenarios; there is no
  probability distribution over Euribor. (Candidate for a later phase.)
- **No Euribor + spread decomposition**: steps set the full TAN directly.
- **Refinancing/surroga** stays excluded (spec §13) — a rational-refinance
  model is a different feature from a contractual rate path.
- Rate steps and prepayments are yearly-grained; sub-year timing differences
  are below the tool's decision resolution.
