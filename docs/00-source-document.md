> **Provenance** — This is the English translation of the original Italian domain
> document (`documento_progetto_app_dominio_immobiliare.md`, v1.0) that DomusScope was
> built from. It is preserved verbatim in structure and content as the project's source
> of truth for requirement IDs (FR-, NFR-, BR-, US-) referenced throughout the codebase.
> The formalized specification lives in [`02-domain-spec.md`](02-domain-spec.md).

> **Purpose** Turn the video transcript into an operational document to start
> implementing one's own application from. The document defines the domain,
> requirements, formulas, flows, backlog, and test cases; it does not choose
> frameworks, databases, cloud, languages, or libraries.

| Element           | Description                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Working name      | CasaDecisione / Rent-or-Buy Lab / Real-Estate Decision Engine                                                                                                                     |
| Goal              | Understand whether renting, buying with a mortgage, or buying a property cash is more convenient, distinguishing sunk costs, accumulated wealth, liquidity, and personal factors. |
| Guiding principle | Do not compare rent against the mortgage payment. Compare unrecoverable costs, tied-up capital, maintenance, market, and time horizon.                                            |
| Conceptual source | Transcript of the video uploaded by the user. Numbers in the transcript are examples or editable defaults, not fixed truths.                                                      |
| MVP ambition      | A personal lab to save real scenarios, compare properties, and understand which variables really change the decision.                                                             |

# Project document — Personal application for real-estate decisions

Version 1.0 — functional and domain document, with no technology-stack constraints.

# Operational index

1. Domain summary extracted from the transcript
2. Product vision
3. Problem to solve
4. Scope and out of scope
5. Domain glossary
6. Decision model
7. Conceptual data model
8. Input catalog
9. Formulas and calculation rules
10. Outputs and indicators
11. User experience and flows
12. Functional requirements
13. Non-functional requirements
14. Business rules and validations
15. Backlog by epics and user stories
16. Test cases and numeric scenarios
17. Personal presets and assumptions
18. Implementation roadmap
19. Checklist to get started
20. Risks, limits, and open questions

# 1. Domain summary extracted from the transcript

- **Central mistake:** directly comparing the mortgage payment and the rent. The
  mortgage payment contains an interest portion, which is a cost, and a principal
  portion, which becomes wealth.
- **Correct unit of comparison:** unrecoverable costs, i.e. what is paid and does not
  come back to the user either as liquidity or as wealth.
- **Renting:** the main unrecoverable cost is the rent paid. In a complete model one can
  add entry costs, moving costs, and tenant-specific expenses.
- **Buying with a mortgage:** the main unrecoverable costs are interest, opportunity
  cost of capital, maintenance, ancillary costs, and possible exit costs.
- **Buying cash:** removes interest but greatly increases the opportunity cost because
  the entire property price is tied up.
- **Three decisive variables:** time, the property-market trend, and the rental-market
  trend.
- **Practical 5% rule:** if the annual rent exceeds roughly 5% of the property value,
  buying tends to deserve serious analysis. For cash the conceptual threshold can
  approach 6%.
- **Psychological dimension:** stability and freedom/flexibility have real value and
  must be visible in the app, even when they cannot always be monetized.

> **Design interpretation** The app must behave like a decision lab: it must not just
> say "buy" or "rent", but explain which assumptions lead to the result and which
> variables make it change.

# 2. Product vision

The application must help the user answer a concrete question: "Is it better for me to
buy this house, keep renting, or buy it cash?". The answer must be numeric,
explainable, and customizable.

| Pillar            | Application meaning                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Transparency      | Every result must show formulas, assumptions, and included items.                                                           |
| Personalization   | The model must use personal data: liquidity, minimum fund, evaluated properties, equivalent rent, horizon, and preferences. |
| Comparison        | Compare buying with a mortgage, buying cash, renting, postponing, or evaluating alternative properties.                     |
| Time evolution    | Projection over 3, 5, 10, 20, or 30 years, not just the first year.                                                         |
| Informed decision | Separation between financial convenience and personal preference: stability, flexibility, space, family, work.              |
| Neutrality        | The app must not be ideological: "rent is wasted money" and "buying is always risky" are both slogans to avoid.             |

