# DomusScope — Phase 8: Negotiation Lens

> Status: **implemented**. Extends
> [`02-domain-spec.md`](02-domain-spec.md) (requirement numbering continues from
> FR-020 / BR-022 / W-009) and the roadmap in [`05-roadmap.md`](05-roadmap.md).

## 1. Motivation

DomusScope already computes, without naming it, the buyer's **BATNA** (best
alternative to a negotiated agreement): the Wealth lens simulates exactly what
happens if you _don't_ buy — you keep renting and invest the capital. Phase 8
turns that implicit fact into explicit negotiation support:

1. **Reservation price** — the maximum price at which buying still beats your
   rent-and-invest alternative, _derived from your own assumptions_ (the
   negotiation twin of the derived threshold R\*, BR-018).
2. **Negotiation window (ZOPA view)** — where your reservation price sits
   relative to the asking price and the typical negotiated discount.
3. **Concession converter** — price-equivalents for non-price variables
   (early possession, furniture, remediation), so "enlarging the pie" becomes
   arithmetic instead of metaphor.
4. **Offer log** — offers and counter-offers recorded in the decision journal,
   each re-evaluated by the engine.

Out of scope, deliberately: negotiation _coaching_ (styles, body language,
rapport tactics). DomusScope reports numbers; it does not advise behavior
(product principle "Neutral", NFR-009).

## 2. Domain model

### 2.1 Market value vs. transaction price

Until now the engine conflated two concepts in `property.price`:

- **market value** `V` — what the home is worth; anchors the appreciation
  trajectory and every percent-of-value cost;
- **transaction price** `P` — what you pay; determines the initial outlay, the
  mortgage principal, and the debt curve.

Negotiation is precisely the act of moving `P` while `V` stays put. The schema
gains an optional `property.marketValue` (default: `price`), and the projection
context anchors the value curve to it:

```
value(t) = V · (1 + homeAppreciation)^t          (V = marketValue ?? price)
principal = P − downPayment                      (P = price, unchanged)
```

Buying below market value now correctly shows up as day-0 equity; paying above
market as an instant loss. This is useful on its own (bargain or overpriced
purchases) and is the foundation the solver needs.

### 2.2 Reservation price (FR-021)

**Definition.** The reservation price `P*` is the transaction price at which
the Wealth-lens advantage at the horizon (on the configured basis) is zero,
holding the market value and everything else fixed:

```
advantage(P*) = wealthBuy(P*) − wealthRent(P*) = 0
```

**Monotonicity.** With `V` anchored, `advantage(P)` is strictly decreasing in
`P`: every extra euro of price either raises the mortgage principal (more
interest, more debt at sale, higher payment → the renter invests more under
budget symmetry) or, for cash, directly enlarges the renter's starting
portfolio while the buyer holds the same house. There is therefore at most one
zero crossing, and bisection finds it deterministically.

**Indifference band.** The verdict has a grey zone (`wealthGreyBandFraction`).
The solver also reports the two prices where the verdict enters and leaves
`GREY_ZONE`:

- `clearBuyBelow` — below this price the verdict is a clear BUY;
- `clearRentAbove` — above this price the verdict is a clear RENT.

`P*` always lies between the two. The UI presents the band, not just the point:
an honest reservation price is a zone.

**Search domain.** `P ∈ [downPayment, 2·max(V, asking)]` for mortgages
(principal ≥ 0), `P ∈ [1, 2·max(V, asking)]` for cash. If the advantage does
not change sign in the domain, the solver returns `null` with a status:
`buyAlwaysWins` (even the top of the range favors buying) or `rentAlwaysWins`
(even the bottom favors renting — e.g. very short horizons where one-time
costs dominate, W-003 territory).

**Determinism (§10).** Fixed 50 bisection iterations (precision far below one
cent on any realistic domain), no tolerance-based early exit, no randomness.

### 2.3 Stressed reservation range (FR-021, continued)

A point estimate would be dishonest next to a sensitivity tab. The solver runs
twice more under a **joint stress** of the same deltas the OAT tornado uses
(±1 pp on rent growth, home appreciation, alternative return, mortgage rate;
±0.5 pp on maintenance):

- _pessimistic for buying_: rentGrowth −1pp, homeAppreciation −1pp,
  alternativeReturn +1pp, maintenanceRate +0.5pp, mortgageRate +1pp;
- _optimistic for buying_: the mirror image.

Result: `P*_pess ≤ P* ≤ P*_opt` — "your walk-away price is X, but under
pessimistic assumptions it drops to Y". The stress deltas are data
(a `NegotiationPlan`), not hardcoded truth, consistent with `SensitivityPlan`.

### 2.4 Negotiation window — ZOPA view (FR-022)

Inputs: asking price `A` (new user input, per scenario) and the **typical
negotiated discount** `d` (default **8.5%**, the average discount between
asking and closing prices reported by Banca d'Italia's housing-market survey;
editable like every assumption, shown with its provenance in the field help).

Derived:

```
expectedPrice     = A · (1 − d)
requiredDiscount  = 1 − P* / A        (null when P* is null)
```

Window classification (buyer-side; the seller's true reservation is unknowable,
so the app never claims to know the actual ZOPA — only where _your_ boundary
sits against the observable market anchors):

