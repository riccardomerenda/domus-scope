> **Scopo** Trasformare il transcript del video in un documento operativo da cui partire per implementare una propria applicazione. Il documento definisce dominio, requisiti, formule, flussi, backlog e test case; non sceglie framework, database, cloud, linguaggi o librerie.

| Elemento | Descrizione |
| --- | --- |
| Nome provvisorio | CasaDecisione / Rent-or-Buy Lab / Immobiliare Decision Engine |
| Obiettivo | Capire se conviene affittare, comprare con mutuo o comprare cash un immobile, distinguendo costi persi, patrimonio accumulato, liquidità e fattori personali. |
| Principio guida | Non confrontare canone di affitto e rata del mutuo. Confrontare costi non recuperabili, capitale immobilizzato, manutenzione, mercato e orizzonte temporale. |
| Fonte concettuale | Transcript del video caricato dall’utente. I numeri presenti nel transcript sono esempi o default modificabili, non verità fisse. |
| Ambizione MVP | Un laboratorio personale per salvare scenari reali, confrontare immobili e capire quali variabili cambiano davvero la decisione. |

# Documento di progetto – Applicazione personale per decisioni immobiliari
Versione 1.0 – documento funzionale e di dominio, senza vincoli di stack tecnologico.

# Indice operativo

1. 1. Sintesi del dominio estratto dal transcript
1. 2. Visione prodotto
1. 3. Problema da risolvere
1. 4. Scope e fuori scope
1. 5. Glossario del dominio
1. 6. Modello decisionale
1. 7. Modello dati concettuale
1. 8. Catalogo input
1. 9. Formule e regole di calcolo
1. 10. Output e indicatori
1. 11. Esperienza utente e flussi
1. 12. Requisiti funzionali
1. 13. Requisiti non funzionali
1. 14. Regole di business e validazioni
1. 15. Backlog per epiche e user story
1. 16. Casi di test e scenari numerici
1. 17. Preset personali e assunzioni
1. 18. Roadmap di implementazione
1. 19. Checklist per partire
1. 20. Rischi, limiti e domande aperte

# 1. Sintesi del dominio estratto dal transcript

- **Errore centrale: **confrontare direttamente rata del mutuo e canone di affitto. La rata del mutuo contiene una quota interessi, che è costo, e una quota capitale, che diventa patrimonio.
- **Unità corretta di confronto: **i costi non recuperabili, cioè ciò che viene pagato e non torna all’utente né come liquidità né come patrimonio.
- **Affitto: **il costo non recuperabile principale è il canone pagato. In un modello completo si possono aggiungere costi d’ingresso, traslochi e spese specifiche dell’inquilino.
- **Acquisto con mutuo: **i costi non recuperabili principali sono interessi, costo opportunità del capitale, manutenzione, costi accessori e costi eventuali di uscita.
- **Acquisto cash: **elimina gli interessi ma aumenta molto il costo opportunità perché tutto il prezzo dell’immobile viene immobilizzato.
- **Tre variabili decisive: **tempo, andamento del mercato immobiliare e andamento del mercato degli affitti.
- **Regola pratica del 5%: **se l’affitto annuo è superiore a circa il 5% del valore dell’immobile, l’acquisto tende a meritare una forte analisi. Nel cash la soglia concettuale può avvicinarsi al 6%.
- **Dimensione psicologica: **stabilità e libertà/fessibilità hanno valore reale e devono essere visibili nell’app, anche se non sempre monetizzabili.

> **Interpretazione progettuale** L’app deve comportarsi come un laboratorio decisionale: non deve dire solo “compra” o “affitta”, ma spiegare quali ipotesi portano al risultato e quali variabili lo fanno cambiare.

# 2. Visione prodotto

L’applicazione deve aiutare l’utente a rispondere a una domanda concreta: “Mi conviene comprare questa casa, restare in affitto, oppure comprare cash?”. La risposta deve essere numerica, spiegabile e personalizzabile.

| Pilastro | Descrizione applicativa |
| --- | --- |
| Trasparenza | Ogni risultato deve mostrare formule, ipotesi e voci incluse. |
| Personalizzazione | Il modello deve usare dati personali: liquidità, fondo minimo, immobili valutati, affitto equivalente, orizzonte e preferenze. |
| Comparazione | Confronto fra comprare con mutuo, comprare cash, affittare, rimandare o valutare immobili alternativi. |
| Evoluzione temporale | Proiezione su 3, 5, 10, 20 o 30 anni, non solo sul primo anno. |
| Decisione consapevole | Separazione fra convenienza finanziaria e preferenza personale: stabilità, flessibilità, spazio, famiglia, lavoro. |
| Neutralità | L’app non deve essere ideologica: “l’affitto sono soldi buttati” e “comprare è sempre rischioso” sono entrambi slogan da evitare. |

