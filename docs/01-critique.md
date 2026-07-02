# Critical Review of the Source Domain Document

Target: `documento_progetto_app_dominio_immobiliare.md` (v1.0, Italian).
This review validates the document's strongest points, identifies its weaknesses, and
lists what is missing. Every weakness and gap is paired with the resolution adopted in
[`02-domain-spec.md`](02-domain-spec.md).

**Overall verdict:** a solid, unusually mature domain document. The central framing
(unrecoverable costs, not payment-vs-rent) is correct and well developed, the numeric
examples check out arithmetically, and the non-functional requirements (explainability,
determinism, neutrality) are exactly right for this product. However, it mixes two
incompatible comparison methodologies without choosing one, imports a threshold ("5%
rule") calibrated for a different market, and leaves several Italy-specific cost and tax
items out of the model. All issues are fixable at the specification level — none
invalidates the product idea.

---

## 1. Validated strengths

**S1 — The core insight is correct and consistently applied.**
Separating the principal portion (wealth) from the interest portion (cost) of a mortgage
payment, and comparing _unrecoverable costs_ across scenarios, is the methodologically
sound way to frame rent-vs-buy. Business rules BR-008 ("principal is not an
unrecoverable cost") and BR-014 ("cash is not free") encode this correctly.

**S2 — The numeric examples are internally consistent.**
Section 16.1: 4,800 (interest) + 2,000 (opportunity cost) + 2,000 (maintenance) = 8,800 €
vs 15,000 € rent — verified. Section 16.2: 10,000 + 2,000 = 12,000 € — verified. These
make excellent golden test vectors.

**S3 — "Current rent" vs "equivalent rent" distinction.**
This is the most common real-world comparison error (comparing the rent of a small flat
you live in with the price of a bigger house you'd buy), and the document not only names
it but bakes it into requirements (FR-004, FR-014, BR-007) and warnings. Excellent.

**S4 — Two break-even definitions (costs and net worth).**
They genuinely diverge and answer different questions; keeping both is correct.

**S5 — Financial verdict separated from personal preference.**
Stability/flexibility are treated as first-class but _non-monetized_ factors (BR-015,
NFR-009). This prevents the tool from laundering feelings into fake euros — mostly (see
W4).

**S6 — Explainability and determinism as requirements.**
NFR-001/002/007 and FR-019 ("show formulas and included items") are rare in domain
documents and drive real architectural decisions (explanation traces, pure engine).

**S7 — Good edge-case awareness.**
Zero-rate mortgage (division by zero), negative appreciation, horizon shorter than
mortgage, cash draining liquidity — section 16.4 is a ready-made edge-case test list.

**S8 — Stack-agnostic by design.**
The document cleanly separates domain from technology, which makes the engine-as-pure-
package architecture natural.

---

## 2. Weaknesses

**W1 — Two incompatible methodologies coexist. (High severity)**
Section 9.3 computes an explicit _opportunity cost_ line item on immobilized capital
(cost-comparison framing). The note in section 9.6 then says a rigorous rent scenario
should _actually invest_ the unused down payment and monthly savings (cash-flow
simulation framing). These are two different models: if the rent scenario invests the
capital **and** the buy scenario is charged an opportunity-cost line item, the same
effect is counted twice; if neither is done, liquidity is undervalued. The document never
chooses.
_Resolution:_ the spec defines **two explicit lenses** — a Cost lens (opportunity cost as
a line item, no rent-side portfolio) and a Wealth lens (full cash-flow simulation with a
rent-side portfolio, no opportunity-cost line item). They are never mixed, and the UI
labels which lens each output comes from.

**W2 — Opportunity cost is charged gross of home appreciation. (High severity)**
Section 9.3 charges `invested_capital × alternative_return` as a cost, while home
appreciation only appears in the _net worth_ formulas (9.5). Within the cost lens this
biases the comparison: a house appreciating 3%/year and one appreciating 0%/year show
_identical_ unrecoverable costs, and `break_even_costi` becomes structurally pessimistic
for appreciating markets (the true opportunity cost of equity is the alternative return
_minus_ the return the equity earns inside the house). The document's own example only
works because it implicitly assumes 0% appreciation.
_Resolution:_ the Cost lens keeps the gross opportunity-cost line for transparency but
adds an explicit negative line item, the **appreciation credit** (−Δ home value), so the
net effect is `equity × (r_alt − g)` and all items remain visible and auditable.

**W3 — The "5% rule" threshold is a constant, not a derivation. (Medium-high)**
The 5% figure comes from a North-American derivation (≈1% property tax + 1% maintenance

- 3% cost of capital). In Italy, a primary residence typically pays **no IMU**, so the
  same logic yields ≈4–4.5% with the document's own default parameters — the imported
  constant is miscalibrated for its target market. The document makes the threshold
  _editable_ but not _derived_, which contradicts its own transparency pillar.
  _Resolution:_ the quick rule computes the threshold from the user's assumptions:
  `R* = maintenance% + recurring_tax% + LTV·i + (1−LTV)·r_alt − g`. With the document's
  example parameters this reproduces its own 4.4% year-1 cost rate exactly, and reproduces
  the classic 5% / 6% figures only under the assumptions that generate them.

**W4 — The decision score formula is dimensionally meaningless. (Medium)**
`decision_score = costo + patrimonio + liquidità + rischio + stabilità + flessibilità`
adds euros to subjective scores. This contradicts S5 and NFR-009.
_Resolution:_ the financial delta (euros, Wealth lens) is always the primary output;
qualitative factors live in a separate, clearly-labeled preference panel with
user-defined weights producing a normalized 0–100 _preference index_ that is never
summed with euros.

**W5 — Everything is nominal; inflation is absent. (Medium)**
Cumulative cost comparisons over 20–30 years in nominal terms overstate late-year values
and bias break-evens. There is no inflation input, no real-terms view, no discounting.
_Resolution:_ inflation is a first-class assumption; all cumulative outputs offer
nominal and real (inflation-deflated) views. NPV discounting is a later enhancement.

**W6 — Sensitivity analysis is required but unspecified. (Medium)**
FR-011 and section 10 ask for "sensitivity" without defining a method.
_Resolution:_ one-at-a-time perturbations with configurable deltas (tornado chart),
scenario presets (conservative/base/optimistic), a 2-D verdict heatmap
(rent growth × home appreciation), and a **fragility index** — the fraction of
perturbations that flip the verdict — directly answering the document's own question
"how fragile is this conclusion?".

**W7 — Break-even definitions ignore the stay-vs-sell distinction. (Medium)**
`break_even_costi` compares cumulative flows without saying whether selling costs are
included at each horizon. For short horizons this changes the answer materially.
_Resolution:_ each break-even is computed in two variants: **hold basis** (no sale) and
**liquidation basis** (sell at year _t_, including selling costs and residual debt). The
liquidation basis is the honest default.

**W8 — Rounding policy demanded but never defined. (Low)**
NFR-003 requires "declared and consistent rounding" yet no policy exists anywhere.
_Resolution:_ engine computes in double precision with no intermediate rounding;
comparisons use a relative epsilon; rounding happens only at presentation
(EUR, configurable decimals, it-IT formatting).

**W9 — Simplified vs exact interest never reconciled. (Low)**
Example 16.1 uses "simplified year-1 interest" (3% × 160,000 = 4,800 €), but with a real
monthly amortization schedule the year-1 interest is slightly lower (~4,750 €), because
the balance declines each month. If both modes exist, results will "mysteriously"
disagree.
_Resolution:_ Quick mode explicitly uses the simplified preview (and says so); Analytical
mode uses the exact schedule. Both are golden-tested, and the explanation trace names
which method produced each number.

---

## 3. Gaps — what is missing

**G1 — Italy-specific purchase taxes and fees.**
Registration tax (2% of cadastral value for primary residence, 9% otherwise; VAT
4%/10% for new builds), imposta sostitutiva on the mortgage (0.25% / 2%), notary fees for
both deed and mortgage, agency fee conventions (~3% + VAT on purchase; typically one
month's rent + VAT on rentals). The document says "notaio, agenzia, tasse" generically —
a personal Italian tool should ship these as **preset cost-catalog items** with editable
rates.

**G2 — Recurring ownership costs beyond maintenance.**
Condominium fees (owner share vs renter share differ), home insurance, quasi-mandatory
life/fire insurance on the mortgage, IMU for non-primary residences. All absent from the
input catalog.

**G3 — Renter-side cost catalog.**
Deposit (recoverable, but with opportunity cost), rental agency fee, contract
registration tax (split with landlord), moving costs. The document mentions
"costi_inquilino" once, with no catalog. Without these the comparison is structurally
pro-rent.

**G4 — Mortgage interest tax deduction.**
In Italy, 19% of interest up to 4,000 €/year is deductible for a primary residence — a
_negative_ unrecoverable cost, material in early years. Missing entirely.

**G5 — Tax treatment of the alternative investment.**
The document flags "net or gross return?" as an open question but doesn't decide. The
Wealth lens must apply a configurable capital-gains tax (default 26%) at liquidation;
the Cost lens documents that `r_alt` is expected net of costs/taxes.

**G6 — Persistence, privacy, and portability decisions.**
NFR-004 declares data "sensitive" but no storage model exists. For a personal tool the
right answer is local-first (no server, no telemetry) with schema-versioned export/import
— now an explicit architectural decision.

**G7 — Post-mortgage years and horizon > duration.**
Section 16.4 covers "mortgage longer than horizon" but not the reverse: after payoff the
payment drops to zero while maintenance and opportunity cost continue. Needs a formula
statement and a test vector.

**G8 — Comparability model is a label without consequences.**
"Low/medium/high comparability" exists as a preset but nothing defines what it _does_.
The spec ties it to warnings and to verdict confidence (low comparability caps verdict
strength at "indicative").

**G9 — Variable-rate mortgages.**
Only fixed-rate is modeled. Acceptable for the MVP, but must be an explicit, documented
exclusion with a designed extension point (rate schedule instead of scalar rate).

**G10 — Rent-contract dynamics.**
Italian contracts (4+4, ISTAT indexation, renewal jumps) differ from a smooth
`(1+growth)^t` curve. A growth-rate approximation is fine for MVP; a step-change model is
a designed extension.

**G11 — Sale-at-year-t advantage curve.**
The single most decision-relevant chart — "if I sold in year t, which scenario would have
won, net of all transaction costs?" — is implied by the break-even discussion but never
required. Added as a first-class output.

**G12 — Locale and formatting.**
EUR formatting, it-IT number conventions, and the UI language (English UI, Italian-market
amounts) need a stated decision. Decided: English UI, `Intl` it-IT currency formatting.

---

## 4. Conclusion

Adopt the document as the domain foundation. Apply corrections W1–W9, fill gaps G1–G12,
and freeze the result as the refined specification in
[`02-domain-spec.md`](02-domain-spec.md). The original FR/BR/NFR identifiers are kept and
extended there, so traceability to the source document is preserved.