| Kind                    | Condition         | Reading                                               |
| ----------------------- | ----------------- | ----------------------------------------------------- |
| `askingAcceptable`      | `P* ≥ A`          | Even the asking price beats renting for you.          |
| `withinTypical`         | `A(1−d) ≤ P* < A` | A typical negotiation can reach your boundary.        |
| `needsAtypicalDiscount` | `P* < A(1−d)`     | You need a larger-than-typical discount (W-010).      |
| `none`                  | `P*` null (rent)  | No price in the searched range beats renting (W-010). |

**W-010** (new warning, severity `caution`): "Under your assumptions, the
price you can defend is below what a typical negotiation achieves from this
asking price." Context: `askingPrice`, `reservationPrice`, `requiredDiscount`,
`typicalDiscount`. Fires from the negotiation computation only; `simulate()` is
untouched.

### 2.5 Concession converter (FR-023)

A concession is worth, _to you_, its price-equivalent under your own numbers.
Receiving value shifts your indifference price up; giving value shifts it down:

```
adjustedReservation = P* + Σ amount(you receive) − Σ amount(you give)
```

Built-in equivalents (all editable, all traced to their formula):

| Kind              | Price-equivalent to the buyer                            |
| ----------------- | -------------------------------------------------------- |
| `earlyPossession` | months × equivalentMonthlyRent (rent you stop paying)    |
| `furniture`       | your estimate of the furniture you would otherwise buy   |
| `remediation`     | the quoted cost of the works you absorb (sign: you give) |
| `custom`          | free amount + label                                      |

This is Fisher & Ury's "enlarge the pie" made explicit: a fast closing that
costs you little may be worth thousands to a seller carrying two mortgages —
the converter tells you exactly how much price room a swap creates _for you_.

### 2.6 Offer log (FR-024)

Journal entries gain an `offer` kind carrying `{ party: you|counterpart,
price, note }`. The panel re-runs the engine at each offered price (cheap
run, no heatmap) and shows the verdict and advantage that price would produce —
the journal answers "how did the negotiation converge, and was each step
defensible?" alongside the existing decision/revision machinery (FR-016/FR-020).

## 3. Business rules

| ID     | Rule                                                                                                                                                                                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-023 | The reservation price is always derived, never stored (twin of BR-018); recomputed from current inputs.                                                                                                                                                                                                           |
| BR-024 | Negotiation outputs never feed back into the scenario verdict; the lens reads the simulation, not vice versa.                                                                                                                                                                                                     |
| BR-025 | Cost items are held as configured while the solver varies the price; the one known second-order drift (percent-of-price one-time fees such as agency commissions) is documented in the field help, not silently rescaled. Registration tax on the cadastral value is genuinely price-independent (prezzo-valore). |

## 4. Engine API (new module `packages/engine/src/negotiation`)

```ts
solveReservationPrice(input, config, plan?) → ReservationSolution
  // { price | null, status: solved|buyAlwaysWins|rentAlwaysWins, bounds, iterations }

runNegotiation(input, params, config, plan?) → NegotiationResult
  // reservation + indifference band + stressed range + window + warnings
  // params: { askingPrice, typicalDiscount = 0.085, concessions: Concession[] }

concessionAmount(kind, params) → number   // earlyPossession, furniture, remediation
adjustedReservationPrice(reservation, concessions) → number | null
```

All deterministic, no I/O, no rounding (presentation rounds, engine never).

## 5. UI

New **Negotiation** tab in the analytical workspace (after Sensitivity):

1. **Inputs card** — asking price, typical discount (ⓘ with the Banca d'Italia
   provenance), market value moved/exposed from the property section.
2. **Reservation card** — headline `P*` with the grey band and the stressed
   range ("solid between X and Y"); status messages for the null cases.
3. **ZOPA bar** — a horizontal price scale marking expected price, asking
   price, reservation price (with band + stress whiskers); windows colored by
   classification; W-010 rendered like every other warning.
4. **Concessions card** — editable rows (kind, direction, amount) and the
   adjusted reservation price.
5. **Journal** — offer entries with party, price, per-offer verdict chip.

Field help gains a `negotiation` topic group; the `/help` glossary grows the
same topics (reservation price, ZOPA/BATNA, typical discount, concessions,
market value vs. price, offer log). Both locales, as always (missing `it`
key = compile error).

## 6. Acceptance criteria

- [ ] `property.marketValue` anchors the value curve; default keeps every
      existing golden test byte-identical (pure refactor when unset).
- [ ] Property test: `advantage(P)` strictly decreasing in `P` (V anchored),
      mortgage and cash.
- [ ] Property test: `simulate({ price: P* })` yields `|advantage| < 1 €`
      whenever the solver reports `solved`.
- [ ] Golden test: reservation price for the source-document scenario.
- [ ] Solver null cases covered (`rentAlwaysWins` on a 1-year horizon with
      heavy one-time costs; `buyAlwaysWins` under extreme appreciation).
- [ ] W-010 fires exactly on `needsAtypicalDiscount` and `none`.
- [ ] Window classification table covered case by case.
- [ ] Concession equivalents: golden values + adjusted reservation sign logic.
- [ ] Offer journal entries persist, re-import via transfer round-trip, and
      render a verdict chip per offer.
- [ ] `pnpm check` green; Playwright smoke extended through the Negotiation tab.

## 7. Explicit exclusions

- Seller-side simulation (their carry costs, their BATNA) — the app models
  _your_ side; the counterpart's interests belong in journal notes.
- Automatic rescaling of one-time percent-of-price fees during the price sweep
  (BR-025; second-order, documented).
- Multi-round game-theoretic strategy, offer recommendations, or any "what
  should I bid" advice — the tool reports boundaries, the human negotiates.
