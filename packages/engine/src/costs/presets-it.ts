import { type CostItem } from "../schemas/cost-item";

/**
 * Italian cost presets (G1/G2/G3). These are *starting points*, not tax advice:
 * every rate lives in {@link italianDefaults} and every generated item is a
 * plain CostItem the user can edit, disable, or delete.
 */
export const italianDefaults = {
  vatRate: 0.22,
  /** Registration tax on existing homes: primary residence / other. */
  registrationTaxPrimary: 0.02,
  registrationTaxOther: 0.09,
  registrationTaxMinimum: 1_000,
  /** VAT on new builds sold by the developer (primary residence). */
  newBuildVat: 0.04,
  newBuildFixedTaxes: 600,
  /** Imposta sostitutiva on the mortgage: primary / other. */
  mortgageTaxPrimary: 0.0025,
  mortgageTaxOther: 0.02,
  buyerAgencyRate: 0.03,
  notaryDeedFee: 2_500,
  notaryMortgageFee: 1_500,
  bankUpfrontFees: 1_200,
  depositMonths: 3,
  rentAgencyMonths: 1,
  /** Tenant half of the 2%-of-annual-rent contract registration. */
  rentRegistrationAnnualShare: 0.01,
} as const;

export type PurchaseTaxRegime = "primaryExisting" | "otherExisting" | "newBuildPrimary";

export interface ItalianPurchaseParams {
  propertyPrice: number;
  /** Basis for registration tax on existing homes; falls back to price. */
  cadastralValue?: number;
  /** Omit for cash purchases: mortgage-related items are skipped. */
  mortgagePrincipal?: number;
  regime?: PurchaseTaxRegime;
  renovation?: {
    amount: number;
    /** Share embodied in the property and returned at sale (0..1). */
    valueRetention: number;
  };
  condoFeesAnnual?: number;
  homeInsuranceAnnual?: number;
}

function oneTimeBuy(id: string, label: string, amount: number, notes = ""): CostItem {
  return {
    id,
    label,
    scenario: "buy",
    timing: { kind: "oneTime", month: 0, amount },
    recoverability: { kind: "none" },
    sign: "cost",
    enabled: true,
    notes,
  };
}