# 3. Problem to solve

- People compare only the mortgage payment and the rent, ignoring that the principal
  portion of the payment increases net worth.
- Real-estate purchases are often decided with slogans, not multi-year scenarios.
- The liquidity used for the down payment or a cash purchase has an opportunity cost.
- A house gives stability but reduces flexibility and can carry hidden costs.
- Rents and property prices do not grow at the same pace.
- Initial costs such as notary, agency, taxes, appraisal, arrangement fees, renovation,
  and furniture can completely change the convenience over short horizons.
- The comparison is often distorted because the current rent of a small home is
  compared with the purchase price of a bigger or better one.

# 4. Scope and out of scope

| Area              | In scope                                                                       | Out of scope                                           |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Rent/buy decision | Economic and qualitative comparison between comparable alternatives.           | Certain prediction of the future market.               |
| Mortgage          | Payment, interest, principal portion, outstanding debt, amortization schedule. | Bank advice or binding choice of the mortgage product. |
| Cash purchase     | Opportunity cost and liquidity impact.                                         | Personalized investment advice.                        |
| Property costs    | Maintenance, taxes, notary, agency, insurance, renovation, sale.               | Professional notarial/tax opinion.                     |
| Scenarios         | Saving, duplication, comparison, stress testing.                               | Public real-estate marketplace.                        |
| Technology stack  | No technical choice: domain and requirements only.                             | Frameworks, databases, hosting, libraries, cloud.      |

# 5. Domain glossary

| Term                | Operational definition                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Unrecoverable cost  | Expense that does not come back as wealth or liquidity: rent, interest, maintenance, opportunity cost, transaction costs. |
| Principal portion   | Part of the payment that reduces the outstanding debt and increases net worth.                                            |
| Interest portion    | Part of the payment paid to the bank as the cost of financing.                                                            |
| Opportunity cost    | The return given up by tying capital into the house instead of using it elsewhere.                                        |
| Tied-up capital     | Money locked into the property: down payment, repaid principal, cash purchase, non-recoverable renovation.                |
| Average maintenance | Expected annual cost to maintain the property. The transcript default is 1% of the home value.                            |
| Property value      | Estimated market value in a given year, adjusted by appreciation or depreciation.                                         |
| Equivalent rent     | Rent of a home genuinely comparable in area, size, and quality. Does not always coincide with the current rent.           |
| Cost break-even     | First period in which the cumulative unrecoverable costs of buying drop below those of renting.                           |
| Wealth break-even   | First period in which the net worth of the buy scenario exceeds that of the rent scenario.                                |
| Property net worth  | House value minus outstanding debt and estimated selling costs, if any.                                                   |
| Stability           | Practical/emotional value of not depending on the renewal of a lease.                                                     |
| Flexibility         | Value of being able to change home or city without selling/renting out an owned property.                                 |

# 6. Decision model

The model must have two modes: a quick one, useful for a first screening, and an
analytical one, useful when the user is genuinely evaluating an offer or a negotiation.

| Mode       | Use                          | Logic                                                                                     | Output                                                |
| ---------- | ---------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Quick      | Assessment in a few minutes. | 5% rule, year-1 unrecoverable costs, minimum liquidity.                                   | Indicative verdict and warnings.                      |
| Analytical | Real decision.               | Monthly/annual simulation of mortgage, rent, market, maintenance, capital, and liquidity. | Break-evens, net worth, sensitivity, and explanation. |

