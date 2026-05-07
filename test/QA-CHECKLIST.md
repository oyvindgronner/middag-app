# QA-sjekkliste — Manuell test før hver release

Bruk denne sjekklisten til å verifisere at planlegger-funksjonaliteten på
[stormat.flott.org](https://stormat.flott.org) fungerer som forventet i UI.

## Forberedelser

- [ ] Last inn https://stormat.flott.org i en ny inkognito-fane (unngå caching)
- [ ] Åpne Chrome DevTools (Cmd+Opt+I) → Console-tab for å fange JS-feil
- [ ] Verifiser at `/health` returnerer `{"status":"ok"}` i Network-tab

## Kjernefunksjonalitet

- [ ] **Hjem laster:** Skjema vises med alle felter (dager, voksne, allergier, tilberedning, kosthold, liker spesielt, vil ikke ha)

- [ ] **Default-flyt:** 5 dager, 2 voksne, klikk "Lag vår ukesmeny →".
  - Forventet: 5 retter vises som kort
  - Forventet: Ingen kompromiss-banner
  - Forventet: Handleliste med totalpris vises under

- [ ] **Indisk-test (brukerens use case):** 1 dag, 2 voksne, skriv `indisk` i "Liker spesielt".
  - Forventet: 1 indisk-relatert rett (Kikertcurry / Palak paneer / Blomkål tikka masala / Kylling tikka masala)
  - Forventet: Gult banner over måltidskortet
  - Forventet banner-tekst: `Liker spesielt: Byttet ut én fisk-middag med en vegetarian-rett som matcher "indisk"`

## Filter-respekt

- [ ] **Hurtigfisk-test:** 5 dager, cookTime=15 min, difficulty=enkel, fishPerWeek=3.
  - Forventet: Alle viste retter har prepTime ≤ 15 min
  - Forventet: Hvis ikke nok retter passer, vises gult banner med `Antall middager totalt: …`

- [ ] **Avansert vegan:** 5 dager, veganPerWeek=2, difficulty=avansert, cookTime=60+.
  - Forventet: Får 2 vegan-retter (kan også få avansert kjøtt/fisk)
  - Forventet: Ingen kompromiss om vegan-pool er tom

- [ ] **Allergi-stress:** 7 dager, sjekk gluten + laktose, vegetarianPerWeek=4.
  - Forventet: Banner viser begrensninger (vegetarian-kompromiss eller days-kompromiss)
  - Forventet: Ingen returnerte retter har gluten/laktose i ingredienser

- [ ] **Fisk-allergi:** sjekk Fisk under allergier, fishPerWeek=3.
  - Forventet: 0 fiskeretter i resultatet
  - Forventet: Ingen kompromiss om fisk (allergi er hard regel)

## Preferanse-systemet

- [ ] **Søkeord finnes ikke:** "Liker spesielt" = `japansk`, 5 dager.
  - Forventet banner: `Ingen oppskrifter i databasen matcher "japansk". Prøv andre søkeord (f.eks. "indisk", "asiatisk", "italiensk").`

- [ ] **Søkeord finnes men passer ikke:** "Liker spesielt" = `thai`, cookTime=15, difficulty=enkel.
  - Forventet banner: `Vi har "thai"-retter, men ingen passer dine valg av tilberedningstid, vanskelighet eller allergier.`

- [ ] **"Vil ikke ha"-filter:** "Vil ikke ha" = `kikerter`, 7 dager.
  - Forventet: Ingen returnert rett har kikerter i navn, tags eller handleliste

## Visuell verifikasjon

- [ ] **Banner-styling:** Gul bakgrunn (#fffbeb), oransje border, ⚠️-ikon foran hvert punkt
- [ ] **Banner-plassering:** OVER måltidskortene, ikke under
- [ ] **Banner-tilstand:** Skjules helt når `compromises=null` (ingen melding vises)

## Mobilvisning

- [ ] **Smartphone-test:** Gjenta de 3 første test-scenariene på iPhone/Android.
  - Banner skal være lesbar uten horisontal scroll
  - Måltidskort skal stables vertikalt
  - Skjema skal være enkelt å fylle ut med touch

## Restart-flyt

- [ ] **Endre og lag ny plan:** Lag plan med "indisk", endre til "asiatisk", lag ny plan.
  - Forventet: Banner oppdateres riktig (eller forsvinner hvis ingen kompromiss)
  - Forventet: Måltidskort oppdateres med nye retter
  - Forventet: Handleliste oppdateres

## Regresjon-sjekk

- [ ] **Rating-system:** Klikk på en stjerne på en av rettene.
  - Forventet: Stjernen blir gul, "Du har gitt X stjerner" vises

- [ ] **Drag-and-drop:** Dra et måltidskort til en annen plass i listen.
  - Forventet: Rekkefølgen oppdateres

- [ ] **Tilbakemelding-knapp:** Klikk "💬 Tilbakemelding" → modal åpnes → fyll ut → submit.
  - Forventet: Modal lukkes med suksess-melding

## Oppsummering

| Kategori | Antall | OK | Feilet |
|---|---|---|---|
| Kjernefunksjonalitet | 3 | __ | __ |
| Filter-respekt | 4 | __ | __ |
| Preferanse-systemet | 3 | __ | __ |
| Visuell | 3 | __ | __ |
| Mobil | 1 | __ | __ |
| Restart | 1 | __ | __ |
| Regresjon | 3 | __ | __ |

Tester signert av: ____________________  Dato: ____________________