# 3. Problema da risolvere

- Le persone confrontano solo rata del mutuo e affitto, ignorando che la quota capitale della rata aumenta il patrimonio netto.
- Gli acquisti immobiliari vengono spesso decisi con slogan, non con scenari multi-anno.
- La liquidità usata per anticipo o acquisto cash ha un costo opportunità.
- La casa dà stabilità, ma riduce flessibilità e può avere costi nascosti.
- Affitti e prezzi immobiliari non crescono allo stesso ritmo.
- I costi iniziali come notaio, agenzia, tasse, perizia, istruttoria, lavori e arredi possono cambiare completamente la convenienza su orizzonti brevi.
- Il confronto è spesso falsato perché si paragona l’affitto attuale di una casa piccola con il prezzo di acquisto di una casa più grande o migliore.

# 4. Scope e fuori scope

| Area | Dentro lo scope | Fuori scope |
| --- | --- | --- |
| Decisione affitto/acquisto | Confronto economico e qualitativo fra alternative comparabili. | Previsione certa del futuro mercato. |
| Mutuo | Rata, interessi, quota capitale, debito residuo, piano ammortamento. | Consulenza bancaria o scelta vincolante del prodotto di mutuo. |
| Cash purchase | Costo opportunità e impatto liquidità. | Consulenza d’investimento personalizzata. |
| Costi immobiliari | Manutenzione, tasse, notaio, agenzia, assicurazioni, lavori, vendita. | Parere notarile/fiscale professionale. |
| Scenari | Salvataggio, duplicazione, confronto, stress test. | Marketplace pubblico immobiliare. |
| Stack tecnologico | Nessuna scelta tecnica: solo dominio e requisiti. | Framework, database, hosting, librerie, cloud. |

# 5. Glossario del dominio

| Termine | Definizione operativa |
| --- | --- |
| Costo non recuperabile | Spesa che non torna come patrimonio o liquidità: affitto, interessi, manutenzione, costo opportunità, costi transazione. |
| Quota capitale | Parte della rata che riduce il debito residuo e aumenta il patrimonio netto. |
| Quota interessi | Parte della rata pagata alla banca come costo del finanziamento. |
| Costo opportunità | Rendimento a cui rinuncio immobilizzando capitale nella casa invece di usarlo altrove. |
| Capitale immobilizzato | Denaro bloccato nell’immobile: anticipo, capitale rimborsato, acquisto cash, lavori non recuperabili. |
| Manutenzione media | Costo annuo atteso per mantenere l’immobile. Nel transcript il default è 1% del valore casa. |
| Valore immobile | Valore di mercato stimato in un dato anno, modificato dalla rivalutazione o svalutazione. |
| Affitto equivalente | Canone di una casa davvero comparabile per zona, dimensione e qualità. Non sempre coincide con l’affitto attuale. |
| Break-even costi | Primo periodo in cui i costi non recuperabili cumulati dell’acquisto diventano inferiori a quelli dell’affitto. |
| Break-even patrimonio | Primo periodo in cui il patrimonio netto dello scenario acquisto supera quello dello scenario affitto. |
| Patrimonio netto immobiliare | Valore casa meno debito residuo ed eventuali costi stimati di vendita. |
| Stabilità | Valore pratico/emotivo di non dipendere dal rinnovo del contratto di locazione. |
| Flessibilità | Valore di poter cambiare casa o città senza vendere/affittare un immobile posseduto. |

# 6. Modello decisionale

Il modello deve avere due modalità: una rapida, utile per una prima scrematura, e una analitica, utile quando l’utente sta davvero valutando una proposta o una trattativa.

| Modalità | Uso | Logica | Output |
| --- | --- | --- | --- |
| Rapida | Valutazione in pochi minuti. | Regola del 5%, costi non recuperabili anno 1, liquidità minima. | Verdetto indicativo e warning. |
| Analitica | Decisione reale. | Simulazione mensile/annuale di mutuo, affitto, mercato, manutenzione, capitale e liquidità. | Break-even, patrimonio netto, sensibilità e spiegazione. |

