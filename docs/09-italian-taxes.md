# DomusScope — Italian Taxes That Move the Verdict (Phase 11)

Phase 11 deepens the Italian fiscal model with the three effects most likely
to flip a real rent-vs-buy decision, all disclosed exclusions until now:
the **plusvalenza** on early non-primary sales (G15), the **detrazione
ristrutturazione** (G14), and **IMU on the cadastral base** (G13). One new
scenario input drives most of it: `property.primaryResidence`.

## Primary residence (G13)

`property.primaryResidence` (default **true**, so every pre-Phase-11 scenario
keeps its numbers) gates three behaviors at once:

| Effect | Primary | Non-primary |
| --- | --- | --- |
| Mortgage-interest deduction (19%, capped) | ✔ | ✘ (was previously always granted) |
| Plusvalenza on sale within 5 years | exempt | taxed |
| Purchase presets | registration 2%, no IMU | registration 9%, IMU item added |

The UI exposes it as a toggle in the Property section; the Italian-preset
button follows it when generating cost items.

## Plusvalenza on early sales (G15)

Configured in `EngineConfig.propertyCapitalGains` (`rate` 26%,
`withinYears` 5). For a **non-primary** property sold at the end of year
`t < 5`:

```
tax_t = rate × max(value_t − selling_costs_t − price, 0)
```

- Applied on the **liquidation basis only** — a hypothetical sale is exactly
  where the tax exists. The hold basis never carries it.
- Both lenses mirror it: the wealth lens subtracts it from
  `wealthBuyLiquidation` (and shows a traced composition line at the
  horizon), the cost lens adds it to `cumulativeBuyLiquidation` — the
  break-evens move together.
- The basis is the **price paid**, so a below-market purchase (FR-021)
  correctly shows a taxable paper gain if flipped early.
- Simplifications: purchase costs and documented works are not added to the
  cost basis, and the IRPEF-vs-26% choice is collapsed to the flat 26%
  imposta sostitutiva. Both understate the buyer slightly; documented in the
  help entry.

## Detrazione ristrutturazione (G14)

Configured in `EngineConfig.taxCredits.renovationDeduction` (`rate` 50%,
`cap` 96,000 €, `years` 10) with a feature toggle (`renovationDeduction`,
default on). Any **one-time, buy-side cost item** can be flagged
`renovationCredit: true` — the Italian renovation preset ships with it, and
the cost-item dialog exposes a checkbox:

```
credit_t = −rate × min(spend, cap) / years    for years t₀ … t₀+9
```

The credit appears as a negative cost-lens line (`buy.renovationCredit`)
and reduces the buyer's outflows in the wealth lens, symmetric with the
mortgage-interest deduction. Simplification: IRPEF capienza is assumed (the
credit is non-refundable in reality); the cap is applied per item.

## IMU on the cadastral base (G13)

A new cost-item base kind, `percentOfCadastral`, resolves against
`property.cadastralValue` (0 when unset — fill the cadastral value for it to
bite). Unlike the old `recurringTaxRate × market value` proxy, the base does
not grow with appreciation — matching how IMU actually behaves.

The second-home preset (`it-imu`) uses ≈1.15% of the registry cadastral
value: 0.86% average aliquota on the IMU base (rendita ×1.05×160), rescaled
from the registry base (rendita ×126). The note on the item spells this out;
edit the rate to your municipality, or switch the item to `fixedAnnual` if
you know your actual IMU.

`assumptions.recurringTaxRate` stays available as a generic market-value
proxy (default 0) for non-Italian users.

## Compatibility

- `primaryResidence` and `renovationCredit` are optional in storage and
  exports; absent means "primary" / "not eligible" — v1…v3 export files
  import unchanged, no Dexie version bump.
- All defaults preserve pre-Phase-11 outputs byte-exactly, except one
  deliberate correction: a scenario explicitly marked non-primary loses the
  interest deduction it should never have had.

## Still excluded (honest list)

- Cedolare secca on the rent side (tenant registration item notes it).
- IRPEF marginal-rate option for the plusvalenza; cost-basis add-backs.
- Ecobonus/sismabonus variants of the renovation credit (edit the config
  rate/cap to approximate them).
- Luxury-category (A/1, A/8, A/9) primary residences that owe IMU anyway.
