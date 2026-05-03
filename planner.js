// planner.js — velger og arrangerer måltider basert på brukerpreferanser

import { MEALS } from './meals.js';
import { scaleRecipe } from './scale-recipe.js';

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Sjekker om et måltid matcher brukerens "vil ikke ha"-liste (søker i navn, tags og ingredienser)
function matchesDontWant(meal, dontWant) {
  if (!dontWant) return false;
  const terms = dontWant.toLowerCase().split(/[,\s]+/).filter(Boolean);
  const shoppingItems = meal.shoppingList.map(item => item.item).join(' ');
  const haystack = [meal.name, ...meal.tags, shoppingItems].join(' ').toLowerCase();
  return terms.some(t => haystack.includes(t));
}

// Scorer et måltid mot "liker spesielt"-listen (høyere = bedre match)
function likeScore(meal, likesEspecially) {
  if (!likesEspecially) return 0;
  const terms = likesEspecially.toLowerCase().split(/[,\s]+/).filter(Boolean);
  const shoppingItems = meal.shoppingList.map(item => item.item).join(' ');
  const haystack = [meal.name, ...meal.tags, shoppingItems].join(' ').toLowerCase();
  return terms.filter(t => haystack.includes(t)).length;
}

// Velger inntil 'count' måltider fra en pool, med variasjon
function pickMeals(pool, count, usedIds, lastType, likesEspecially, leftovers) {
  if (count <= 0 || pool.length === 0) return [];

  const sorted = leftovers
    ? [...pool].sort((a, b) => (b.leftoverFriendly ? 1 : 0) - (a.leftoverFriendly ? 1 : 0))
    : pool;

  const selected = [];
  let curLastType = lastType;

  for (const meal of sorted) {
    if (selected.length >= count) break;
    if (usedIds.has(meal.id)) continue;
    if (meal.type === curLastType && sorted.some(m => !usedIds.has(m.id) && m.type !== curLastType)) continue;
    selected.push(meal);
    usedIds.add(meal.id);
    curLastType = meal.type;
  }

  // Fyll opp om nødvendig
  if (selected.length < count) {
    for (const meal of sorted) {
      if (selected.length >= count) break;
      if (!usedIds.has(meal.id)) {
        selected.push(meal);
        usedIds.add(meal.id);
      }
    }
  }

  return selected;
}

// Sprer ulike typer jevnt utover uka med hensyn til fisk-posisjonering
function arrangeMeals(fishMeals, vegMeals, veganMeals, meatMeals, days) {
  const result = new Array(days).fill(null);
  const used = new Set();

  // Plasser fisk på jevnt spredte dager
  if (fishMeals.length > 0) {
    const positions = fishMeals.map((_, i) =>
      Math.round((i + 1) * (days / (fishMeals.length + 1))) - 1
    );
    positions.forEach((pos, i) => {
      let p = Math.min(Math.max(pos, 0), days - 1);
      while (used.has(p)) p = (p + 1) % days;
      used.add(p);
      result[p] = fishMeals[i];
    });
  }

  // Flett vegetar, vegan og kjøtt for bedre variasjon (unngå samme type på rad)
  function interleave(...arrays) {
    const result = [];
    const maxLen = Math.max(...arrays.map(a => a.length));
    for (let i = 0; i < maxLen; i++) {
      arrays.forEach(arr => { if (i < arr.length) result.push(arr[i]); });
    }
    return result;
  }
  const others = interleave(vegMeals, veganMeals, meatMeals);
  let oi = 0;
  for (let i = 0; i < days; i++) {
    if (result[i] === null && oi < others.length) {
      result[i] = others[oi++];
    }
  }

  return result.filter(Boolean);
}

/**
 * Velger måltider basert på brukerparametre.
 * @returns {Array} Array av måltidsobjekter med dag-felt tilordnet
 */