- **Domanda 1: **l’affitto annuo equivalente quanto pesa rispetto al prezzo della casa?
- **Domanda 2: **quanto capitale devo immobilizzare?
- **Domanda 3: **quanto pago di interessi e quanto sto accumulando come quota capitale?
- **Domanda 4: **quanto costa mantenere la casa?
- **Domanda 5: **per quanti anni penso realisticamente di vivere lì?
- **Domanda 6: **cosa succede se affitti, tassi o valori immobiliari cambiano?
- **Domanda 7: **dopo l’acquisto rimango abbastanza liquido?
- **Domanda 8: **quanto valgono per me stabilità e flessibilità?

# 7. Modello dati concettuale

Le entità seguenti non sono tabelle tecniche: sono oggetti di dominio che l’app deve conoscere.

| Entità | Responsabilità | Attributi principali |
| --- | --- | --- |
| Profilo decisionale | Preferenze, situazione familiare, liquidità, fondo minimo, stabilità, flessibilità. | liquidità, fondo emergenza, affitto attuale, orizzonte, città, note. |
| Scenario | Contenitore di una comparazione. | titolo, descrizione, stato, data, ipotesi, risultati. |
| Immobile candidato | Casa che l’utente valuta di comprare. | prezzo, zona, metri, stato, costi, lavori, note, qualità. |
| Alternativa affitto | Casa equivalente o affitto attuale. | canone, crescita attesa, costi ingresso, comparabilità. |
| Piano mutuo | Finanziamento ipotizzato. | importo, LTV, tasso, durata, rata, costi bancari. |
| Piano cash | Acquisto senza mutuo. | capitale usato, liquidità residua, costo opportunità. |
| Assunzioni economiche | Variabili globali o per scenario. | rendimento alternativo, crescita affitti, rivalutazione, manutenzione. |
| Proiezione periodica | Riga annuale o mensile della simulazione. | affitto, interessi, capitale, debito, valore casa, patrimonio. |
| Risultato decisionale | Sintesi comparativa. | verdetto, motivazioni, break-even, warning, sensibilità. |
| Diario decisionale | Memoria qualitativa della scelta. | pro/contro, visite, dubbi, decisione finale. |

# 8. Catalogo input

| Input | Formato | Perché serve | Note |
| --- | --- | --- | --- |
| Prezzo immobile | € | Base di acquisto, manutenzione, rivalutazione e LTV. | Obbligatorio per acquisto. |
| Affitto equivalente | €/mese | Costo principale dello scenario affitto. | Non usare affitto attuale se non comparabile. |
| Affitto attuale | €/mese | Dato personale utile ma non sempre confrontabile. | Può generare warning. |
| Orizzonte | anni/mesi | Determina break-even e convenienza. | Tipico: 3/5/10/20/30 anni. |
| Anticipo | € o % | Capitale iniziale immobilizzato. | Spesso 20% nel modello base. |
| Importo mutuo | € | Debito iniziale. | Calcolabile da prezzo meno anticipo. |
| Tasso mutuo | % annuo | Determina interessi e rata. | Parametro modificabile. |
| Durata mutuo | anni | Determina rata e quota capitale. | Indipendente dall’orizzonte. |
| Rendimento alternativo | % annuo | Costo opportunità. | Default esempio transcript: 5%. |
| Manutenzione | % valore/anno | Costo possesso. | Default esempio transcript: 1%. |
| Rivalutazione casa | % annuo | Aggiorna valore immobile. | Può essere negativa. |
| Crescita affitti | % annuo | Aggiorna canone nel tempo. | Può essere 0 o negativa. |
| Costi acquisto | € | Notaio, agenzia, tasse, perizia, istruttoria, lavori. | Obbligatori in modalità avanzata. |
| Costi vendita | % o € | Uscita anticipata. | Importanti su orizzonti brevi. |
| Liquidità disponibile | € | Fattibilità personale. | Serve per warning. |
| Fondo emergenza minimo | € | Soglia di sicurezza. | Per uso personale può essere preset. |
| Stabilità | punteggio | Fattore qualitativo. | Separato dai numeri. |
| Flessibilità | punteggio | Fattore qualitativo. | Importante se si può cambiare città/lavoro. |

> **Nota per uso personale** L’app deve distinguere sempre “affitto attuale” da “affitto equivalente”. Se oggi pago poco per una casa piccola, quel canone non è automaticamente il prezzo di mercato della casa che vorrei comprare.

