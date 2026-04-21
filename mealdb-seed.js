// mealdb-seed.js — henter oppskrifter fra TheMealDB og skriver til meals-*.js
// Kjøres én gang: node mealdb-seed.js
// Krever Internett-tilgang og node-fetch.

import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

const BASE = 'https://www.themealdb.com/api/json/v1/1';

// Antall oppskrifter per type
const COUNTS = {
  fish:       20,
  beef:       10,
  chicken:    15,
  lamb:        8,
  pork:        7,
  vegetarian: 12,
  vegan:      10,
};

// ── Ingrediens-tabell: engelsk → [norsk visningsnavn, kassalapp-søk, kategori] ──
const INGREDIENTS = {
  // Kjøtt
  'chicken breast':      ['Kyllingfilet',          'kyllingfilet',           'Kjøtt'],
  'chicken thighs':      ['Kyllinglår',             'kyllinglår',             'Kjøtt'],
  'chicken thigh':       ['Kyllinglår',             'kyllinglår',             'Kjøtt'],
  'chicken':             ['Kylling',                'kylling',                'Kjøtt'],
  'ground beef':         ['Kjøttdeig',              'kjøttdeig',              'Kjøtt'],
  'minced beef':         ['Kjøttdeig',              'kjøttdeig',              'Kjøtt'],
  'beef':                ['Oksekjøtt',              'oksekjøtt',              'Kjøtt'],
  'beef steak':          ['Biff',                   'biff oksekjøtt',         'Kjøtt'],
  'steak':               ['Biff',                   'biff oksekjøtt',         'Kjøtt'],
  'lamb':                ['Lammekjøtt',             'lammekjøtt',             'Kjøtt'],
  'lamb shoulder':       ['Lammeskulder',           'lammekjøtt',             'Kjøtt'],
  'lamb chops':          ['Lammekotelettar',        'lammekjøtt',             'Kjøtt'],
  'pork':                ['Svinekjøtt',             'svinekjøtt',             'Kjøtt'],
  'pork belly':          ['Svinebryst',             'svinebryst',             'Kjøtt'],
  'pork shoulder':       ['Svineskulder',           'svinekjøtt',             'Kjøtt'],
  'bacon':               ['Bacon',                  'bacon',                  'Kjøtt'],
  'chorizo':             ['Chorizo',                'chorizo',                'Kjøtt'],
  'turkey':              ['Kalkun',                 'kalkun',                 'Kjøtt'],
  // Fisk og skalldyr
  'salmon':              ['Laksefilet',             'laksefilet',             'Fisk'],
  'salmon fillet':       ['Laksefilet',             'laksefilet',             'Fisk'],
  'cod':                 ['Torskefilet',            'torskefilet',            'Fisk'],
  'tuna':                ['Tunfisk',                'tunfisk hermetisk',      'Fisk'],
  'tuna steak':          ['Tunfisk',                'tunfisk',                'Fisk'],
  'shrimp':              ['Reker',                  'reker',                  'Fisk'],
  'prawns':              ['Reker',                  'reker',                  'Fisk'],
  'king prawns':         ['Jumboreker',             'reker',                  'Fisk'],
  'mussels':             ['Blåskjell',              'blåskjell',              'Fisk'],
  'squid':               ['Blekksprut',             'blekksprut',             'Fisk'],
  'crab':                ['Krabbe',                 'krabbe',                 'Fisk'],
  'lobster':             ['Hummer',                 'hummer',                 'Fisk'],
  'anchovy':             ['Ansjos',                 'ansjos',                 'Fisk'],
  'anchovies':           ['Ansjos',                 'ansjos',                 'Fisk'],
  'sea bass':            ['Havabbor',               'fisk filet',             'Fisk'],
  'haddock':             ['Hyse',                   'hyse',                   'Fisk'],
  'tilapia':             ['Tilapia',                'torskefilet',            'Fisk'],
  'mackerel':            ['Makrell',                'makrell',                'Fisk'],
  'trout':               ['Ørret',                  'ørretfilet',             'Fisk'],
  // Grønnsaker og frukt
  'onion':               ['Løk',                   'løk',                    'Frukt/grønt'],
  'onions':              ['Løk',                   'løk',                    'Frukt/grønt'],
  'red onion':           ['Rødløk',                'rødløk',                 'Frukt/grønt'],
  'spring onion':        ['Vårløk',                'vårløk',                 'Frukt/grønt'],
  'spring onions':       ['Vårløk',                'vårløk',                 'Frukt/grønt'],
  'shallots':            ['Sjalottløk',            'sjalottløk',             'Frukt/grønt'],
  'garlic':              ['Hvitløk',               'hvitløk',                'Frukt/grønt'],
  'garlic clove':        ['Hvitløksfedd',          'hvitløk',                'Frukt/grønt'],
  'garlic cloves':       ['Hvitløksfedd',          'hvitløk',                'Frukt/grønt'],
  'tomato':              ['Tomat',                 'tomat',                  'Frukt/grønt'],
  'tomatoes':            ['Tomater',               'tomat',                  'Frukt/grønt'],
  'cherry tomatoes':     ['Cherrytomater',         'cherrytomater',          'Frukt/grønt'],
  'potato':              ['Potet',                 'potet',                  'Frukt/grønt'],
  'potatoes':            ['Poteter',               'potet',                  'Frukt/grønt'],
  'sweet potato':        ['Søtpotet',              'søtpotet',               'Frukt/grønt'],
  'sweet potatoes':      ['Søtpotet',              'søtpotet',               'Frukt/grønt'],
  'carrot':              ['Gulrot',                'gulrot',                 'Frukt/grønt'],
  'carrots':             ['Gulrøtter',             'gulrot',                 'Frukt/grønt'],
  'spinach':             ['Fersk spinat',          'spinat fersk',           'Frukt/grønt'],
  'red pepper':          ['Rød paprika',           'rød paprika',            'Frukt/grønt'],
  'green pepper':        ['Grønn paprika',         'paprika',                'Frukt/grønt'],
  'yellow pepper':       ['Gul paprika',           'gul paprika',            'Frukt/grønt'],
  'bell pepper':         ['Paprika',               'paprika',                'Frukt/grønt'],
  'mushrooms':           ['Sjampinjong',           'sjampinjong',            'Frukt/grønt'],
  'broccoli':            ['Brokkoli',              'brokkoli',               'Frukt/grønt'],
  'courgette':           ['Squash',                'squash',                 'Frukt/grønt'],
  'zucchini':            ['Squash',                'squash',                 'Frukt/grønt'],
  'leek':                ['Purreløk',              'purre',                  'Frukt/grønt'],
  'celery':              ['Stangselleri',          'stangselleri',           'Frukt/grønt'],
  'aubergine':           ['Aubergine',             'aubergine',              'Frukt/grønt'],
  'eggplant':            ['Aubergine',             'aubergine',              'Frukt/grønt'],
  'lemon':               ['Sitron',                'sitron',                 'Frukt/grønt'],
  'lime':                ['Lime',                  'lime',                   'Frukt/grønt'],
  'cucumber':            ['Agurk',                 'agurk',                  'Frukt/grønt'],
  'avocado':             ['Avokado',               'avokado',                'Frukt/grønt'],
  'corn':                ['Mais',                  'mais',                   'Frukt/grønt'],
  'asparagus':           ['Asparges',              'asparges',               'Frukt/grønt'],
  'kale':                ['Grønnkål',              'grønnkål',               'Frukt/grønt'],
  'peas':                ['Erter',                 'erter fryst',            'Frys'],
  'frozen peas':         ['Frosne erter',          'erter fryst',            'Frys'],
  'ginger':              ['Ingefær',               'ingefær fersk',          'Frukt/grønt'],
  'fresh ginger':        ['Fersk ingefær',         'ingefær fersk',          'Frukt/grønt'],
  'chilli':              ['Rød chili',             'chili rød',              'Frukt/grønt'],
  'chili':               ['Rød chili',             'chili rød',              'Frukt/grønt'],
  'green chilli':        ['Grønn chili',           'chili grønn',            'Frukt/grønt'],
  'fresh coriander':     ['Fersk koriander',       'koriander fersk',        'Frukt/grønt'],
  'coriander':           ['Koriander',             'koriander fersk',        'Frukt/grønt'],
  'parsley':             ['Persille',              'persille fersk',         'Frukt/grønt'],
  'fresh parsley':       ['Fersk persille',        'persille fersk',         'Frukt/grønt'],
  'basil':               ['Basilikum',             'basilikum fersk',        'Frukt/grønt'],
  'fresh basil':         ['Fersk basilikum',       'basilikum fersk',        'Frukt/grønt'],
  'thyme':               ['Timian',                'timian',                 'Diverse'],
  'rosemary':            ['Rosmarin',              'rosmarin',               'Diverse'],
  'mint':                ['Mynte',                 'mynte fersk',            'Frukt/grønt'],
  'dill':                ['Dill',                  'dill fersk',             'Frukt/grønt'],
  'chives':              ['Gressløk',              'gressløk',               'Frukt/grønt'],
  // Meieri og egg
  'milk':                ['Melk',                  'melk',                   'Meieri'],
  'whole milk':          ['Helmelk',               'helmelk',                'Meieri'],
  'cream':               ['Fløte',                 'fløte',                  'Meieri'],
  'double cream':        ['Kremfløte',             'kremfløte',              'Meieri'],
  'single cream':        ['Matfløte',              'matfløte',               'Meieri'],
  'heavy cream':         ['Kremfløte',             'kremfløte',              'Meieri'],
  'whipping cream':      ['Kremfløte',             'kremfløte',              'Meieri'],
  'sour cream':          ['Rømme',                 'rømme',                  'Meieri'],
  'butter':              ['Smør',                  'smør',                   'Meieri'],
  'cheese':              ['Ost',                   'ost',                    'Meieri'],
  'parmesan':            ['Parmesan',              'parmesan',               'Meieri'],
  'parmesan cheese':     ['Parmesan',              'parmesan',               'Meieri'],
  'cheddar cheese':      ['Cheddar',               'cheddar',                'Meieri'],
  'cheddar':             ['Cheddar',               'cheddar',                'Meieri'],
  'feta cheese':         ['Fetaost',               'fetaost',                'Meieri'],
  'feta':                ['Fetaost',               'fetaost',                'Meieri'],
  'mozzarella':          ['Mozzarella',            'mozzarella',             'Meieri'],
  'cream cheese':        ['Kremost',               'kremost',                'Meieri'],
  'ricotta':             ['Ricotta',               'ricotta',                'Meieri'],
  'greek yoghurt':       ['Gresk yoghurt',         'gresk yoghurt',          'Meieri'],
  'yogurt':              ['Yoghurt',               'yoghurt',                'Meieri'],
  'yoghurt':             ['Yoghurt',               'yoghurt',                'Meieri'],
  'egg':                 ['Egg',                   'egg',                    'Meieri'],
  'eggs':                ['Egg',                   'egg',                    'Meieri'],
  // Tørrvarer
  'flour':               ['Hvetemel',              'hvetemel',               'Tørrvarer'],
  'plain flour':         ['Hvetemel',              'hvetemel',               'Tørrvarer'],
  'self-raising flour':  ['Bakepulvermel',         'hvetemel',               'Tørrvarer'],
  'rice':                ['Ris',                   'ris',                    'Tørrvarer'],
  'basmati rice':        ['Basmatiris',            'basmatiris',             'Tørrvarer'],
  'long grain rice':     ['Langgristet ris',       'ris',                    'Tørrvarer'],
  'pasta':               ['Pasta',                 'pasta',                  'Tørrvarer'],
  'spaghetti':           ['Spaghetti',             'spaghetti',              'Tørrvarer'],
  'penne':               ['Penne',                 'penne pasta',            'Tørrvarer'],
  'noodles':             ['Nudler',                'nudler',                 'Tørrvarer'],
  'rice noodles':        ['Risnudler',             'risnudler',              'Tørrvarer'],
  'breadcrumbs':         ['Brødsmuler',            'brødsmuler',             'Tørrvarer'],
  'chickpeas':           ['Kikerter',              'kikerter boks',          'Tørrvarer'],
  'lentils':             ['Linser',                'røde linser',            'Tørrvarer'],
  'red lentils':         ['Røde linser',           'røde linser',            'Tørrvarer'],
  'green lentils':       ['Grønne linser',         'linser',                 'Tørrvarer'],
  'kidney beans':        ['Kidneybønner',          'kidneybønner boks',      'Tørrvarer'],
  'black beans':         ['Svarte bønner',         'svarte bønner',          'Tørrvarer'],
  'cannellini beans':    ['Cannellinibønner',      'hvite bønner',           'Tørrvarer'],
  'white beans':         ['Hvite bønner',          'hvite bønner',           'Tørrvarer'],
  'chopped tomatoes':    ['Hermetiske tomater',    'hermetiske tomater',     'Tørrvarer'],
  'tinned tomatoes':     ['Hermetiske tomater',    'hermetiske tomater',     'Tørrvarer'],
  'canned tomatoes':     ['Hermetiske tomater',    'hermetiske tomater',     'Tørrvarer'],
  'coconut milk':        ['Kokosmelk',             'kokosmelk',              'Tørrvarer'],
  'tomato paste':        ['Tomatpuré',             'tomatpuré',              'Tørrvarer'],
  'tomato puree':        ['Tomatpuré',             'tomatpuré',              'Tørrvarer'],
  'tomato sauce':        ['Tomatsaus',             'tomatsaus',              'Tørrvarer'],
  'passata':             ['Tomatpassata',          'passata tomatsaus',      'Tørrvarer'],
  'olive oil':           ['Olivenolje',            'olivenolje',             'Tørrvarer'],
  'vegetable oil':       ['Nøytral olje',          'solsikkeolje',           'Tørrvarer'],
  'sunflower oil':       ['Solsikkeolje',          'solsikkeolje',           'Tørrvarer'],
  'sesame oil':          ['Sesamolje',             'sesamolje',              'Tørrvarer'],
  'soy sauce':           ['Soyasaus',              'soyasaus',               'Tørrvarer'],
  'fish sauce':          ['Fiskesaus',             'fiskesaus',              'Tørrvarer'],
  'oyster sauce':        ['Østerssaus',            'østerssaus',             'Tørrvarer'],
  'worcestershire sauce':['Worcestershiresaus',    'worcestershire saus',    'Tørrvarer'],
  'hot sauce':           ['Chilisaus',             'tabasco',                'Tørrvarer'],
  'stock':               ['Buljong',               'buljong',                'Tørrvarer'],
  'chicken stock':       ['Kyllingbuljong',        'kyllingbuljong',         'Tørrvarer'],
  'beef stock':          ['Oksekraftbuljong',      'oksekraftbuljong',       'Tørrvarer'],
  'vegetable stock':     ['Grønnsaksbuljong',      'grønnsaksbuljong',       'Tørrvarer'],
  'fish stock':          ['Fiskekraft',            'fiskekraft buljong',     'Tørrvarer'],
  'sugar':               ['Sukker',                'sukker',                 'Tørrvarer'],
  'brown sugar':         ['Brunt sukker',          'brunt sukker',           'Tørrvarer'],
  'honey':               ['Honning',               'honning',                'Tørrvarer'],
  'vinegar':             ['Eddik',                 'eddik',                  'Tørrvarer'],
  'white wine vinegar':  ['Hvitvinseddik',         'hvitvinseddik',          'Tørrvarer'],
  'balsamic vinegar':    ['Balsamicoeddik',        'balsamicoeddik',         'Tørrvarer'],
  'white wine':          ['Hvitvin',               'hvitvin matlaging',      'Diverse'],
  'red wine':            ['Rødvin',                'rødvin matlaging',       'Diverse'],
  'tahini':              ['Tahini',                'tahini',                 'Tørrvarer'],
  'peanut butter':       ['Peanøttsmør',           'peanøttsmør',            'Tørrvarer'],
  'almond':              ['Mandel',                'mandler',                'Tørrvarer'],
  'almonds':             ['Mandler',               'mandler',                'Tørrvarer'],
  'pine nuts':           ['Pinjekjerner',          'pinjekjerner',           'Tørrvarer'],
  'walnuts':             ['Valnøtter',             'valnøtter',              'Tørrvarer'],
  'cashew nuts':         ['Cashewnøtter',          'cashewnøtter',           'Tørrvarer'],
  'saffron':             ['Safran',                'safran',                 'Diverse'],
  'cumin':               ['Spisskummen',           'spisskummen',            'Diverse'],
  'coriander powder':    ['Korianderpulver',       'koriander malt',         'Diverse'],
  'paprika':             ['Paprikapulver',         'paprikapulver',          'Diverse'],
  'smoked paprika':      ['Røkt paprikapulver',    'røkt paprikapulver',     'Diverse'],
  'turmeric':            ['Gurkemeie',             'gurkemeie',              'Diverse'],
  'cinnamon':            ['Kanel',                 'kanel',                  'Diverse'],
  'cayenne pepper':      ['Cayennepepper',         'cayennepepper',          'Diverse'],
  'black pepper':        ['Sort pepper',           'pepper',                 'Diverse'],
  'salt':                ['Salt',                  'salt',                   'Diverse'],
  'garam masala':        ['Garam masala',          'garam masala',           'Diverse'],
  'curry powder':        ['Karripulver',           'karri pulver',           'Diverse'],
  'curry paste':         ['Karripaste',            'karripaste',             'Diverse'],
  'harissa':             ['Harissa',               'harissa',                'Diverse'],
  'miso':                ['Miso',                  'misopaste',              'Tørrvarer'],
  'corn starch':         ['Maisstivelse',          'maizena',                'Tørrvarer'],
  'cornstarch':          ['Maisstivelse',          'maizena',                'Tørrvarer'],
  'baking powder':       ['Bakepulver',            'bakepulver',             'Tørrvarer'],
};