export function selectMeals(params) {
  const {
    days              = 5,
    persons           = 4,
    allergies         = [],
    cookTime          = 30,
    difficulty        = 'enkel',
    leftovers         = false,
    fishPerWeek       = 2,
    vegetarianPerWeek = 1,
    veganPerWeek      = 0,
    likesEspecially   = '',
    dontWant          = '',
  } = params;

  const maxTime = cookTime >= 60 ? Infinity : parseInt(cookTime);
  const compromises = [];

  // ── Filtrer ut ugyldige måltider ─────────────────────────────────────────
  let pool = MEALS.filter(meal => {
    if (meal.allergens.some(a => allergies.includes(a))) return false;
    if (meal.prepTime > maxTime) return false;
    if (difficulty === 'enkel' && meal.difficulty === 'avansert') return false;
    if (matchesDontWant(meal, dontWant)) return false;
    if (allergies.includes('fisk') && meal.type === 'fish') return false;
    return true;
  });

  // ── Sorter etter preferanse ───────────────────────────────────────────────
  if (likesEspecially) {
    pool = [...pool].sort((a, b) => likeScore(b, likesEspecially) - likeScore(a, likesEspecially));
  } else {
    pool = shuffle(pool);
  }

  // ── Separer etter type ────────────────────────────────────────────────────
  const fishPool  = pool.filter(m => m.type === 'fish');
  const meatPool  = pool.filter(m => m.type === 'meat');
  const vegPool   = pool.filter(m => m.type === 'vegetarian');
  const veganPool = pool.filter(m => m.type === 'vegan');

  // Beregn antall av hver type
  const numFish  = allergies.includes('fisk') ? 0 : Math.min(fishPerWeek, days, fishPool.length);
  const numVeg   = Math.min(vegetarianPerWeek, days - numFish, vegPool.length);
  const numVegan = Math.min(veganPerWeek, days - numFish - numVeg, veganPool.length);
  const numMeat  = Math.max(0, days - numFish - numVeg - numVegan);

  // ── Detekter kompromisser ──────────────────────────────────────────────────
  if (!allergies.includes('fisk') && fishPerWeek > numFish) {
    compromises.push({
      type: 'fish',
      requested: fishPerWeek,
      provided: numFish,
      reason: `Bare ${fishPool.length} fiskemiddager tilgjengelig`
    });
  }
  if (vegetarianPerWeek > numVeg) {
    compromises.push({
      type: 'vegetarian',
      requested: vegetarianPerWeek,
      provided: numVeg,
      reason: `Bare ${vegPool.length} vegetarmiddager tilgjengelig`
    });
  }
  if (veganPerWeek > numVegan) {
    compromises.push({
      type: 'vegan',
      requested: veganPerWeek,
      provided: numVegan,
      reason: `Bare ${veganPool.length} veganmiddager tilgjengelig`
    });
  }

  // ── Velg måltider ─────────────────────────────────────────────────────────
  const usedIds = new Set();

  const selectedFish  = shuffle(fishPool).slice(0, numFish);
  selectedFish.forEach(m => usedIds.add(m.id));

  const selectedVeg   = pickMeals(vegPool,   numVeg,   usedIds, null, likesEspecially, leftovers);
  const selectedVegan = pickMeals(veganPool, numVegan, usedIds, null, likesEspecially, leftovers);
  const selectedMeat  = pickMeals(meatPool,  numMeat,  usedIds, null, likesEspecially, leftovers);

  // ── Arranger og tilordne dager ────────────────────────────────────────────
  const arranged = arrangeMeals(selectedFish, selectedVeg, selectedVegan, selectedMeat, days);

  const meals = arranged.map((meal, i) => {
    const mealWithDay = {
      ...meal,
      day: DAYS[i],
    };
    // Skaler oppskriften basert på antall personer
    return scaleRecipe(mealWithDay, meal.recipe.servings, persons);
  });

  // Legg til kompromiss-informasjon på resultatobjektet
  meals._compromises = compromises.length > 0 ? compromises : null;

  return meals;
}