# 9. Formule e regole di calcolo

## 9.1 Regola rapida del 5%

`affitto_annuo = canone_mensile * 12`

`rapporto_affitto_prezzo = affitto_annuo / prezzo_immobile`

`soglia_acquisto_con_mutuo ≈ 5%`

`soglia_acquisto_cash ≈ 6%  # 5% costo opportunità + 1% manutenzione`

| Condizione | Interpretazione |
| --- | --- |
| rapporto > 5% | Affitto alto rispetto al prezzo: acquisto probabilmente interessante. |
| rapporto ≈ 5% | Zona grigia: serve analisi completa. |
| rapporto < 5% | Affitto relativamente conveniente; acquistare può avere senso per motivi non solo finanziari. |
| cash | Soglia più severa perché il capitale immobilizzato è maggiore. |

## 9.2 Costi non recuperabili affitto

`costo_affitto_anno_t = affitto_mensile_t * 12 + costi_inquilino_non_recuperabili_t`

`affitto_mensile_t = affitto_mensile_0 * (1 + crescita_affitti) ^ t`

`costi_affitto_cumulati = somma(costo_affitto_anno_t)`

## 9.3 Costi non recuperabili acquisto con mutuo

`interessi_anno_t = somma(interessi_mese_m dell’anno t)`

`manutenzione_anno_t = valore_immobile_t * percentuale_manutenzione`

`costo_opportunita_anno_t = capitale_immobilizzato_t * rendimento_alternativo`

`costo_buy_anno_t = interessi_anno_t + manutenzione_anno_t + costo_opportunita_anno_t + costi_proprietario_t`

`costo_buy_cumulato = costi_acquisto + somma(costo_buy_anno_t) + eventuali_costi_vendita`

## 9.4 Ammortamento del mutuo

`tasso_mensile = tasso_annuo / 12`

`numero_rate = durata_mutuo_anni * 12`

`rata = importo_mutuo * [i * (1+i)^n] / [(1+i)^n - 1]`

`interesse_mese = debito_residuo_inizio_mese * tasso_mensile`

`quota_capitale_mese = rata - interesse_mese`

`debito_residuo_fine_mese = debito_residuo_inizio_mese - quota_capitale_mese`

## 9.5 Patrimonio netto

`valore_immobile_t = prezzo_immobile * (1 + rivalutazione_annua) ^ t`

`patrimonio_netto_immobiliare_t = valore_immobile_t - debito_residuo_t`

`patrimonio_liquidabile_t = valore_immobile_t - debito_residuo_t - costi_vendita_stimati_t`

## 9.6 Confronto completo

`vantaggio_costi_t = costi_affitto_cumulati_t - costi_buy_cumulati_t`

`break_even_costi = primo anno in cui costi_buy_cumulati <= costi_affitto_cumulati`

`break_even_patrimonio = primo anno in cui patrimonio_buy >= patrimonio_rent`

`decision_score = costo + patrimonio + liquidità + rischio + stabilità + flessibilità`

> **Comparazione corretta dello scenario affitto** Per una simulazione rigorosa, lo scenario affitto dovrebbe poter investire l’anticipo non usato per comprare e l’eventuale differenza mensile se l’affitto costa meno. Questo evita di sottostimare il valore della liquidità.

# 10. Output e indicatori

| Output | Formato | Uso |
| --- | --- | --- |
| Verdetto sintetico | Compra / Affitta / Cash / Zona grigia | Sempre con spiegazione. |
| Costo non recuperabile anno 1 | € | Replica il ragionamento base del transcript. |
| Costo non recuperabile cumulato | € per anno | Mostra recupero nel tempo. |
| Patrimonio netto | € per anno | Mostra valore casa meno debito. |
| Debito residuo | € | Spiega evoluzione mutuo. |
| Interessi totali | € | Costo banca. |
| Quota capitale totale | € | Patrimonio accumulato tramite rate. |
| Costo opportunità | € | Costo del capitale immobilizzato. |
| Liquidità residua | € | Warning se sotto fondo minimo. |
| Break-even costi | anno/mese | Quando una scelta supera l’altra sui costi. |
| Break-even patrimonio | anno/mese | Quando il patrimonio netto diventa superiore. |
| Sensibilità | variabili critiche | Tasso, affitti, rivalutazione, manutenzione, orizzonte. |
| Warning | testo | Esempi: “affitto non comparabile”, “orizzonte breve”, “liquidità bassa”. |