- **Question 1:** how much does the equivalent annual rent weigh against the house price?
- **Question 2:** how much capital must I tie up?
- **Question 3:** how much am I paying in interest and how much am I accumulating as principal?
- **Question 4:** how much does it cost to maintain the house?
- **Question 5:** for how many years do I realistically expect to live there?
- **Question 6:** what happens if rents, rates, or property values change?
- **Question 7:** do I remain liquid enough after the purchase?
- **Question 8:** how much are stability and flexibility worth to me?

# 7. Conceptual data model

The following entities are not technical tables: they are domain objects the app must
know about.

| Entity               | Responsibility                                                                  | Main attributes                                                           |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Decision profile     | Preferences, family situation, liquidity, minimum fund, stability, flexibility. | liquidity, emergency fund, current rent, horizon, city, notes.            |
| Scenario             | Container of one comparison.                                                    | title, description, status, date, assumptions, results.                   |
| Candidate property   | House the user is considering buying.                                           | price, area, square meters, condition, costs, renovation, notes, quality. |
| Rent alternative     | Equivalent home or current rent.                                                | rent, expected growth, entry costs, comparability.                        |
| Mortgage plan        | Hypothesized financing.                                                         | amount, LTV, rate, duration, payment, bank fees.                          |
| Cash plan            | Purchase without a mortgage.                                                    | capital used, residual liquidity, opportunity cost.                       |
| Economic assumptions | Global or per-scenario variables.                                               | alternative return, rent growth, appreciation, maintenance.               |
| Periodic projection  | Annual or monthly row of the simulation.                                        | rent, interest, principal, debt, house value, wealth.                     |
| Decision result      | Comparative summary.                                                            | verdict, reasons, break-evens, warnings, sensitivity.                     |
| Decision journal     | Qualitative memory of the choice.                                               | pros/cons, visits, doubts, final decision.                                |

# 8. Input catalog

| Input                  | Format          | Why it is needed                                                | Notes                                          |
| ---------------------- | --------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| Property price         | €               | Basis for purchase, maintenance, appreciation, and LTV.         | Required for buying.                           |
| Equivalent rent        | €/month         | Main cost of the rent scenario.                                 | Do not use the current rent if not comparable. |
| Current rent           | €/month         | Useful personal datum but not always comparable.                | May trigger a warning.                         |
| Horizon                | years/months    | Determines break-evens and convenience.                         | Typical: 3/5/10/20/30 years.                   |
| Down payment           | € or %          | Initial tied-up capital.                                        | Often 20% in the base model.                   |
| Mortgage amount        | €               | Initial debt.                                                   | Computable as price minus down payment.        |
| Mortgage rate          | % per year      | Determines interest and payment.                                | Editable parameter.                            |
| Mortgage duration      | years           | Determines payment and principal portion.                       | Independent of the horizon.                    |
| Alternative return     | % per year      | Opportunity cost.                                               | Transcript example default: 5%.                |
| Maintenance            | % of value/year | Ownership cost.                                                 | Transcript example default: 1%.                |
| Home appreciation      | % per year      | Updates the property value.                                     | Can be negative.                               |
| Rent growth            | % per year      | Updates the rent over time.                                     | Can be 0 or negative.                          |
| Purchase costs         | €               | Notary, agency, taxes, appraisal, arrangement fees, renovation. | Required in advanced mode.                     |
| Selling costs          | % or €          | Early exit.                                                     | Important on short horizons.                   |
| Available liquidity    | €               | Personal feasibility.                                           | Needed for warnings.                           |
| Minimum emergency fund | €               | Safety threshold.                                               | For personal use it can be a preset.           |
| Stability              | score           | Qualitative factor.                                             | Kept separate from the numbers.                |
| Flexibility            | score           | Qualitative factor.                                             | Important if a city/job change is possible.    |

> **Note for personal use** The app must always distinguish "current rent" from
> "equivalent rent". If today I pay little for a small home, that rent is not
> automatically the market price of the home I would like to buy.

# 9. Formulas and calculation rules

## 9.1 Quick 5% rule

`annual_rent = monthly_rent * 12`

`rent_to_price_ratio = annual_rent / property_price`

