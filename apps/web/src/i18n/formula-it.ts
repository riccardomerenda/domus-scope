/**
 * Italian descriptions for the engine's formula registry, keyed by formulaId.
 * Expressions are math and stay universal; ids without a translation fall back
 * to the engine's English description.
 */
export const formulaDescriptionsIt: Record<string, string> = {
  "quick.threshold.derived":
    "Soglia derivata della regola rapida: manutenzione + imposte ricorrenti + costo del capitale ponderato − rivalutazione attesa. Il classico 5% emerge solo con le assunzioni che lo generano.",
  "quick.rent.year1": "Costo non recuperabile semplificato del primo anno per lo scenario affitto.",
  "quick.interest.simplified":
    "Anteprima semplificata degli interessi del primo anno. Il piano di ammortamento esatto dà un valore leggermente inferiore, perché il debito cala durante l'anno.",
  "quick.opportunity":
    "Costo opportunità lordo del capitale immobilizzato nell'acquisto. Sempre in coppia con il credito di rivalutazione.",
  "quick.maintenance": "Manutenzione ordinaria attesa per il primo anno.",
  "quick.recurringTax":
    "Imposte ricorrenti di possesso per il primo anno (es. IMU; 0 per la prima casa in Italia).",
  "quick.appreciationCredit":
    "Guadagno atteso di valore della casa nel primo anno, mostrato come riga negativa così il costo opportunità lordo non viene mai nettato di nascosto.",
  "cost.rent.year": "Affitto annuo per l'anno t; l'anno 1 è l'affitto equivalente di partenza.",
  "cost.interest.year":
    "Interessi esatti del mutuo dal piano di ammortamento (non l'anteprima semplificata).",
  "cost.maintenance.year": "Manutenzione ordinaria sul valore dell'immobile a inizio anno.",
  "cost.recurringTax.year":
    "Imposte ricorrenti di possesso sul valore dell'immobile a inizio anno.",
  "cost.recurringItem": "Una voce ricorrente del catalogo costi, risolta per l'anno t.",
  "cost.oneTimeItem":
    "Voce una tantum del catalogo: solo la quota non recuperabile è un costo; le quote recuperabili portano costo opportunità e tornano alla liquidazione.",
  "cost.deduction.year":
    "Detrazione fiscale sugli interessi del mutuo, un costo non recuperabile negativo.",
  "cost.renovationCredit.year":
    "Detrazione ristrutturazione: i lavori idonei restituiscono una quota della spesa (con tetto) in rate annuali IRPEF uguali.",
  "cost.opportunity.year":
    "Costo opportunità lordo del capitale immobilizzato: esborso iniziale + costi una tantum pagati + capitale rimborsato. Sempre in coppia con il credito di rivalutazione.",
  "cost.appreciationCredit.year":
    "Guadagno di valore della casa nell'anno t, mostrato esplicitamente così il costo opportunità lordo non viene mai nettato di nascosto.",
  "cost.depositOpportunity":
    "Costo opportunità del capitale recuperabile dell'inquilino (cauzione).",
  "wealth.homeValue": "Valore dell'immobile alla fine dell'anno t (lente patrimonio).",
  "wealth.debt": "Debito residuo del mutuo alla fine dell'anno t.",
  "wealth.sellingCosts": "Costi di transazione di un'ipotetica vendita (base liquidazione).",
  "wealth.recoveredCapital":
    "Capitale restituito alla liquidazione (valore trattenuto della ristrutturazione).",
  "wealth.portfolio":
    "Portafoglio a budget simmetrico: chi spende meno ogni mese investe la differenza. La tassazione sul capital gain si applica alla liquidazione.",
  "wealth.deposits": "Cauzioni restituite all'inquilino, a valore nominale.",
  "wealth.propertyGainsTax":
    "Plusvalenza: il guadagno su un immobile non prima casa venduto entro 5 anni dall'acquisto è tassato; prima casa e vendite successive sono esenti.",
};