# 11. Esperienza utente e flussi

## 11.1 Flusso MVP: confronto rapido

1. Creare scenario e assegnare un nome.
1. Inserire prezzo immobile, affitto equivalente e orizzonte.
1. Scegliere mutuo o cash.
1. Inserire anticipo, tasso, durata, rendimento alternativo, manutenzione.
1. Calcolare rapporto affitto/prezzo e costi non recuperabili anno 1.
1. Mostrare verdetto provvisorio e warning.

## 11.2 Flusso avanzato: decisione reale

1. Creare profilo personale con liquidità e fondo emergenza.
1. Inserire dati immobile e costi accessori.
1. Inserire alternativa affitto e qualità della comparabilità.
1. Configurare mutuo o cash.
1. Configurare assunzioni conservative/base/ottimistiche.
1. Generare proiezione annuale.
1. Eseguire stress test.
1. Leggere riepilogo con motivazioni pro/contro.
1. Salvare note nel diario decisionale.

## 11.3 Schermate concettuali

| Schermata | Contenuto | Obiettivo |
| --- | --- | --- |
| Dashboard scenari | Lista scenari, verdict, ultimo aggiornamento. | Riprendere valutazioni. |
| Profilo personale | Liquidità, fondo, affitto attuale, priorità. | Impostare vincoli. |
| Immobile candidato | Prezzo, costi, note, foto/link, punteggi. | Centralizzare dati casa. |
| Affitto equivalente | Canone, crescita, comparabilità. | Evitare confronti falsati. |
| Mutuo/Cash | Importo, tasso, durata, rata, costo opportunità. | Capire finanziamento/liquidità. |
| Assunzioni | Manutenzione, rendimento, crescita affitti, rivalutazione. | Rendere esplicite ipotesi. |
| Risultati | KPI, break-even, spiegazione. | Decidere. |
| Sensibilità | Variazione delle ipotesi. | Capire fragilità. |
| Diario | Pro/contro, visite, dubbi, decisione. | Memoria personale. |

# 12. Requisiti funzionali

| ID | Titolo | Descrizione | Priorità |
| --- | --- | --- | --- |
| FR-001 | Gestione scenari | Creare, rinominare, duplicare, archiviare ed eliminare scenari. | Must |
| FR-002 | Profilo personale | Salvare liquidità, fondo emergenza, affitto attuale, stabilità/flessibilità. | Must |
| FR-003 | Immobile candidato | Inserire prezzo, costi, lavori, manutenzione, zona e note. | Must |
| FR-004 | Affitto equivalente | Distinguere affitto attuale e canone comparabile. | Must |
| FR-005 | Regola 5% | Calcolare rapporto affitto/prezzo e interpretazione. | Must |
| FR-006 | Mutuo | Calcolare rata, interessi, quota capitale e debito residuo. | Must |
| FR-007 | Cash | Calcolare costo opportunità e impatto liquidità. | Must |
| FR-008 | Costi non recuperabili | Aggregare affitto, interessi, manutenzione, capitale, costi iniziali/finali. | Must |
| FR-009 | Proiezione | Generare proiezione annuale sull’orizzonte scelto. | Must |
| FR-010 | Break-even | Identificare primo periodo in cui una scelta supera l’altra. | Must |
| FR-011 | Sensibilità | Variare ipotesi e vedere risultato aggiornato. | Should |
| FR-012 | Scenari multipli | Confrontare più immobili e alternative. | Should |
| FR-013 | Spiegazione verdetto | Mostrare motivazioni e warning. | Must |
| FR-014 | Warning comparabilità | Avvisare se affitto attuale non è equivalente. | Must |
| FR-015 | Warning liquidità | Avvisare se acquisto porta sotto soglia emergenza. | Must |
| FR-016 | Diario | Salvare note, pro/contro, dubbi e decisione finale. | Should |
| FR-017 | Export | Esportare riepilogo scenario. | Could |
| FR-018 | Preset | Scenari conservativo/base/ottimistico. | Should |
| FR-019 | Audit formule | Mostrare formule e voci incluse. | Must |
| FR-020 | Versionamento | Storico modifiche principali alle ipotesi. | Could |

# 13. Requisiti non funzionali

