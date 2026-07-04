import { type Locale } from "./index";

/**
 * Field help & glossary content (both locales, typed exhaustively).
 * Each entry: what it is, why it matters (which outputs it drives), typical
 * Italian values, a common mistake, and the direction of its effect on the
 * buy-vs-rent verdict. Empty strings hide a section.
 */

export const HELP_GROUPS = {
  concepts: [
    "unrecoverableCost",
    "lenses",
    "derivedThreshold",
    "breakEvens",
    "basis",
    "opportunityCost",
    "fragilityIndex",
    "provenance",
  ],
  inputs: [
    "price",
    "equivalentRent",
    "currentRent",
    "horizon",
    "financingKind",
    "downPayment",
    "rateTAN",
    "durationYears",
    "comparability",
    "assumptionPreset",
    "cadastralValue",
    "sellingCostRate",
    "costCatalog",
  ],
  assumptions: [
    "alternativeReturn",
    "homeAppreciation",
    "rentGrowth",
    "inflation",
    "capitalGainsTax",
    "maintenanceRate",
    "recurringTaxRate",
  ],
  personal: ["liquidityCheck", "emergencyFund", "profileEnabled", "qualitative", "weights"],
} as const;

export type HelpTopicId = (typeof HELP_GROUPS)[keyof typeof HELP_GROUPS][number];

export interface HelpEntry {
  title: string;
  what: string;
  why: string;
  typical?: string;
  pitfall?: string;
  direction?: string;
}

