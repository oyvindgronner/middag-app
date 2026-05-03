# Middagsappen – Kontekst for Claude Code

## Hva er dette?
Backend for **stormat.flott.org** – en norsk middagsplanlegger for forbrukere.
Node.js / ESM-moduler. Live på kynux (Docker), https://stormat.flott.org

## 🎯 Status — Phase 4 FERDIG (2026-05-03)

✅ **100/100 oppskrifter** — alle 4 kategorier fullstendig  
✅ **Recipe Scaling** — ingrediensmengder skaleres basert på personer (1 barn → ¼ ingredienser)  
✅ **User Rating System** — 5-stjernersystem for oppskrifter  
✅ **Allergen-sikkerhet** — alle 100 oppskrifter auditert  
✅ **Security Hardening** — Helmet.js, rate limiting, XSS-proteksjon  
✅ **Database Auto-Init** — meal_ratings tabell opprettet ved startup  

| Feature | Status | Merk |
|---------|--------|------|
| Oppskrifter | ✅ 100/100 | Alle kategorier ferdig |
| Recipe Scaling | ✅ Live | Portions tilpasses antall personer |
| Rating System | ✅ API + UI | Graceful fallback når DB unavailable |
| Allergen-filter | ✅ Sikker | Alle 100 auditert 2026-05-03 |
| Security | ✅ Phase 1 | Helmet, rate-limit, XSS-beskyttelse |

## Oppskriftsstruktur
Alle oppskrifter følger dette formatet (se eksempler i `meals.js`):

```js
{
  id: 'unik-slug',              // kebab-case, norsk, unik
  name: 'Navn på retten',       // norsk navn
  type: 'fish',                 // 'fish' | 'meat' | 'vegetarian' | 'vegan'
  allergens: ['fisk', 'gluten'],// fra listen nedenfor
  tags: ['laks', 'pasta'],      // fritekstsøk-tags
  prepTime: 30,                 // minutter, inkl. steking/koking
  difficulty: 'enkel',          // 'enkel' | 'middels' | 'avansert'
  leftoverFriendly: true,       // egner seg som lunsj neste dag?
  vegetarianAlternative: '...',  // forslag til vegetarisk variant (kun for kjøtt/fisk)
  recipe: {
    servings: 4,
    steps: [
      // Detaljerte steg på norsk. Hvert steg er én fullstendig setning/avsnitt.
      // Inkluder gram/dl-mengder direkte i stegene, ikke bare i ingredienslisten.
    ],
  },
  shoppingList: [
    {
      item: 'Laksefilet',        // norsk navn på varen
      search: 'laksefilet',      // søkeord mot Kassalapp-API
      amount: '400 g',           // mengde for 4 porsjoner
      estimatedPrice: 89,        // estimert pris i NOK
      category: 'Fisk',          // kategori i dagligvarebutikk
    },
  ],
}
```

### Gyldige allergen-verdier
`gluten | laktose | egg | nøtter | skalldyr | fisk | soya | selleri | sennep | sesam`

### Gyldige kategorier i shoppingList
`Kjøtt | Fisk | Meieri | Egg | Frukt/grønt | Tørrvarer | Hermetikk | Krydder | Bakevarer | Annet`

## Filstruktur
```
meals/
  meals-meat.js        # kjøttoppskrifter
  meals-fish.js        # fisk og sjømat
  meals-vegetarian.js  # vegetar + vegan
meals.js               # importerer og eksporterer alle tre
```

Legg **nye kjøttoppskrifter** i `meals/meals-meat.js`, fisk i `meals/meals-fish.js`, og vegetar/vegan i `meals/meals-vegetarian.js`.

Eksporter alltid som et navngitt array, f.eks.:
```js
export const MEAT_MEALS = [ ... ];
```

## Kilde for nye oppskrifter
Vi bruker **Wikibooks Cookbook** (CC BY-SA) som utgangspunkt.
URL: https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents

Arbeidsflyt for nye oppskrifter:
1. Finn relevant oppskrift på Wikibooks (eller skriv fra bunnen med norsk matkultur som basis)
2. Tilpass til norske ingredienser og norske mål (gram/dl, ikke cups/oz)
3. Skriv stegene på norsk, detaljert nok for en nybegynner
4. Estimer priser basert på norske dagligvarepriser (Rema/Kiwi-nivå)
5. Legg til i riktig fil

## Prioritert arbeidsrekkefølge for oppskrifter

Jobb kategori for kategori til alle er fylt. Anbefalt rekkefølge:

### 1. Kjøtt — legg til 28 oppskrifter i `meals/meals-meat.js`
Eksempler på retter som mangler:
- Storfe: biff, gryte, kjøttboller, chili con carne, lasagne, shepherd's pie
- Svin: koteletter, ribbe (forenklet variant), pulled pork, bacongrateng
- Kylling: kyllingsuppe, tikka masala, wok, ovnskylling med rotgrønnsaker
- Lam: fårikål, lammeskank, lammegryte med rotgrønnsaker
- Vilt: elggryte, reinsdyrsteik

### 2. Vegetar — legg til 21 oppskrifter i `meals/meals-vegetarian.js`
Eksempler:
- Pasta: carbonara (egg-variant), pesto pasta, pasta al forno
- Gryter: linsesuppe, minestrone, bønnesuppe
- Egg/ost: omelett, frittata, quiche, eggerøre med tilbehør
- Indisk-inspirert: dal, paneer-inspirert curry
- Annet: vegetarburger, falafel, grønnsaksgrateng

### 3. Vegan — legg til 12 oppskrifter i `meals/meals-vegetarian.js`
NB: vegan-oppskrifter legges i samme fil som vegetar, med `type: 'vegan'`
Eksempler:
- Tofu-wok, kikertgryte, linsebolognese, svarte bønner tacos
- Grønnsakssupper, bakt søtpotet, hummusbowl

### 4. Fisk — legg til 10 oppskrifter i `meals/meals-fish.js`
Eksempler:
- Fiskesuppe, klippfisk, sei, makrell i tomat, rekesalat
- Fiskegrateng, fisketaco, ovnsbakt laks med sennepssaus

---

Eksempel på prompts til Claude Code:
```
Legg til alle 28 manglende kjøttoppskrifter i meals/meals-meat.js.
Bruk Wikibooks Cookbook som inspirasjon, tilpass til norske ingredienser og norske mål.
Følg formatet i CLAUDE.md nøyaktig. Ikke stopp etter 10 — fyll alle 28.
```

```
Legg til alle 21 manglende vegetaroppskrifter og alle 12 veganoppskrifter i meals/meals-vegetarian.js.
Vegan-oppskrifter skal ha type: 'vegan'. Følg CLAUDE.md-formatet.
```

```
Legg til de 10 manglende fiskoppskriftene i meals/meals-fish.js. Følg CLAUDE.md-formatet.
```

## Krav til oppskriftene
- Ingredienser MÅ finnes i norske dagligvarebutikker (Rema, Kiwi, Meny, Coop)
- Alle mål i gram, dl, ts, ss – aldri cups eller oz
- Steg skal være detaljerte nok til at en nybegynner lykkes
- prepTime skal være realistisk (inkl. steketid)
- estimatedPrice er per vare, for 4 porsjoner

## Hva som IKKE skal gjøres
- Ikke endre server.js, planner.js eller kassalapp.js uten eksplisitt beskjed
- Ikke endre formatet på eksisterende oppskrifter
- Ikke legg til nye felt i objektstrukturen uten å oppdatere alle eksisterende oppskrifter tilsvarende