// Allergen-mapping
const ALLERGEN_KEYWORDS = {
  laktose:  ['milk', 'cream', 'butter', 'cheese', 'parmesan', 'cheddar', 'mozzarella',
             'ricotta', 'feta', 'yogurt', 'yoghurt', 'ghee'],
  gluten:   ['flour', 'breadcrumbs', 'pasta', 'spaghetti', 'penne', 'noodles', 'wheat',
             'bread', 'soy sauce', 'worcestershire', 'barley', 'couscous'],
  egg:      ['egg', 'eggs', 'mayonnaise'],
  fisk:     ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'anchovy', 'anchovies',
             'sardine', 'mackerel', 'tilapia', 'trout', 'sea bass', 'halibut',
             'fish sauce', 'fish stock'],
  skalldyr: ['shrimp', 'prawn', 'prawns', 'lobster', 'crab', 'mussel', 'mussels',
             'scallop', 'squid', 'octopus', 'oyster', 'king prawn'],
  nøtter:   ['peanut', 'peanuts', 'cashew', 'almond', 'almonds', 'walnut', 'walnuts',
             'pistachio', 'hazelnut', 'pine nut', 'pine nuts', 'peanut butter'],
  sesam:    ['sesame', 'sesame oil', 'tahini'],
  soya:     ['soy sauce', 'soy', 'tofu', 'miso', 'edamame'],
};

