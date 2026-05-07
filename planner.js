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
function pickMeals(pool, count, usedIds, lastType, likesEspecially, leftovers, ratings) {
  if (count <= 0 || pool.length === 0) return [];

  const sorted = [...pool].sort((a, b) => {
    // Sort by: 1) leftovers if requested, 2) rating (if available), 3) original order
    if (leftovers) {
      if (a.leftoverFriendly !== b.leftoverFriendly) {
        return (b.leftoverFriendly ? 1 : 0) - (a.leftoverFriendly ? 1 : 0);
      }
    }

    if (ratings) {
      const ratingA = ratings[a.id] || 0;
      const ratingB = ratings[b.id] || 0;
      if (ratingB !== ratingA) return ratingB - ratingA; // Higher rating first
    }

    return 0;
  });

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
 * @param {Object} params - Brukeparametere
 * @param {Object} ratings - Optional: { mealId: averageRating } for rating-based sorting
 * @returns {Array} Array av måltidsobjekter med dag-felt tilordnet
 */
export function selectMeals(params, ratings = {}) {
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
  const numMeat  = Math.min(Math.max(0, days - numFish - numVeg - numVegan), meatPool.length);

  // ── Smart preferanse-bytte ────────────────────────────────────────────────
  // Hvis likesEspecially er satt og ingen av de kvoterte typene har matchende retter,
  // bytt 1 quota fra en ikke-matchende type til en matchende type.
  let actualFishQuota = numFish;
  let actualVegQuota = numVeg;
  let actualVeganQuota = numVegan;
  let actualMeatQuota = numMeat;

  if (likesEspecially) {
    const matchInPool = (p) => p.some(m => likeScore(m, likesEspecially) > 0);
    const quotas = { fish: actualFishQuota, vegetarian: actualVegQuota, vegan: actualVeganQuota, meat: actualMeatQuota };
    const pools  = { fish: fishPool, vegetarian: vegPool, vegan: veganPool, meat: meatPool };
    const willMatch = Object.entries(quotas).some(([t, q]) => q > 0 && matchInPool(pools[t]));
    const matchingTypes = Object.entries(pools).filter(([_, p]) => matchInPool(p)).map(([t]) => t);

    if (!willMatch && matchingTypes.length > 0) {
      const targetType = matchingTypes[0];
      const stealOrder = ['meat', 'vegetarian', 'vegan', 'fish'];
      for (const stealFrom of stealOrder) {
        if (stealFrom === targetType) continue;
        if (quotas[stealFrom] > 0) {
          quotas[stealFrom]--;
          quotas[targetType]++;
          compromises.push({
            type: 'preference',
            requested: likesEspecially,
            provided: 1,
            reason: `Byttet ut én ${stealFrom === 'meat' ? 'kjøtt' : stealFrom === 'fish' ? 'fisk' : stealFrom}-middag med en ${targetType === 'meat' ? 'kjøtt' : targetType === 'fish' ? 'fisk' : targetType}-rett som matcher "${likesEspecially}"`
          });
          break;
        }
      }
      actualFishQuota  = quotas.fish;
      actualVegQuota   = quotas.vegetarian;
      actualVeganQuota = quotas.vegan;
      actualMeatQuota  = quotas.meat;
    }
  }

  // ── Detekter kompromisser (basert på actual quota etter smart-bytte) ──────
  function buildReason(requested, delivered, poolSize, label) {
    if (delivered >= requested) return null;
    const reasons = [];
    if (poolSize < requested) {
      reasons.push(`bare ${poolSize} ${label} passer dine valg (tilberedningstid, vanskelighet, allergier)`);
    }
    if (requested > days) {
      reasons.push(`uken har bare ${days} dager`);
    } else if (delivered < requested && poolSize >= requested) {
      reasons.push(`andre middagstyper tok plassen i ukeplanen`);
    }
    return reasons.join('; ');
  }

  const totalDelivered = actualFishQuota + actualVegQuota + actualVeganQuota + actualMeatQuota;

  if (!allergies.includes('fisk') && actualFishQuota < fishPerWeek) {
    compromises.push({
      type: 'fish',
      requested: fishPerWeek,
      provided: actualFishQuota,
      reason: buildReason(fishPerWeek, actualFishQuota, fishPool.length, 'fiskemiddager')
    });
  }
  if (actualVegQuota < vegetarianPerWeek) {
    compromises.push({
      type: 'vegetarian',
      requested: vegetarianPerWeek,
      provided: actualVegQuota,
      reason: buildReason(vegetarianPerWeek, actualVegQuota, vegPool.length, 'vegetarmiddager')
    });
  }
  if (actualVeganQuota < veganPerWeek) {
    compromises.push({
      type: 'vegan',
      requested: veganPerWeek,
      provided: actualVeganQuota,
      reason: buildReason(veganPerWeek, actualVeganQuota, veganPool.length, 'veganmiddager')
    });
  }
  if (totalDelivered < days) {
    compromises.push({
      type: 'days',
      requested: days,
      provided: totalDelivered,
      reason: `Bare ${pool.length} oppskrifter passer dine valg (tilberedningstid, vanskelighet, allergier) – ikke nok til å fylle ${days} dager`
    });
  }

  // ── Velg måltider ─────────────────────────────────────────────────────────
  const usedIds = new Set();

  // Fisk-velger respekterer likesEspecially-sortering (pool er allerede sortert)
  const fishOrder = likesEspecially ? fishPool : shuffle(fishPool);
  const selectedFish = fishOrder.slice(0, actualFishQuota);
  selectedFish.forEach(m => usedIds.add(m.id));

  const selectedVeg   = pickMeals(vegPool,   actualVegQuota,   usedIds, null, likesEspecially, leftovers, ratings);
  const selectedVegan = pickMeals(veganPool, actualVeganQuota, usedIds, null, likesEspecially, leftovers, ratings);
  const selectedMeat  = pickMeals(meatPool,  actualMeatQuota,  usedIds, null, likesEspecially, leftovers, ratings);

  // Sjekk om preferanse faktisk ble oppfylt etter alt; hvis ikke, vis kompromiss
  if (likesEspecially) {
    const allSelected = [...selectedFish, ...selectedVeg, ...selectedVegan, ...selectedMeat];
    const hasMatch = allSelected.some(m => likeScore(m, likesEspecially) > 0);
    const matchInFullPool = pool.some(m => likeScore(m, likesEspecially) > 0);
    const matchInAllMeals = MEALS.some(m => likeScore(m, likesEspecially) > 0);
    const alreadyHasPrefCompromise = compromises.some(c => c.type === 'preference');

    if (!hasMatch && !alreadyHasPrefCompromise) {
      if (!matchInAllMeals) {
        compromises.push({
          type: 'preference',
          requested: likesEspecially,
          provided: 0,
          reason: `Ingen oppskrifter i databasen matcher "${likesEspecially}". Prøv andre søkeord (f.eks. "indisk", "asiatisk", "italiensk").`
        });
      } else if (!matchInFullPool) {
        compromises.push({
          type: 'preference',
          requested: likesEspecially,
          provided: 0,
          reason: `Vi har "${likesEspecially}"-retter, men ingen passer dine valg av tilberedningstid, vanskelighet eller allergier.`
        });
      } else {
        compromises.push({
          type: 'preference',
          requested: likesEspecially,
          provided: 0,
          reason: `Ingen av de valgte middagene matcher "${likesEspecially}". Prøv å øke kvota for matchende type.`
        });
      }
    }
  }

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