| ID | Requisito | Descrizione |
| --- | --- | --- |
| NFR-001 | Spiegabilità | Ogni risultato deve essere riconducibile a input e formule. |
| NFR-002 | Determinismo | A parità di input, output identico. |
| NFR-003 | Precisione | Arrotondamenti dichiarati e coerenti. |
| NFR-004 | Privacy | Dati finanziari trattati come sensibili. |
| NFR-005 | Parametrizzazione | Nessun parametro economico hardcoded come verità. |
| NFR-006 | Usabilità | Modalità rapida compilabile in pochi minuti. |
| NFR-007 | Auditabilità | Mostrare quando e perché un risultato è cambiato. |
| NFR-008 | Robustezza | Input incoerenti producono messaggi chiari. |
| NFR-009 | Neutralità | Nessuna preferenza ideologica per comprare o affittare. |
| NFR-010 | Indipendenza stack | Dominio indipendente dalla futura tecnologia. |

# 14. Regole di business e validazioni

| ID | Regola |
| --- | --- |
| BR-001 | Prezzo immobile maggiore di zero. |
| BR-002 | Affitto equivalente maggiore di zero per confrontare lo scenario affitto. |
| BR-003 | LTV massimo 100% salvo modalità speciale esplicita. |
| BR-004 | Durata mutuo e orizzonte simulazione sono indipendenti. |
| BR-005 | Orizzonte sotto 3 anni genera warning su costi iniziali. |
| BR-006 | Liquidità sotto fondo minimo genera warning forte. |
| BR-007 | Affitto non comparabile genera warning o richiesta canone equivalente. |
| BR-008 | Quota capitale non è costo non recuperabile. |
| BR-009 | Interessi sempre costo non recuperabile. |
| BR-010 | Manutenzione può crescere con valore immobile. |
| BR-011 | Costo opportunità disattivabile solo con avviso. |
| BR-012 | Crescita affitti e rivalutazione possono essere negative. |
| BR-013 | Costi una tantum mostrati sia separati sia cumulati. |
| BR-014 | Cash non è gratis: considerare costo opportunità. |
| BR-015 | Verdetto finanziario distinto dalla preferenza personale. |

# 15. Backlog per epiche e user story

## EPIC-01 Fondamenta dominio

### US-001: Creare uno scenario di confronto
- Dato un nuovo scenario, quando inserisco nome e descrizione, allora lo scenario viene salvato in stato bozza.
- Posso duplicare uno scenario senza perdere l’originale.

### US-002: Distinguere affitto attuale e affitto equivalente
- Il sistema mostra warning se confronto una casa più grande con il mio affitto attuale.
- Il risultato indica quale canone è stato usato.

## EPIC-02 Motore mutuo

### US-003: Calcolare rata, interessi e quota capitale
- Dato importo, tasso e durata, il sistema genera rata e ammortamento.
- Per ogni periodo vedo interessi, capitale e debito residuo.

### US-004: Mostrare patrimonio accumulato
- La quota capitale aumenta il patrimonio netto.
- Gli interessi non aumentano patrimonio.

## EPIC-03 Costi non recuperabili

### US-005: Confrontare costi non recuperabili
- Il sistema separa affitto, interessi, manutenzione, costo opportunità e costi iniziali.
- Il sistema mostra anno 1 e cumulato.

### US-006: Includere costi accessori
- Posso inserire notaio, agenzia, tasse, perizia, istruttoria, lavori.
- Ogni costo ha categoria e impatto.

## EPIC-04 Scenari temporali

### US-007: Simulare orizzonti diversi
- Posso scegliere 5, 10, 20, 30 anni.
- Il sistema aggiorna affitti, valore casa, debito e patrimonio.

### US-008: Vedere break-even
- Il sistema indica il primo anno in cui comprare batte affittare.
- Se non arriva, lo dichiara.

## EPIC-05 Cash purchase

### US-009: Valutare acquisto senza mutuo
- Il sistema non calcola interessi.
- Calcola costo opportunità su capitale totale.
- Mostra liquidità residua.

## EPIC-06 Sensibilità e rischio

### US-010: Capire ipotesi critiche
- Il sistema mostra variabili più sensibili.
- Posso usare scenari conservativo/base/ottimistico.

### US-011: Simulare vendita anticipata
- Posso impostare vendita al quinto o decimo anno.
- Il sistema include debito residuo e costi vendita.

## EPIC-07 Decisione qualitativa