`mortgage_purchase_threshold ≈ 5%`

`cash_purchase_threshold ≈ 6%  # 5% opportunity cost + 1% maintenance`

| Condition  | Interpretation                                                                |
| ---------- | ----------------------------------------------------------------------------- |
| ratio > 5% | Rent is high relative to the price: buying is probably interesting.           |
| ratio ≈ 5% | Grey zone: full analysis needed.                                              |
| ratio < 5% | Rent relatively cheap; buying may still make sense for non-financial reasons. |
| cash       | Stricter threshold because more capital is tied up.                           |

## 9.2 Unrecoverable costs of renting

`rent_cost_year_t = monthly_rent_t * 12 + unrecoverable_tenant_costs_t`

`monthly_rent_t = monthly_rent_0 * (1 + rent_growth) ^ t`

`cumulative_rent_costs = sum(rent_cost_year_t)`

## 9.3 Unrecoverable costs of buying with a mortgage

`interest_year_t = sum(interest_month_m of year t)`

`maintenance_year_t = property_value_t * maintenance_rate`

`opportunity_cost_year_t = tied_up_capital_t * alternative_return`

`buy_cost_year_t = interest_year_t + maintenance_year_t + opportunity_cost_year_t + owner_costs_t`

`cumulative_buy_cost = purchase_costs + sum(buy_cost_year_t) + selling_costs_if_any`

## 9.4 Mortgage amortization

`monthly_rate = annual_rate / 12`

`number_of_payments = mortgage_duration_years * 12`

`payment = mortgage_amount * [i * (1+i)^n] / [(1+i)^n - 1]`

`monthly_interest = outstanding_debt_at_month_start * monthly_rate`

`monthly_principal = payment - monthly_interest`

`outstanding_debt_at_month_end = outstanding_debt_at_month_start - monthly_principal`

## 9.5 Net worth

`property_value_t = property_price * (1 + annual_appreciation) ^ t`

`property_net_worth_t = property_value_t - outstanding_debt_t`

`liquidation_wealth_t = property_value_t - outstanding_debt_t - estimated_selling_costs_t`

## 9.6 Full comparison

`cost_advantage_t = cumulative_rent_costs_t - cumulative_buy_costs_t`

`cost_break_even = first year in which cumulative_buy_costs <= cumulative_rent_costs`

`wealth_break_even = first year in which buy_wealth >= rent_wealth`

`decision_score = cost + wealth + liquidity + risk + stability + flexibility`

> **Correct comparison of the rent scenario** For a rigorous simulation, the rent
> scenario should be able to invest the down payment not used for buying and the
> monthly difference whenever rent costs less. This avoids underestimating the value
> of liquidity.

# 10. Outputs and indicators

| Output                        | Format                        | Use                                                                |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| Summary verdict               | Buy / Rent / Cash / Grey zone | Always with an explanation.                                        |
| Year-1 unrecoverable cost     | €                             | Replicates the transcript's core reasoning.                        |
| Cumulative unrecoverable cost | € per year                    | Shows recovery over time.                                          |
| Net worth                     | € per year                    | Shows house value minus debt.                                      |
| Outstanding debt              | €                             | Explains mortgage evolution.                                       |
| Total interest                | €                             | Cost of the bank.                                                  |
| Total principal               | €                             | Wealth accumulated through payments.                               |
| Opportunity cost              | €                             | Cost of tied-up capital.                                           |
| Residual liquidity            | €                             | Warning if below the minimum fund.                                 |
| Cost break-even               | year/month                    | When one choice overtakes the other on costs.                      |
| Wealth break-even             | year/month                    | When net worth becomes higher.                                     |
| Sensitivity                   | critical variables            | Rate, rents, appreciation, maintenance, horizon.                   |
| Warnings                      | text                          | Examples: "rent not comparable", "short horizon", "low liquidity". |

# 11. User experience and flows

## 11.1 MVP flow: quick comparison