// ── Hjelpefunksjoner ──────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(str) {
  return str.toLowerCase()
    .replace(/[åä]/g, 'a').replace(/[øö]/g, 'o').replace(/[æ]/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function categoryToType(cat) {
  const c = cat.toLowerCase();
  if (c === 'seafood') return 'fish';
  if (c === 'vegan') return 'vegan';
  if (c === 'vegetarian') return 'vegetarian';
  return 'meat'; // beef, chicken, lamb, pork, etc.
}

function extractIngredients(meal) {
  const result = [];
  for (let i = 1; i <= 20; i++) {
    const ing = (meal[`strIngredient${i}`] || '').trim();
    const meas = (meal[`strMeasure${i}`] || '').trim();
    if (ing) result.push({ ingredient: ing.toLowerCase(), measure: meas, original: ing });
  }
  return result;
}

function inferAllergens(ingredients) {
  const allergens = new Set();
  for (const { ingredient } of ingredients) {
    for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
      if (keywords.some(kw => ingredient.includes(kw))) {
        allergens.add(allergen);
      }
    }
  }
  return [...allergens];
}

function inferHighProtein(type, ingredients) {
  if (type === 'fish' || type === 'meat') return true;
  const proteinIngredients = ['chickpeas', 'lentils', 'beans', 'tofu', 'tempeh', 'quinoa', 'edamame'];
  return ingredients.some(({ ingredient }) => proteinIngredients.some(p => ingredient.includes(p)));
}