### US-012: Registrare fattori emotivi e pratici
- Posso assegnare punteggi a stabilità, flessibilità, spazio, scuola, famiglia, lavoro.
- Il riepilogo separa numeri e preferenze personali.

## EPIC-08 Report

### US-013: Esportare riepilogo decisionale
- Il report contiene input, ipotesi, risultati e note.
- Il report indica che non è consulenza finanziaria.

# 16. Casi di test e scenari numerici

## 16.1 Esempio transcript – acquisto con mutuo

| Variabile | Valore |
| --- | --- |
| Prezzo immobile | 200.000 € |
| Mutuo | 160.000 € |
| Anticipo | 40.000 € |
| Affitto equivalente | 1.250 €/mese = 15.000 €/anno |
| Interessi anno 1 semplificati | 3% su 160.000 € = 4.800 € |
| Costo opportunità | 5% su 40.000 € = 2.000 € |
| Manutenzione | 1% su 200.000 € = 2.000 € |
| Costo non recuperabile acquisto anno 1 | 4.800 + 2.000 + 2.000 = 8.800 € |
| Costo non recuperabile affitto anno 1 | 15.000 € |
| Output atteso | Acquisto più favorevole nell’anno 1 secondo modello semplificato. |

## 16.2 Esempio transcript – acquisto cash

| Variabile | Valore |
| --- | --- |
| Prezzo cash | 200.000 € |
| Interessi | 0 € |
| Costo opportunità | 5% su 200.000 € = 10.000 € |
| Manutenzione | 1% su 200.000 € = 2.000 € |
| Costo non recuperabile anno 1 | 12.000 € |
| Output atteso | Il cash non è privo di costo: il peso si sposta sul capitale immobilizzato. |

## 16.3 Test regola 5%

| Prezzo | Affitto mensile | Affitto annuo | Rapporto | Output atteso |
| --- | --- | --- | --- | --- |
| 200.000 € | 1.250 € | 15.000 € | 7,5% | Affitto alto, acquisto interessante. |
| 200.000 € | 833 € | 9.996 € | ≈5,0% | Zona grigia. |
| 250.000 € | 470 € | 5.640 € | 2,26% | Affitto basso; verificare comparabilità. |
| 300.000 € | 1.000 € | 12.000 € | 4,0% | Affitto relativamente conveniente salvo altri fattori. |

## 16.4 Casi limite

- Tasso mutuo zero: evitare divisione per zero nella formula rata.
- Rivalutazione negativa: patrimonio netto può calare.
- Crescita affitti zero: affitto resta stabile e acquisto può perdere vantaggio.
- Orizzonte breve: costi iniziali dominano il risultato.
- Cash che azzera liquidità: warning forte.
- Manutenzione straordinaria puntuale: supportare costi evento oltre alla media.
- Mutuo più lungo dell’orizzonte: considerare debito residuo alla vendita.
- Affitto non comparabile: segnalare o bloccare confronto diretto.

# 17. Preset personali e assunzioni

Per uso personale l’app può avere preset modificabili. Devono accelerare la creazione degli scenari, non sostituire il giudizio dell’utente.

| Preset | Valore iniziale suggerito | Motivo |
| --- | --- | --- |
| Fondo emergenza minimo | 20.000 € | Soglia personale per non restare troppo scarichi dopo acquisto. |
| Mutuo preferito | Fisso, durata lunga configurabile | Favorisce stabilità della rata. |
| Orizzonti rapidi | 5 / 10 / 20 / 30 anni | Coprono breve, medio e lungo periodo. |
| Scenario conservativo | Affitti +2%, casa 0%, rendimento 3%, manutenzione 1,2% | Stressa l’acquisto. |
| Scenario base | Affitti +4%, casa +1,5%, rendimento 4-5%, manutenzione 1% | Ipotesi intermedia. |
| Scenario aggressivo | Affitti +6%, casa +2,5%, rendimento 5-6%, manutenzione 1% | Mostra quando acquisto diventa molto forte. |
| Comparabilità | Bassa / media / alta | Evita confronti fra case diverse. |

> **Nota** I preset sono ipotesi, non previsioni. Devono essere sempre modificabili e visibili.

# 18. Roadmap di implementazione