1. Create a scenario and give it a name.
2. Enter property price, equivalent rent, and horizon.
3. Choose mortgage or cash.
4. Enter down payment, rate, duration, alternative return, maintenance.
5. Compute the rent-to-price ratio and year-1 unrecoverable costs.
6. Show a provisional verdict and warnings.

## 11.2 Advanced flow: real decision

1. Create a personal profile with liquidity and emergency fund.
2. Enter property data and ancillary costs.
3. Enter the rent alternative and the quality of comparability.
4. Configure mortgage or cash.
5. Configure conservative/base/optimistic assumptions.
6. Generate the annual projection.
7. Run stress tests.
8. Read the summary with pro/con reasoning.
9. Save notes in the decision journal.

## 11.3 Conceptual screens

| Screen             | Content                                            | Goal                            |
| ------------------ | -------------------------------------------------- | ------------------------------- |
| Scenario dashboard | Scenario list, verdict, last update.               | Resume evaluations.             |
| Personal profile   | Liquidity, fund, current rent, priorities.         | Set constraints.                |
| Candidate property | Price, costs, notes, photos/links, scores.         | Centralize house data.          |
| Equivalent rent    | Rent, growth, comparability.                       | Avoid distorted comparisons.    |
| Mortgage/Cash      | Amount, rate, duration, payment, opportunity cost. | Understand financing/liquidity. |
| Assumptions        | Maintenance, return, rent growth, appreciation.    | Make hypotheses explicit.       |
| Results            | KPIs, break-evens, explanation.                    | Decide.                         |
| Sensitivity        | Variation of assumptions.                          | Understand fragility.           |
| Journal            | Pros/cons, visits, doubts, decision.               | Personal memory.                |

# 12. Functional requirements

| ID     | Title                 | Description                                                          | Priority |
| ------ | --------------------- | -------------------------------------------------------------------- | -------- |
| FR-001 | Scenario management   | Create, rename, duplicate, archive, and delete scenarios.            | Must     |
| FR-002 | Personal profile      | Save liquidity, emergency fund, current rent, stability/flexibility. | Must     |
| FR-003 | Candidate property    | Enter price, costs, renovation, maintenance, area, and notes.        | Must     |
| FR-004 | Equivalent rent       | Distinguish current rent from a comparable one.                      | Must     |
| FR-005 | 5% rule               | Compute the rent-to-price ratio and its interpretation.              | Must     |
| FR-006 | Mortgage              | Compute payment, interest, principal, and outstanding debt.          | Must     |
| FR-007 | Cash                  | Compute opportunity cost and liquidity impact.                       | Must     |
| FR-008 | Unrecoverable costs   | Aggregate rent, interest, maintenance, capital, initial/final costs. | Must     |
| FR-009 | Projection            | Generate an annual projection over the chosen horizon.               | Must     |
| FR-010 | Break-even            | Identify the first period in which one choice overtakes the other.   | Must     |
| FR-011 | Sensitivity           | Vary assumptions and see the updated result.                         | Should   |
| FR-012 | Multiple scenarios    | Compare several properties and alternatives.                         | Should   |
| FR-013 | Verdict explanation   | Show reasons and warnings.                                           | Must     |
| FR-014 | Comparability warning | Warn if the current rent is not equivalent.                          | Must     |
| FR-015 | Liquidity warning     | Warn if buying drops below the emergency threshold.                  | Must     |
| FR-016 | Journal               | Save notes, pros/cons, doubts, and the final decision.               | Should   |
| FR-017 | Export                | Export a scenario summary.                                           | Could    |
| FR-018 | Presets               | Conservative/base/optimistic scenarios.                              | Should   |
| FR-019 | Formula audit         | Show formulas and included items.                                    | Must     |
| FR-020 | Versioning            | History of major changes to assumptions.                             | Could    |

# 13. Non-functional requirements