function buildTags(category, area, ingredients) {
  const tags = [category.toLowerCase()];
  if (area && area !== 'Unknown') tags.push(area.toLowerCase());
  // Add protein tags
  for (const { ingredient } of ingredients.slice(0, 5)) {
    for (const [key] of Object.entries(INGREDIENTS)) {
      if (ingredient.includes(key) && key.split(' ').length <= 2) {
        const norsk = INGREDIENTS[key]?.[0]?.toLowerCase();
        if (norsk && !tags.includes(norsk)) { tags.push(norsk); break; }
      }
    }
  }
  return tags.slice(0, 8);
}

function convertMeasure(measure, ingredient) {
  if (!measure) return '';
  const m = measure.trim();
  // Convert common US measures to metric
  return m
    .replace(/(\d+(?:\.\d+)?)\s*cup[s]?/gi, (_, n) => `${Math.round(parseFloat(n) * 2.4)} dl`)
    .replace(/(\d+(?:\.\d+)?)\s*oz\b/gi, (_, n) => `${Math.round(parseFloat(n) * 28)} g`)
    .replace(/(\d+(?:\.\d+)?)\s*lb[s]?\b/gi, (_, n) => `${Math.round(parseFloat(n) * 450)} g`)
    .replace(/\btbs\b|\btbsp\b|\btablespoon[s]?\b/gi, 'ss')
    .replace(/\btsp\b|\bteaspoon[s]?\b/gi, 'ts')
    .replace(/\bpound[s]?\b/gi, (match, offset, str) => {
      const before = str.slice(0, offset).match(/(\d+(?:\.\d+)?)\s*$/);
      return before ? `${Math.round(parseFloat(before[1]) * 450)} g` : match;
    });
}