export function italianPurchaseCostItems(params: ItalianPurchaseParams): CostItem[] {
  const d = italianDefaults;
  const regime = params.regime ?? "primaryExisting";
  const taxBase = params.cadastralValue ?? params.propertyPrice;
  const items: CostItem[] = [];

  if (regime === "newBuildPrimary") {
    items.push(
      oneTimeBuy(
        "it-vat-new-build",
        "VAT on new build (4%)",
        params.propertyPrice * d.newBuildVat + d.newBuildFixedTaxes,
        "4% VAT for a primary-residence new build, plus fixed registration taxes.",
      ),
    );
  } else {
    const rate = regime === "primaryExisting" ? d.registrationTaxPrimary : d.registrationTaxOther;
    items.push(
      oneTimeBuy(
        "it-registration-tax",
        "Registration tax",
        Math.max(taxBase * rate, d.registrationTaxMinimum),
        "On the cadastral value when available; 2% primary residence, 9% otherwise.",
      ),
    );
  }

  items.push(
    oneTimeBuy("it-notary-deed", "Notary — deed", d.notaryDeedFee),
    oneTimeBuy(
      "it-buyer-agency",
      "Buyer agency fee",
      params.propertyPrice * d.buyerAgencyRate * (1 + d.vatRate),
      "3% + VAT of the purchase price.",
    ),
  );

  if (params.mortgagePrincipal !== undefined && params.mortgagePrincipal > 0) {
    const mortgageTaxRate = regime === "otherExisting" ? d.mortgageTaxOther : d.mortgageTaxPrimary;
    items.push(
      oneTimeBuy("it-notary-mortgage", "Notary — mortgage deed", d.notaryMortgageFee),
      oneTimeBuy(
        "it-mortgage-tax",
        "Imposta sostitutiva",
        params.mortgagePrincipal * mortgageTaxRate,
        "0.25% of the mortgage for a primary residence; 2% otherwise.",
      ),
      oneTimeBuy("it-bank-fees", "Bank fees (istruttoria, perizia)", d.bankUpfrontFees),
    );
  }

  if (params.renovation) {
    items.push({
      id: "it-renovation",
      label: "Renovation",
      scenario: "buy",
      timing: { kind: "oneTime", month: 0, amount: params.renovation.amount },
      recoverability: { kind: "partial", share: params.renovation.valueRetention },
      sign: "cost",
      enabled: true,
      notes: "The retained share is treated as extra sale proceeds (flat, no appreciation).",
    });
  }
  if (params.condoFeesAnnual !== undefined && params.condoFeesAnnual > 0) {
    items.push({
      id: "it-condo-fees",
      label: "Condominium fees (owner share)",
      scenario: "buy",
      timing: {
        kind: "recurring",
        base: { kind: "fixedAnnual", amount: params.condoFeesAnnual },
        growth: { kind: "rate", rate: 0.02 },
      },
      recoverability: { kind: "none" },
      sign: "cost",
      enabled: true,
      notes: "",
    });
  }
  if (params.homeInsuranceAnnual !== undefined && params.homeInsuranceAnnual > 0) {
    items.push({
      id: "it-home-insurance",
      label: "Home + mortgage life insurance",
      scenario: "buy",
      timing: {
        kind: "recurring",
        base: { kind: "fixedAnnual", amount: params.homeInsuranceAnnual },
        growth: { kind: "rate", rate: 0 },
      },
      recoverability: { kind: "none" },
      sign: "cost",
      enabled: true,
      notes: "Quasi-mandatory with Italian mortgages.",
    });
  }

  return items;
}

export interface ItalianRentParams {
  monthlyRent: number;
  depositMonths?: number;
  agencyFeeMonths?: number;
  movingCost?: number;
}

export function italianRentCostItems(params: ItalianRentParams): CostItem[] {
  const d = italianDefaults;
  const items: CostItem[] = [
    {
      id: "it-rent-deposit",
      label: "Security deposit",
      scenario: "rent",
      timing: {
        kind: "oneTime",
        month: 0,
        amount: params.monthlyRent * (params.depositMonths ?? d.depositMonths),
      },
      recoverability: { kind: "full" },
      sign: "cost",
      enabled: true,
      notes: "Returned at the end of the lease; only its opportunity cost counts (BR-016).",
    },
    {
      id: "it-rent-agency",
      label: "Rental agency fee",
      scenario: "rent",
      timing: {
        kind: "oneTime",
        month: 0,
        amount:
          params.monthlyRent * (params.agencyFeeMonths ?? d.rentAgencyMonths) * (1 + d.vatRate),
      },
      recoverability: { kind: "none" },
      sign: "cost",
      enabled: true,
      notes: "Typically one month's rent + VAT.",
    },
    {
      id: "it-rent-registration",
      label: "Contract registration (tenant half)",
      scenario: "rent",
      timing: {
        kind: "recurring",
        base: { kind: "percentOfRent", rate: d.rentRegistrationAnnualShare },
        growth: { kind: "tracksRent" },
      },
      recoverability: { kind: "none" },
      sign: "cost",
      enabled: true,
      notes: "Half of the 2% annual registration tax, unless cedolare secca applies.",
    },
  ];
  if (params.movingCost !== undefined && params.movingCost > 0) {
    items.push({
      id: "it-moving",
      label: "Moving costs",
      scenario: "rent",
      timing: { kind: "oneTime", month: 0, amount: params.movingCost },
      recoverability: { kind: "none" },
      sign: "cost",
      enabled: true,
      notes: "",
    });
  }
  return items;
}