| ID      | Requirement        | Description                                            |
| ------- | ------------------ | ------------------------------------------------------ |
| NFR-001 | Explainability     | Every result must be traceable to inputs and formulas. |
| NFR-002 | Determinism        | Same inputs, same outputs.                             |
| NFR-003 | Precision          | Declared and consistent rounding.                      |
| NFR-004 | Privacy            | Financial data treated as sensitive.                   |
| NFR-005 | Parametrization    | No economic parameter hardcoded as truth.              |
| NFR-006 | Usability          | Quick mode fillable in a few minutes.                  |
| NFR-007 | Auditability       | Show when and why a result changed.                    |
| NFR-008 | Robustness         | Inconsistent inputs produce clear messages.            |
| NFR-009 | Neutrality         | No ideological preference for buying or renting.       |
| NFR-010 | Stack independence | Domain independent of the future technology.           |

# 14. Business rules and validations

| ID     | Rule                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| BR-001 | Property price greater than zero.                                             |
| BR-002 | Equivalent rent greater than zero to compare the rent scenario.               |
| BR-003 | Maximum LTV 100% unless an explicit special mode.                             |
| BR-004 | Mortgage duration and simulation horizon are independent.                     |
| BR-005 | A horizon under 3 years triggers a warning about initial costs.               |
| BR-006 | Liquidity below the minimum fund triggers a strong warning.                   |
| BR-007 | A non-comparable rent triggers a warning or a request for an equivalent rent. |
| BR-008 | The principal portion is not an unrecoverable cost.                           |
| BR-009 | Interest is always an unrecoverable cost.                                     |
| BR-010 | Maintenance can grow with the property value.                                 |
| BR-011 | Opportunity cost can be disabled only with a notice.                          |
| BR-012 | Rent growth and appreciation can be negative.                                 |
| BR-013 | One-time costs shown both separately and cumulatively.                        |
| BR-014 | Cash is not free: consider the opportunity cost.                              |
| BR-015 | Financial verdict kept distinct from personal preference.                     |

# 15. Backlog by epics and user stories

## EPIC-01 Domain foundations

### US-001: Create a comparison scenario

- Given a new scenario, when I enter a name and description, the scenario is saved as a draft.
- I can duplicate a scenario without losing the original.

### US-002: Distinguish current rent from equivalent rent

- The system shows a warning if I compare a bigger home against my current rent.
- The result states which rent was used.

## EPIC-02 Mortgage engine

### US-003: Compute payment, interest, and principal

- Given amount, rate, and duration, the system generates the payment and the amortization.
- For each period I see interest, principal, and outstanding debt.

### US-004: Show accumulated wealth

- The principal portion increases net worth.
- Interest does not increase wealth.

## EPIC-03 Unrecoverable costs

### US-005: Compare unrecoverable costs

- The system separates rent, interest, maintenance, opportunity cost, and initial costs.
- The system shows year 1 and the cumulative figure.

### US-006: Include ancillary costs

- I can enter notary, agency, taxes, appraisal, arrangement fees, renovation.
- Every cost has a category and an impact.

## EPIC-04 Time scenarios

### US-007: Simulate different horizons

- I can choose 5, 10, 20, 30 years.
- The system updates rents, house value, debt, and wealth.

### US-008: See break-evens

- The system shows the first year in which buying beats renting.
- If it never arrives, it says so.

## EPIC-05 Cash purchase

### US-009: Evaluate a purchase without a mortgage

- The system computes no interest.
- It computes the opportunity cost on the full capital.
- It shows residual liquidity.

## EPIC-06 Sensitivity and risk

### US-010: Understand critical assumptions

- The system shows the most sensitive variables.
- I can use conservative/base/optimistic scenarios.

### US-011: Simulate an early sale

- I can set a sale at year five or ten.
- The system includes the outstanding debt and selling costs.

## EPIC-07 Qualitative decision

### US-012: Record emotional and practical factors

- I can score stability, flexibility, space, school, family, work.
- The summary keeps numbers and personal preferences separate.