function buildShoppingList(ingredients) {
  const list = [];
  for (const { ingredient, measure, original } of ingredients) {
    // Find best match in INGREDIENTS table (longest matching key)
    let bestKey = null;
    let bestLen = 0;
    for (const key of Object.keys(INGREDIENTS)) {
      if (ingredient.includes(key) && key.length > bestLen) {
        bestKey = key;
        bestLen = key.length;
      }
    }
    const [norskNavn, search, category] = bestKey
      ? INGREDIENTS[bestKey]
      : [capitalize(original), original.toLowerCase(), 'Diverse'];

    const amount = convertMeasure(measure, ingredient);
    list.push({ item: norskNavn, search, amount, estimatedPrice: null, category });
  }

  // Dedupliser: slå sammen duplikater
  const seen = new Map();
  for (const item of list) {
    if (seen.has(item.item)) {
      const existing = seen.get(item.item);
      if (item.amount && existing.amount && item.amount !== existing.amount) {
        existing.amount = `${existing.amount} + ${item.amount}`;
      }
    } else {
      seen.set(item.item, { ...item });
    }
  }
  return [...seen.values()];
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function estimatePrepTime(instructions) {
  if (!instructions) return 30;
  const len = instructions.length;
  if (len < 400) return 20;
  if (len < 800) return 30;
  if (len < 1400) return 45;
  return 60;
}

function parseSteps(instructions) {
  if (!instructions) return [];
  return instructions
    .split(/\r\n|\n\n|\r\r/)
    .map(s => s.replace(/\r?\n/g, ' ').trim())
    .filter(s => s.length > 10);
}

function transformMeal(meal) {
  const ingredients = extractIngredients(meal);
  const type = categoryToType(meal.strCategory);

  return {
    id: slugify(meal.strMeal),
    name: meal.strMeal,
    type,
    highProtein: inferHighProtein(type, ingredients),
    allergens: inferAllergens(ingredients),
    tags: buildTags(meal.strCategory, meal.strArea, ingredients),
    prepTime: estimatePrepTime(meal.strInstructions),
    difficulty: 'enkel',
    leftoverFriendly: false,
    imageUrl: meal.strMealThumb || null,
    recipe: {
      servings: 4,
      steps: parseSteps(meal.strInstructions),
    },
    shoppingList: buildShoppingList(ingredients),
  };
}

// ── API-funksjoner ────────────────────────────────────────────────────────────

async function fetchCategoryMeals(category) {
  const res = await fetch(`${BASE}/filter.php?c=${encodeURIComponent(category)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${res.status} for category ${category}`);
  const data = await res.json();
  return (data.meals || []).map(m => m.idMeal);
}

async function fetchMealDetail(id) {
  const res = await fetch(`${BASE}/lookup.php?i=${id}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${res.status} for meal ${id}`);
  const data = await res.json();
  return (data.meals || [])[0] || null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchMeals(category, count) {
  console.log(`  Henter liste for ${category}...`);
  const ids = await fetchCategoryMeals(category);
  const sampled = shuffle(ids).slice(0, count);
  const meals = [];
  for (const id of sampled) {
    await sleep(300); // vær høflig mot API
    const detail = await fetchMealDetail(id);
    if (detail) {
      meals.push(transformMeal(detail));
      process.stdout.write('.');
    }
  }
  console.log(` (${meals.length} hentet)`);
  return meals;
}

// ── Filskriving ───────────────────────────────────────────────────────────────

function mealToJs(meal) {
  const m = JSON.stringify(meal, null, 4)
    .replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/g, '$1:'); // fjern anführselstegn fra keys
  return `  ${m},\n\n`;
}

function writeFile(path, exportName, meals) {
  const content = `// ${path.split('/').pop()} — generert av mealdb-seed.js (${new Date().toISOString().slice(0,10)})\n\nexport const ${exportName} = [\n\n` +
    meals.map(mealToJs).join('') +
    `];\n`;
  writeFileSync(path, content, 'utf8');
  console.log(`  → Skrev ${meals.length} oppskrifter til ${path}`);
}

// ── Hoved ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('TheMealDB seed — starter...\n');

  const basePath = new URL('.', import.meta.url).pathname + 'meals/';

  // Fish
  console.log('🐟 Fisk (Seafood):');
  const fish = await fetchMeals('Seafood', COUNTS.fish);
  writeFile(basePath + 'meals-fish.js', 'FISH_MEALS', fish);

  // Meat: Beef + Chicken + Lamb + Pork
  console.log('\n🥩 Kjøtt:');
  const beef      = await fetchMeals('Beef',    COUNTS.beef);
  const chicken   = await fetchMeals('Chicken', COUNTS.chicken);
  const lamb      = await fetchMeals('Lamb',    COUNTS.lamb);
  const pork      = await fetchMeals('Pork',    COUNTS.pork);
  const meat = [...beef, ...chicken, ...lamb, ...pork];
  writeFile(basePath + 'meals-meat.js', 'MEAT_MEALS', meat);

  // Vegetarian
  console.log('\n🥦 Vegetar:');
  const veg = await fetchMeals('Vegetarian', COUNTS.vegetarian);
  writeFile(basePath + 'meals-vegetarian.js', 'VEG_MEALS', veg);

  // Vegan
  console.log('\n🌱 Vegansk:');
  const vegan = await fetchMeals('Vegan', COUNTS.vegan);
  writeFile(basePath + 'meals-vegan.js', 'VEGAN_MEALS', vegan);

  const total = fish.length + meat.length + veg.length + vegan.length;
  console.log(`\n✅ Ferdig! ${total} oppskrifter totalt.`);
  console.log('   Restart backend: pm2 restart middag-backend');
}

run().catch(err => { console.error('Feil:', err); process.exit(1); });