const en: Record<HelpTopicId, HelpEntry> = {
  /* ---- concepts ---- */
  unrecoverableCost: {
    title: "Unrecoverable cost",
    what: "Money that leaves a scenario and never comes back as wealth or liquidity: rent, mortgage interest, maintenance, taxes, fees.",
    why: "It is the only fair unit for comparing renting and buying. The mortgage payment is NOT a cost: its principal portion becomes your wealth.",
    pitfall: "Comparing rent to the full mortgage payment overstates the cost of buying.",
  },
  lenses: {
    title: "The two lenses",
    what: "Cost lens: itemized unrecoverable costs per year. Wealth lens: a monthly simulation where renter and buyer share the same budget and the renter invests the capital the buyer locks into the house.",
    why: "They answer different questions (what do I burn? / who ends up richer?) and are never mixed — combining them would double-count the value of liquidity.",
  },
  derivedThreshold: {
    title: "Derived threshold R*",
    what: "The rent-to-price ratio above which buying deserves serious analysis. Computed from YOUR assumptions: maintenance + ownership taxes + blended cost of capital − home appreciation.",
    why: "The folklore “5% rule” bakes in North-American taxes. With Italian primary-residence taxes (≈0) and your own rates the honest threshold is usually lower.",
  },
  breakEvens: {
    title: "Break-even years",
    what: "Cost break-even: first year when cumulative buying costs drop below renting. Wealth break-even: first year when the buyer's net worth overtakes the renter's.",
    why: "They genuinely differ. If your horizon is shorter than the break-even, renting wins on that metric.",
  },
  basis: {
    title: "If sold vs. if held",
    what: "“If sold” (liquidation) includes selling costs and capital-gains effects at each year, as if you sold then. “If held” ignores them.",
    why: "Liquidation is the honest default: wealth locked in a house is only worth what a sale nets you.",
  },
  opportunityCost: {
    title: "Opportunity cost",
    what: "The return your capital would earn elsewhere (e.g. a diversified portfolio) while it sits in the down payment, purchase costs, and repaid principal.",
    why: "It is why paying cash is not free (the whole price is tied up), and it is always shown paired with the home-value gain so nothing is silently netted.",
  },
  fragilityIndex: {
    title: "Fragility index",
    what: "The share of one-at-a-time perturbations (rents ±1pp, rates ±1pp, horizon ±5y, …) that flip the verdict: Solid / Sensitive / Fragile.",
    why: "A verdict that flips when rent growth moves 1 point is an assumption, not a conclusion. Check the Sensitivity tab to see which variables do it.",
  },
  provenance: {
    title: "Assumption provenance",
    what: "Every assumption shows where its value comes from: engine default → your global layer → scenario override, with the most specific winning.",
    why: "So a result can always be traced back to who decided each number — and reset per field.",
  },

  /* ---- inputs ---- */
  price: {
    title: "Property price",
    what: "The agreed purchase price of the property you are evaluating.",
    why: "Drives the mortgage size, maintenance, ownership taxes, selling costs, and the rent-to-price ratio R of the quick rule.",
    typical: "Whatever the negotiation says — use the realistic closing price, not the listing.",
    direction: "Higher → favors renting (same rent buys less house).",
  },
  equivalentRent: {
    title: "Equivalent monthly rent",
    what: "The market rent of a home genuinely comparable to the one you would buy — same zone, size, and quality.",
    why: "It is the whole rent side of the comparison: both lenses and the quick ratio R depend on it more than on anything else.",
    typical:
      "Check listings for the same building/zone; in many Italian cities 3.5–6% of price per year.",
    pitfall: "Do not use your current rent unless your current home is truly comparable (FR-004).",
    direction: "Higher → favors buying.",
  },
  currentRent: {
    title: "Your current rent",
    what: "What you pay today. Informative only — it never enters the calculation.",
    why: "Useful context for how a purchase would change your monthly life, but comparing it to a better house's price is the classic apples-to-oranges error.",
  },
  horizon: {
    title: "Horizon",
    what: "How many years you realistically expect to keep the property (or the comparison alive).",
    why: "One-time purchase costs are spread over it; break-evens only matter if they fall inside it.",
    typical: "5 / 10 / 20 / 30 years. Under 3 years, one-time costs dominate (W-003).",
    direction: "Longer → favors buying (one-time costs amortize).",
  },
  financingKind: {
    title: "Mortgage or cash",
    what: "How the purchase is funded. Cash removes interest but ties up the whole price.",
    why: "Cash is not free (BR-014): the opportunity cost of the full capital replaces the bank's interest.",
    pitfall: "With decent alternative returns, cash can cost more than a cheap mortgage.",
  },
  downPayment: {
    title: "Down payment",
    what: "The capital you put in upfront; the rest becomes the mortgage principal.",
    why: "Sets the loan-to-value (LTV), the interest you'll pay, and the capital carrying opportunity cost from day one.",
    typical:
      "20% of price is the classic Italian benchmark; above 80% LTV lenders price higher (W-005).",
  },
  rateTAN: {
    title: "Rate (TAN)",
    what: "The nominal annual rate of the mortgage (TAN, not TAEG — bank fees go in the cost catalog).",
    why: "Drives interest, the single biggest unrecoverable cost of buying in the early years.",
    typical: "Fixed-rate mortgages in Italy: ~3–3.5% (2025).",
    direction: "Higher → favors renting.",
  },
  durationYears: {
    title: "Duration",
    what: "The mortgage length in years — independent from the horizon (BR-004).",
    why: "Longer duration lowers the payment but shifts the interest/principal mix toward interest.",
    typical: "20–30 years.",
  },
  comparability: {
    title: "Comparability",
    what: "How well the rent alternative matches the property being bought.",
    why: "Low comparability caps the verdict at “indicative” (BR-022) and raises W-001: the model can compute, but the comparison itself is shaky.",
    pitfall:
      "The most common way to fool yourself: comparing a small flat's rent to a bigger house's price.",
  },
  assumptionPreset: {
    title: "Assumptions preset",
    what: "A bundle of economic assumptions (rents, appreciation, returns, maintenance): conservative stresses buying, optimistic favors it.",
    why: "A quick way to test whether the verdict survives a pessimistic worldview. Every value stays editable.",
  },
  cadastralValue: {
    title: "Cadastral value",
    what: "The tax base for the registration tax on existing homes (valore catastale), usually far below market price.",
    why: "Determines the registration tax preset (2% primary residence, 9% otherwise).",
    typical: "Often 30–60% of market price; it is on the deed or the visura catastale.",
  },
  sellingCostRate: {
    title: "Selling costs",
    what: "Transaction costs of a hypothetical future sale, as % of the property value.",
    why: "Used by every “if sold” figure: they are why short-horizon buying rarely pays.",
    typical: "Agency ~3% + VAT ≈ 3.7%.",
    direction: "Higher → favors renting.",
  },
  costCatalog: {
    title: "Cost catalog",
    what: "One-time and recurring costs beyond maintenance/taxes: notary, agency, registration tax, deposit, renovation, condo fees…",
    why: "On horizons under ~10 years these often decide the outcome. Recoverable items (deposit, renovation share) are treated as capital, not cost (BR-016).",
    pitfall: "An empty catalog makes buying look cheaper than it is — add the Italian presets.",
  },

  /* ---- assumptions ---- */
  alternativeReturn: {
    title: "Alternative return (r_alt)",
    what: "The net annual return your capital would earn if NOT tied up in the house (e.g. a diversified portfolio, after costs).",
    why: "Powers the opportunity cost (cost lens) and the renter's portfolio (wealth lens) — it is what renting “earns”.",
    typical: "3–5% net for a balanced portfolio; use net-of-costs figures.",
    direction: "Higher → favors renting.",
  },
  homeAppreciation: {
    title: "Home appreciation (g)",
    what: "Expected yearly change of the property's market value. Can be negative.",
    why: "It is the house's own return: it offsets the opportunity cost and builds equity.",
    typical: "Italy has long stretches of 0–2% nominal; many areas saw declines.",
    direction: "Higher → favors buying.",
  },
  rentGrowth: {
    title: "Rent growth",
    what: "Expected yearly growth of the equivalent rent.",
    why: "Compounds against the renter every single year — one of the two most decisive assumptions (see the heatmap).",
    typical: "ISTAT-linked contracts: ~1–3%; hot markets more.",
    direction: "Higher → favors buying.",
  },
  inflation: {
    title: "Inflation",
    what: "Used only by the “real terms” view to deflate future euros into today's purchasing power.",
    why: "€100,000 in 30 years is not €100,000 today; nominal cumulative charts flatter whoever wins late.",
    typical: "ECB target: 2%.",
  },
  capitalGainsTax: {
    title: "Capital gains tax",
    what: "Tax applied to the portfolio's gains when liquidated (wealth lens).",
    why: "Reduces the renter's net wealth at sale time; the primary residence is usually exempt instead.",
    typical: "26% in Italy (12.5% on government bonds).",
    direction: "Higher → favors buying.",
  },
  maintenanceRate: {
    title: "Maintenance",
    what: "Routine upkeep as a yearly % of the property value (start-of-year).",
    why: "A permanent, often underestimated cost of owning; renters don't pay it.",
    typical: "~1%/year is the standard planning figure; older buildings more.",
    direction: "Higher → favors renting.",
  },
  recurringTaxRate: {
    title: "Ownership taxes",
    what: "Recurring property taxes as a yearly % of value (IMU and similar).",
    why: "This is where Italy differs from the “5% rule” countries: primary residences generally pay none.",
    typical: "0% primary residence; ~0.5–1% for second homes (IMU).",
    direction: "Higher → favors renting.",
  },

  /* ---- personal ---- */
  liquidityCheck: {
    title: "Liquidity check",
    what: "Compares your available savings against the initial outlay (down payment or full price, plus one-time costs).",
    why: "A purchase that is financially “right” but leaves you below your emergency fund is still a bad purchase (BR-006).",
  },
  emergencyFund: {
    title: "Emergency fund",
    what: "The minimum liquidity you refuse to go below after the purchase.",
    why: "The strong warnings W-002/W-004 fire when the purchase would breach it.",
    typical: "Commonly 6–12 months of expenses.",
  },
  profileEnabled: {
    title: "Use my profile",
    what: "Injects the savings and emergency fund from Profile & Assumptions into this scenario's simulation.",
    why: "Keeps affordability warnings personal without retyping the amounts per scenario.",
  },
  qualitative: {
    title: "Qualitative factors",
    what: "Stability, flexibility, space, schools, family, work: score how much buying THIS home would improve each for you (0–10, 5 = neutral).",
    why: "They are real but not euros. They form a separate preference index, shown beside — never summed with — the financial verdict (BR-015).",
  },
  weights: {
    title: "Factor weights",
    what: "How much each qualitative factor matters to you, 0 (irrelevant) to 10 (decisive). Set once in your profile.",
    why: "The preference index is the weighted average of your scenario scores; a weight of 0 removes a factor entirely.",
  },
};