## EPIC-08 Report

### US-013: Export a decision summary

- The report contains inputs, assumptions, results, and notes.
- The report states that it is not financial advice.

# 16. Test cases and numeric scenarios

## 16.1 Transcript example — purchase with a mortgage

| Variable                             | Value                                                       |
| ------------------------------------ | ----------------------------------------------------------- |
| Property price                       | €200,000                                                    |
| Mortgage                             | €160,000                                                    |
| Down payment                         | €40,000                                                     |
| Equivalent rent                      | €1,250/month = €15,000/year                                 |
| Simplified year-1 interest           | 3% of €160,000 = €4,800                                     |
| Opportunity cost                     | 5% of €40,000 = €2,000                                      |
| Maintenance                          | 1% of €200,000 = €2,000                                     |
| Year-1 unrecoverable cost of buying  | 4,800 + 2,000 + 2,000 = €8,800                              |
| Year-1 unrecoverable cost of renting | €15,000                                                     |
| Expected output                      | Buying more favorable in year 1 under the simplified model. |

## 16.2 Transcript example — cash purchase

| Variable                  | Value                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| Cash price                | €200,000                                                          |
| Interest                  | €0                                                                |
| Opportunity cost          | 5% of €200,000 = €10,000                                          |
| Maintenance               | 1% of €200,000 = €2,000                                           |
| Year-1 unrecoverable cost | €12,000                                                           |
| Expected output           | Cash is not cost-free: the weight moves onto the tied-up capital. |

## 16.3 5% rule tests

| Price    | Monthly rent | Annual rent | Ratio | Expected output                              |
| -------- | ------------ | ----------- | ----- | -------------------------------------------- |
| €200,000 | €1,250       | €15,000     | 7.5%  | High rent, buying interesting.               |
| €200,000 | €833         | €9,996      | ≈5.0% | Grey zone.                                   |
| €250,000 | €470         | €5,640      | 2.26% | Low rent; check comparability.               |
| €300,000 | €1,000       | €12,000     | 4.0%  | Rent relatively cheap barring other factors. |

## 16.4 Edge cases

- Zero mortgage rate: avoid division by zero in the payment formula.
- Negative appreciation: net worth can fall.
- Zero rent growth: rent stays flat and buying can lose its advantage.
- Short horizon: initial costs dominate the outcome.
- Cash purchase that empties liquidity: strong warning.
- One-off extraordinary maintenance: support event costs beyond the average.
- Mortgage longer than the horizon: consider the outstanding debt at sale.
- Non-comparable rent: flag it or block the direct comparison.

# 17. Personal presets and assumptions

For personal use the app can offer editable presets. They must speed up scenario
creation, not replace the user's judgement.

| Preset                 | Suggested initial value                            | Reason                                                      |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Minimum emergency fund | €20,000                                            | Personal threshold not to end up too depleted after buying. |
| Preferred mortgage     | Fixed rate, configurable long duration             | Favors payment stability.                                   |
| Quick horizons         | 5 / 10 / 20 / 30 years                             | Cover short, medium, and long term.                         |
| Conservative scenario  | Rents +2%, home 0%, return 3%, maintenance 1.2%    | Stresses buying.                                            |
| Base scenario          | Rents +4%, home +1.5%, return 4–5%, maintenance 1% | Middle hypothesis.                                          |
| Aggressive scenario    | Rents +6%, home +2.5%, return 5–6%, maintenance 1% | Shows when buying becomes very strong.                      |
| Comparability          | Low / medium / high                                | Avoids comparing different homes.                           |

> **Note** Presets are hypotheses, not predictions. They must always be editable and
> visible.

# 18. Implementation roadmap