| Fase | Nome | Contenuto | Deliverable |
| --- | --- | --- | --- |
| 0 | Definizione dominio | Confermare formule, input, test e dizionario dati. | Documento validato. |
| 1 | MVP rapido | Scenario, prezzo, affitto, regola 5%, mutuo/cash semplificati. | Prima app usabile. |
| 2 | Motore mutuo | Ammortamento mensile, interessi, capitale, debito. | Calcolo affidabile rata e patrimonio. |
| 3 | Proiezione multi-anno | Crescita affitti, rivalutazione, manutenzione, opportunità, break-even. | Decisione su orizzonte. |
| 4 | Costi e liquidità | Notaio, agenzia, tasse, lavori, fondo emergenza, vendita. | Scenario realistico. |
| 5 | Sensibilità | Scenari conservativo/base/ottimistico e vendita anticipata. | Comprensione rischio. |
| 6 | Diario/export | Note, pro/contro, report. | Strumento personale completo. |

# 19. Checklist per partire

- [ ] Creare modello Scenario.
- [ ] Aggiungere prezzo immobile e affitto equivalente.
- [ ] Implementare regola 5%.
- [ ] Calcolare costi non recuperabili affitto anno 1.
- [ ] Calcolare costi non recuperabili acquisto mutuo anno 1.
- [ ] Calcolare cash purchase anno 1.
- [ ] Implementare rata mutuo e ammortamento.
- [ ] Aggregare interessi per anno.
- [ ] Calcolare debito residuo e patrimonio netto.
- [ ] Aggiungere crescita affitti e rivalutazione.
- [ ] Aggiungere manutenzione percentuale.
- [ ] Aggiungere costo opportunità configurabile.
- [ ] Aggiungere costi iniziali.
- [ ] Aggiungere liquidità e fondo emergenza.
- [ ] Creare tabella risultati annuale.
- [ ] Creare verdetto spiegabile.
- [ ] Aggiungere test del transcript.
- [ ] Aggiungere diario decisionale.

# 20. Rischi, limiti e domande aperte

| Tipo | Voce | Gestione proposta |
| --- | --- | --- |
| Rischio | Falsa precisione | Mostrare scenari e range, non solo numero secco. |
| Rischio | Dati mercato non aggiornati | Trattare crescita e rivalutazione come input. |
| Rischio | Confronto non equivalente | Usare qualità comparabilità e warning. |
| Rischio | Costi iniziali ignorati | Renderli obbligatori in modalità avanzata. |
| Rischio | Liquidità sottovalutata | Vincolare verdetto al fondo emergenza minimo. |
| Limite | Fiscalità complessa | Gestire modello semplificato e note per professionisti. |
| Limite | Valore emotivo | Separare risultato finanziario e preferenza personale. |
| Domanda | Rivendere o affittare la casa in futuro? | Aggiungere scenario exit strategy. |
| Domanda | Manutenzione media o eventi puntuali? | Supportare entrambe. |
| Domanda | Rendimento alternativo netto o lordo? | Prevedere campo e nota rischio. |

# 21. Blueprint del primo MVP

Il primo MVP deve rispondere bene a questa domanda: “Sto valutando questa casa. Dato un affitto equivalente, un mutuo ipotetico, la mia liquidità e alcune assunzioni ragionevoli, fra quanti anni comprare diventa meglio di affittare? E quanto è fragile questa conclusione?”.

- **Input minimi: **prezzo casa, affitto equivalente, anticipo, mutuo, tasso, durata, orizzonte, rendimento alternativo, manutenzione, crescita affitti, rivalutazione casa.
- **Calcoli minimi: **regola 5%, rata, interessi, quota capitale, costo opportunità, manutenzione, costi cumulati, patrimonio netto, break-even.
- **Output minimi: **verdetto spiegato, tabella anno per anno, warning, confronto buy/rent/cash.
- **Differenziale utile: **non fermarsi al calcolo: aggiungere un diario personale per ricordare perché una casa sembrava buona o rischiosa.

# Appendice A – Tracciabilità concetti dal transcript

| Concetto | Uso nel progetto |
| --- | --- |
| Rata mutuo vs affitto | Separare quota interessi e quota capitale. |
| Costi non recuperabili | Core del modello di confronto. |
| Costo opportunità | Capitale immobilizzato come costo reale. |
| Manutenzione 1% | Default modificabile. |
| Tre variabili | Tempo, mercato immobiliare, mercato affitti. |
| Regola 5% | Modalità rapida. |
| Cash purchase | Scenario separato con costo opportunità maggiore. |
| Stabilità/fessibilità | Dimensione qualitativa della decisione. |