const it: Record<HelpTopicId, HelpEntry> = {
  /* ---- concepts ---- */
  unrecoverableCost: {
    title: "Costo non recuperabile",
    what: "Denaro che esce da uno scenario e non torna né come patrimonio né come liquidità: affitto, interessi del mutuo, manutenzione, imposte, commissioni.",
    why: "È l'unica unità corretta per confrontare affitto e acquisto. La rata NON è un costo: la sua quota capitale diventa tuo patrimonio.",
    pitfall: "Confrontare l'affitto con l'intera rata sovrastima il costo dell'acquisto.",
  },
  lenses: {
    title: "Le due lenti",
    what: "Lente costi: costi non recuperabili voce per voce, anno per anno. Lente patrimonio: una simulazione mensile in cui inquilino e compratore hanno lo stesso budget e l'inquilino investe il capitale che il compratore blocca nella casa.",
    why: "Rispondono a domande diverse (quanto brucio? / chi finisce più ricco?) e non vengono mai mescolate — combinarle conterebbe due volte il valore della liquidità.",
  },
  derivedThreshold: {
    title: "Soglia derivata R*",
    what: "Il rapporto affitto/prezzo oltre il quale l'acquisto merita un'analisi seria. Calcolata dalle TUE assunzioni: manutenzione + imposte di possesso + costo del capitale − rivalutazione.",
    why: "La “regola del 5%” del folklore incorpora le tasse nordamericane. Con la prima casa italiana (imposte ≈0) e i tuoi tassi, la soglia onesta è di solito più bassa.",
  },
  breakEvens: {
    title: "Anni di break-even",
    what: "Break-even dei costi: il primo anno in cui i costi cumulati dell'acquisto scendono sotto quelli dell'affitto. Break-even patrimoniale: il primo anno in cui il patrimonio del compratore supera quello dell'inquilino.",
    why: "Sono davvero diversi. Se il tuo orizzonte è più corto del break-even, su quella metrica vince l'affitto.",
  },
  basis: {
    title: "Se vendo vs. se tengo",
    what: "“Se vendo” (liquidazione) include costi di vendita ed effetti fiscali in ogni anno, come se vendessi allora. “Se tengo” li ignora.",
    why: "La liquidazione è il default onesto: il patrimonio chiuso in una casa vale quanto una vendita ti mette in tasca.",
  },
  opportunityCost: {
    title: "Costo opportunità",
    what: "Il rendimento che il tuo capitale otterrebbe altrove (es. un portafoglio diversificato) mentre è fermo in anticipo, costi d'acquisto e capitale rimborsato.",
    why: "È il motivo per cui pagare in contanti non è gratis (l'intero prezzo resta immobilizzato), ed è sempre mostrato in coppia con la rivalutazione della casa, così nulla viene nettato di nascosto.",
  },
  fragilityIndex: {
    title: "Indice di fragilità",
    what: "La quota di perturbazioni una-alla-volta (affitti ±1pp, tassi ±1pp, orizzonte ±5 anni, …) che ribalta il verdetto: Solido / Sensibile / Fragile.",
    why: "Un verdetto che si ribalta quando la crescita degli affitti si muove di un punto è un'ipotesi, non una conclusione. Guarda la scheda Sensibilità per scoprire quali variabili lo fanno.",
  },
  provenance: {
    title: "Provenienza delle assunzioni",
    what: "Ogni assunzione mostra da dove viene il suo valore: default del motore → tuo layer globale → override di scenario, con il più specifico che vince.",
    why: "Così ogni risultato è riconducibile a chi ha deciso ciascun numero — e reversibile campo per campo.",
  },

  /* ---- inputs ---- */
  price: {
    title: "Prezzo dell'immobile",
    what: "Il prezzo d'acquisto concordato dell'immobile che stai valutando.",
    why: "Determina l'importo del mutuo, manutenzione, imposte di possesso, costi di vendita e il rapporto affitto/prezzo R della regola rapida.",
    typical:
      "Quello che dice la trattativa — usa il prezzo realistico di chiusura, non quello in annuncio.",
    direction: "Più alto → favorisce l'affitto (lo stesso affitto compra meno casa).",
  },
  equivalentRent: {
    title: "Affitto mensile equivalente",
    what: "L'affitto di mercato di una casa davvero comparabile a quella che compreresti — stessa zona, dimensione e qualità.",
    why: "È l'intero lato affitto del confronto: entrambe le lenti e il rapporto R dipendono da questo più che da ogni altra cosa.",
    typical:
      "Controlla gli annunci nella stessa zona/palazzo; in molte città italiane il 3,5–6% del prezzo all'anno.",
    pitfall: "Non usare il tuo affitto attuale se la casa in cui vivi non è davvero comparabile.",
    direction: "Più alto → favorisce l'acquisto.",
  },
  currentRent: {
    title: "Il tuo affitto attuale",
    what: "Quello che paghi oggi. Solo informativo — non entra mai nel calcolo.",
    why: "Utile per capire come l'acquisto cambierebbe la tua vita mensile, ma confrontarlo col prezzo di una casa migliore è il classico errore mele-con-pere.",
  },
  horizon: {
    title: "Orizzonte",
    what: "Quanti anni pensi realisticamente di tenere l'immobile (o di mantenere vivo il confronto).",
    why: "I costi una tantum si spalmano su di esso; i break-even contano solo se ci cadono dentro.",
    typical: "5 / 10 / 20 / 30 anni. Sotto i 3 anni i costi una tantum dominano.",
    direction: "Più lungo → favorisce l'acquisto (i costi una tantum si ammortizzano).",
  },
  financingKind: {
    title: "Mutuo o contanti",
    what: "Come si finanzia l'acquisto. I contanti eliminano gli interessi ma immobilizzano l'intero prezzo.",
    why: "Il contante non è gratis: il costo opportunità dell'intero capitale sostituisce gli interessi della banca.",
    pitfall:
      "Con rendimenti alternativi decenti, il contante può costare più di un mutuo economico.",
  },
  downPayment: {
    title: "Anticipo",
    what: "Il capitale che metti subito; il resto diventa il mutuo.",
    why: "Determina il loan-to-value (LTV), gli interessi che pagherai e il capitale che porta costo opportunità dal primo giorno.",
    typical:
      "Il 20% del prezzo è il riferimento classico italiano; sopra l'80% di LTV le banche applicano tassi più alti.",
  },
  rateTAN: {
    title: "Tasso (TAN)",
    what: "Il tasso annuo nominale del mutuo (TAN, non TAEG — le spese bancarie vanno nel catalogo costi).",
    why: "Determina gli interessi, il costo non recuperabile più grande dell'acquisto nei primi anni.",
    typical: "Mutui a tasso fisso in Italia: ~3–3,5% (2025).",
    direction: "Più alto → favorisce l'affitto.",
  },
  durationYears: {
    title: "Durata",
    what: "La durata del mutuo in anni — indipendente dall'orizzonte.",
    why: "Una durata maggiore abbassa la rata ma sposta il mix rata verso gli interessi.",
    typical: "20–30 anni.",
  },
  comparability: {
    title: "Comparabilità",
    what: "Quanto l'alternativa in affitto somiglia davvero all'immobile da comprare.",
    why: "Con comparabilità bassa il verdetto si ferma a “indicativo” e scatta l'avviso W-001: il modello calcola, ma il confronto stesso è traballante.",
    pitfall:
      "Il modo più comune di ingannarsi: confrontare l'affitto di un bilocale col prezzo di una casa più grande.",
  },
  assumptionPreset: {
    title: "Preset di assunzioni",
    what: "Un pacchetto di ipotesi economiche (affitti, rivalutazione, rendimenti, manutenzione): il conservativo stressa l'acquisto, l'ottimistico lo favorisce.",
    why: "Un modo rapido per verificare se il verdetto sopravvive a una visione pessimista. Ogni valore resta modificabile.",
  },
  cadastralValue: {
    title: "Valore catastale",
    what: "La base imponibile dell'imposta di registro sull'usato, di solito molto sotto il prezzo di mercato.",
    why: "Determina il preset dell'imposta di registro (2% prima casa, 9% altrimenti).",
    typical: "Spesso il 30–60% del prezzo; lo trovi sull'atto o sulla visura catastale.",
  },
  sellingCostRate: {
    title: "Costi di vendita",
    what: "I costi di transazione di un'ipotetica vendita futura, in % del valore dell'immobile.",
    why: "Usati da ogni cifra “se vendo”: sono il motivo per cui comprare su orizzonti brevi raramente conviene.",
    typical: "Agenzia ~3% + IVA ≈ 3,7%.",
    direction: "Più alti → favoriscono l'affitto.",
  },
  costCatalog: {
    title: "Catalogo costi",
    what: "Costi una tantum e ricorrenti oltre manutenzione/imposte: notaio, agenzia, imposta di registro, cauzione, ristrutturazione, condominio…",
    why: "Su orizzonti sotto i ~10 anni spesso decidono il risultato. Le voci recuperabili (cauzione, quota ristrutturazione) sono trattate come capitale, non costo.",
    pitfall:
      "Un catalogo vuoto fa sembrare l'acquisto più economico di quanto sia — aggiungi i preset italiani.",
  },

  /* ---- assumptions ---- */
  alternativeReturn: {
    title: "Rendimento alternativo (r_alt)",
    what: "Il rendimento annuo netto che il tuo capitale otterrebbe se NON fosse bloccato nella casa (es. un portafoglio diversificato, al netto dei costi).",
    why: "Alimenta il costo opportunità (lente costi) e il portafoglio dell'inquilino (lente patrimonio) — è ciò che l'affitto “guadagna”.",
    typical: "3–5% netto per un portafoglio bilanciato; usa valori al netto dei costi.",
    direction: "Più alto → favorisce l'affitto.",
  },
  homeAppreciation: {
    title: "Rivalutazione casa (g)",
    what: "La variazione annua attesa del valore di mercato dell'immobile. Può essere negativa.",
    why: "È il rendimento proprio della casa: compensa il costo opportunità e costruisce equity.",
    typical: "L'Italia ha lunghi periodi allo 0–2% nominale; molte zone hanno visto cali.",
    direction: "Più alta → favorisce l'acquisto.",
  },
  rentGrowth: {
    title: "Crescita affitti",
    what: "La crescita annua attesa dell'affitto equivalente.",
    why: "Si compone contro l'inquilino ogni singolo anno — una delle due assunzioni più decisive (guarda la heatmap).",
    typical: "Contratti indicizzati ISTAT: ~1–3%; mercati caldi di più.",
    direction: "Più alta → favorisce l'acquisto.",
  },
  inflation: {
    title: "Inflazione",
    what: "Usata solo dalla vista “termini reali” per riportare gli euro futuri al potere d'acquisto di oggi.",
    why: "100.000 € tra 30 anni non sono 100.000 € di oggi; i grafici cumulati nominali lusingano chi vince tardi.",
    typical: "Obiettivo BCE: 2%.",
  },
  capitalGainsTax: {
    title: "Tassazione capital gain",
    what: "L'imposta sui guadagni del portafoglio alla liquidazione (lente patrimonio).",
    why: "Riduce il patrimonio netto dell'inquilino al momento della vendita; la prima casa invece è di norma esente.",
    typical: "26% in Italia (12,5% sui titoli di Stato).",
    direction: "Più alta → favorisce l'acquisto.",
  },
  maintenanceRate: {
    title: "Manutenzione",
    what: "La manutenzione ordinaria come % annua del valore dell'immobile (a inizio anno).",
    why: "Un costo permanente e spesso sottostimato del possesso; l'inquilino non lo paga.",
    typical: "~1% all'anno è il valore standard di pianificazione; edifici datati di più.",
    direction: "Più alta → favorisce l'affitto.",
  },
  recurringTaxRate: {
    title: "Imposte di possesso",
    what: "Le imposte ricorrenti sull'immobile come % annua del valore (IMU e simili).",
    why: "È qui che l'Italia differisce dai paesi della “regola del 5%”: la prima casa generalmente non paga nulla.",
    typical: "0% prima casa; ~0,5–1% per le seconde case (IMU).",
    direction: "Più alte → favoriscono l'affitto.",
  },

  /* ---- personal ---- */
  liquidityCheck: {
    title: "Verifica liquidità",
    what: "Confronta i tuoi risparmi disponibili con l'esborso iniziale (anticipo o intero prezzo, più i costi una tantum).",
    why: "Un acquisto finanziariamente “giusto” che ti lascia sotto il fondo di emergenza resta un cattivo acquisto.",
  },
  emergencyFund: {
    title: "Fondo di emergenza",
    what: "La liquidità minima sotto cui rifiuti di scendere dopo l'acquisto.",
    why: "Gli avvisi forti W-002/W-004 scattano quando l'acquisto lo violerebbe.",
    typical: "Comunemente 6–12 mesi di spese.",
  },
  profileEnabled: {
    title: "Usa il mio profilo",
    what: "Inietta risparmi e fondo di emergenza da Profilo e assunzioni nella simulazione di questo scenario.",
    why: "Mantiene personali gli avvisi di sostenibilità senza riscrivere gli importi in ogni scenario.",
  },
  qualitative: {
    title: "Fattori qualitativi",
    what: "Stabilità, flessibilità, spazio, scuole, famiglia, lavoro: valuta quanto comprare QUESTA casa migliorerebbe ciascuno per te (0–10, 5 = neutro).",
    why: "Sono reali ma non sono euro. Formano un indice di preferenza separato, mostrato accanto — mai sommato — al verdetto finanziario.",
  },
  weights: {
    title: "Pesi dei fattori",
    what: "Quanto conta per te ciascun fattore qualitativo, da 0 (irrilevante) a 10 (decisivo). Si imposta una volta nel profilo.",
    why: "L'indice di preferenza è la media pesata dei punteggi dello scenario; un peso 0 esclude del tutto un fattore.",
  },
};

export const helpContent: Record<Locale, Record<HelpTopicId, HelpEntry>> = { en, it };