| Phase | Name                  | Content                                                           | Deliverable                              |
| ----- | --------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| 0     | Domain definition     | Confirm formulas, inputs, tests, and data dictionary.             | Validated document.                      |
| 1     | Quick MVP             | Scenario, price, rent, 5% rule, simplified mortgage/cash.         | First usable app.                        |
| 2     | Mortgage engine       | Monthly amortization, interest, principal, debt.                  | Reliable payment and wealth calculation. |
| 3     | Multi-year projection | Rent growth, appreciation, maintenance, opportunity, break-evens. | Decision over a horizon.                 |
| 4     | Costs and liquidity   | Notary, agency, taxes, renovation, emergency fund, sale.          | Realistic scenario.                      |
| 5     | Sensitivity           | Conservative/base/optimistic scenarios and early sale.            | Risk understanding.                      |
| 6     | Journal/export        | Notes, pros/cons, report.                                         | Complete personal tool.                  |

# 19. Checklist to get started

- [ ] Create the Scenario model.
- [ ] Add property price and equivalent rent.
- [ ] Implement the 5% rule.
- [ ] Compute year-1 unrecoverable costs of renting.
- [ ] Compute year-1 unrecoverable costs of buying with a mortgage.
- [ ] Compute the year-1 cash purchase.
- [ ] Implement the mortgage payment and amortization.
- [ ] Aggregate interest by year.
- [ ] Compute outstanding debt and net worth.
- [ ] Add rent growth and appreciation.
- [ ] Add percentage maintenance.
- [ ] Add a configurable opportunity cost.
- [ ] Add initial costs.
- [ ] Add liquidity and emergency fund.
- [ ] Create the annual results table.
- [ ] Create an explainable verdict.
- [ ] Add the transcript tests.
- [ ] Add the decision journal.

# 20. Risks, limits, and open questions

| Type     | Item                                        | Proposed handling                                           |
| -------- | ------------------------------------------- | ----------------------------------------------------------- |
| Risk     | False precision                             | Show scenarios and ranges, not just a single number.        |
| Risk     | Stale market data                           | Treat growth and appreciation as inputs.                    |
| Risk     | Non-equivalent comparison                   | Use comparability quality and warnings.                     |
| Risk     | Ignored initial costs                       | Make them required in advanced mode.                        |
| Risk     | Underestimated liquidity                    | Tie the verdict to the minimum emergency fund.              |
| Limit    | Complex taxation                            | Provide a simplified model and notes for professionals.     |
| Limit    | Emotional value                             | Keep the financial result and personal preference separate. |
| Question | Resell or rent out the house in the future? | Add an exit-strategy scenario.                              |
| Question | Average maintenance or one-off events?      | Support both.                                               |
| Question | Net or gross alternative return?            | Provide the field and a risk note.                          |

# 21. Blueprint of the first MVP

The first MVP must answer this question well: "I am evaluating this house. Given an
equivalent rent, a hypothetical mortgage, my liquidity, and some reasonable
assumptions, in how many years does buying become better than renting? And how fragile
is that conclusion?".

- **Minimum inputs:** house price, equivalent rent, down payment, mortgage, rate,
  duration, horizon, alternative return, maintenance, rent growth, home appreciation.
- **Minimum calculations:** 5% rule, payment, interest, principal, opportunity cost,
  maintenance, cumulative costs, net worth, break-evens.
- **Minimum outputs:** explained verdict, year-by-year table, warnings, buy/rent/cash
  comparison.
- **Useful differentiator:** do not stop at the math: add a personal journal to
  remember why a house looked good or risky.

# Appendix A — Concept traceability from the transcript

| Concept                   | Use in the project                                |
| ------------------------- | ------------------------------------------------- |
| Mortgage payment vs. rent | Separate the interest and principal portions.     |
| Unrecoverable costs       | Core of the comparison model.                     |
| Opportunity cost          | Tied-up capital as a real cost.                   |
| 1% maintenance            | Editable default.                                 |
| Three variables           | Time, property market, rental market.             |
| 5% rule                   | Quick mode.                                       |
| Cash purchase             | Separate scenario with a higher opportunity cost. |
| Stability/flexibility     | Qualitative dimension of the decision.            |
