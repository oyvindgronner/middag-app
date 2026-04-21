# Prompt til Claude Code: Generer manglende oppskrifter

Lim inn denne teksten direkte i Claude Code når du står i mappen `~/Developer/Middagsappen`.

---

## OPPGAVE

Vi bygger oppskriftsdatabasen for **stormat.flott.org** – en norsk middagsplanlegger.
Du skal fylle opp alle fire kategorier med ekte, gjennomtenkte middagsoppskrifter.

**Nåværende status:**

| Kategori | Har | Mål | Mangler | Fil |
|---|---|---|---|---|
| Kjøtt | 12 | 40 | **28** | `meals/meals-meat.js` |
| Fisk | 10 | 20 | **10** | `meals/meals-fish.js` |
| Vegetar | 7 | 28 | **21** | `meals/meals-vegetarian.js` |
| Vegan | 0 | 12 | **12** | `meals/meals-vegetarian.js` |

Jobb én kategori av gangen. Start med kjøtt, deretter fisk, vegetar, vegan.
**Ikke stopp etter 5 eller 10 – fullfør hele kategorien.**

---

## DATSTRUKTUR

Alle oppskrifter følger dette formatet (ikke avvik fra det):

```js
{
  id: 'unik-slug',              // kebab-case norsk, unik på tvers av alle filer
  name: 'Navn på retten',       // norsk navn
  type: 'meat',                 // 'meat' | 'fish' | 'vegetarian' | 'vegan'
  highProtein: true,            // true hvis > ~25 g protein per porsjon, ellers false
  allergens: ['gluten', 'egg'], // kun fra listen nedenfor
  tags: ['kylling', 'gryte'],   // 3–6 søkbare nøkkelord
  prepTime: 30,                 // minutter totalt inkl. steking/koking
  difficulty: 'enkel',          // 'enkel' | 'middels' | 'avansert'
  leftoverFriendly: true,       // egner seg som lunsj neste dag?
  vegetarianAlternative: '...',  // kun for kjøtt og fisk – forslag til vegetarisk variant
  recipe: {
    servings: 4,
    steps: [
      // 5–8 detaljerte steg på norsk.
      // Hvert steg er ett sammenhengende avsnitt.
      // Inkluder gram/dl-mengder direkte i stegene.
      // Skriv for en nybegynner – forklar teknikker kort.
    ],
  },
  shoppingList: [
    {
      item: 'Kyllingfilet',      // norsk navn, som i butikkhyllen
      search: 'kyllingfilet',    // søkeord mot Kassalapp-API (enkelt, presist)
      amount: '600 g',           // mengde for 4 porsjoner
      estimatedPrice: 89,        // estimert pris i NOK (Rema/Kiwi-nivå)
      category: 'Kjøtt',         // se gyldige kategorier nedenfor
    },
  ],
}
```

### Gyldige allergen-verdier
`gluten` | `laktose` | `egg` | `nøtter` | `skalldyr` | `fisk` | `soya` | `selleri` | `sennep` | `sesam`

### Gyldige shoppingList-kategorier
`Kjøtt` | `Fisk` | `Meieri` | `Egg` | `Frukt/grønt` | `Tørrvarer` | `Hermetikk` | `Krydder` | `Bakevarer` | `Annet`

---

## KRAV TIL OPPSKRIFTENE

- Ingredienser MÅ finnes i norske dagligvarebutikker (Rema, Kiwi, Meny, Coop)
- Alle mål i gram, dl, ts, ss – aldri cups, oz eller andre angloamerikanske mål
- prepTime skal være realistisk inkl. steketid (ikke bare aktivt arbeid)
- estimatedPrice er per vare, for 4 porsjoner, på lavprissupermarked-nivå
- Vegan-oppskrifter: ingen kjøtt, fisk, melk, egg, honning eller andre animalske produkter
- Vegetar-oppskrifter: ingen kjøtt eller fisk, men egg og melkeprodukter er OK
- Kjøttoppskrifter skal ha `vegetarianAlternative` – ett kort forslagsnavn
- Fiskoppskrifter skal ha `vegetarianAlternative` – ett kort forslagsnavn

---

## FORSLAG TIL RETTER SOM MANGLER

### Kjøtt (28 stk)
Storfe: biff med bearnaise, kjøttgryte, lapskaus, hamburgere, lasagne bolognese, shepherd's pie
Svin: svinekoteletter med saus, ribbe (forenklet), pulled pork, bacon-pasta
Kylling: kyllingsuppe med nudler, tikka masala, kyllingwok, ovnskylling, kylling caesar
Lam: fårikål, lammeskank, lammegryte, lammekjøttboller
Vilt: elggryte, elgburger, reinsdyrsteik
Blandet: boller i kraft, pølsegryte, chili con carne

### Fisk (10 stk)
Fiskesuppe (kremet norsk), klippfiskgrateng, sei med persillesaus, makrell i tomat og poteter,
fiskegrateng, fisketaco med hvit fisk, ovnsbakt laks med sennepssaus, rekesalat,
torskefilet med smørsaus, laks teriyaki

### Vegetar (21 stk)
Pasta: pasta primavera, pasta al forno, gorgonzola-pasta, pesto pasta med grønnsaker
Supper: tomatsuppe, brokkolisuppe, gresskarsuppe, linsesuppe
Gryter: ratatouille, grønnsaksgryte, bønnesuppe
Egg/ost: omelett med grønnsaker, frittata, quiche med spinat, eggerøre med tilbehør
Annet: falafel med pitabrød, vegetarburger, grønnsakspai, risotto med sopp

### Vegan (12 stk)
Tofu-wok med nudler, kikertgryte med kokosmelk, linsebolognese, svarte bønner tacos,
bønne-chili, grønnsakssuppe med linser, hummusbowl med ovnsbakte grønnsaker,
bakt søtpotet med salsa, soyakjøttgryte, thaiinspirert grønnsakskarri,
grønnkålsalat med kikerter, vegansk pasta med cashewsaus

---

## EKSPORTFORMAT

### I `meals/meals-meat.js`:
```js
export const MEAT_MEALS = [
  // eksisterende oppskrifter...
  // NYE oppskrifter legges til på slutten av arrayen
];
```

### I `meals/meals-fish.js`:
```js
export const FISH_MEALS = [
  // eksisterende...
  // NYE legges til på slutten
];
```

### I `meals/meals-vegetarian.js`:
```js
export const VEGETARIAN_MEALS = [
  // eksisterende...
  // NYE vegetar- og vegan-oppskrifter legges til på slutten
  // Vegan-oppskrifter har type: 'vegan'
];
```

---

## VIKTIG

- Ikke endre andre filer enn de tre nevnt ovenfor
- Ikke endre eksisterende oppskrifter
- Ikke endre eksportnavnene (`MEAT_MEALS`, `FISH_MEALS`, `VEGETARIAN_MEALS`)
- Sjekk at alle nye `id`-verdier er unike
- Fullfør alle oppskrifter i én kategori før du går til neste
