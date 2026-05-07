// Unit tests for planner.js / selectMeals()
// Kjør med: npm test (eller: node --test test/)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectMeals } from '../planner.js';
import { MEALS } from '../meals.js';

// Helper: sjekker om et søkeord matcher en oppskrift (samme logikk som planner.likeScore)
const matches = (meal, term) => {
  const haystack = [meal.name, ...meal.tags, ...meal.shoppingList.map(i => i.item)]
    .join(' ').toLowerCase();
  return haystack.includes(term.toLowerCase());
};

// Helper: standard-parametre for å gjøre tester kompakte
const params = (overrides = {}) => ({
  days: 5,
  persons: 2,
  fishPerWeek: 0,
  vegetarianPerWeek: 0,
  veganPerWeek: 0,
  cookTime: 60,
  difficulty: 'avansert',
  allergies: [],
  likesEspecially: '',
  dontWant: '',
  leftovers: false,
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
describe('A. Kvota-kompromisser', () => {
  test('QC-1: fishPerWeek over days gir fish-kompromiss', () => {
    const meals = selectMeals(params({ days: 5, fishPerWeek: 10 }));
    const c = meals._compromises?.find(c => c.type === 'fish');
    assert.ok(c, 'should have fish compromise');
    assert.equal(c.requested, 10);
    assert.ok(c.provided <= 5, `provided (${c.provided}) should be ≤ 5`);
    assert.match(c.reason, /5 dager/);
  });

  test('QC-2: vegetarianPerWeek over days gir vegetarian-kompromiss', () => {
    const meals = selectMeals(params({ days: 7, vegetarianPerWeek: 8 }));
    const c = meals._compromises?.find(c => c.type === 'vegetarian');
    assert.ok(c, 'should have vegetarian compromise');
    assert.equal(c.requested, 8);
    assert.ok(c.provided <= 7);
  });

  test('QC-3: veganPerWeek over pool-størrelse gir vegan-kompromiss', () => {
    const veganPoolSize = MEALS.filter(m => m.type === 'vegan').length;
    const meals = selectMeals(params({ days: 7, veganPerWeek: veganPoolSize + 50 }));
    const c = meals._compromises?.find(c => c.type === 'vegan');
    assert.ok(c, 'should have vegan compromise');
    assert.ok(c.provided <= veganPoolSize);
  });

  test('QC-4: realistiske defaults gir ingen kompromiss', () => {
    const meals = selectMeals(params({
      days: 7, fishPerWeek: 2, vegetarianPerWeek: 1, veganPerWeek: 0,
      cookTime: 60, difficulty: 'enkel',
    }));
    assert.equal(meals._compromises, null, 'no compromises expected');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('B. Filter-kompromisser', () => {
  test('F-1: cookTime=15 + alle quotas=0 gir days-kompromiss', () => {
    const meals = selectMeals(params({
      days: 5, cookTime: 15, difficulty: 'enkel',
      fishPerWeek: 0, vegetarianPerWeek: 0, veganPerWeek: 0,
    }));
    assert.ok(meals.length < 5, 'should deliver < 5 meals');
    const c = meals._compromises?.find(c => c.type === 'days');
    assert.ok(c, 'should have days compromise');
    assert.equal(c.requested, 5);
  });

  test('F-2: gluten+laktose-allergi + 4 vegetar gir kompromiss', () => {
    const meals = selectMeals(params({
      days: 7, allergies: ['gluten', 'laktose'],
      vegetarianPerWeek: 4, cookTime: 30, difficulty: 'enkel',
    }));
    const hasComp = meals._compromises?.some(
      c => c.type === 'vegetarian' || c.type === 'days'
    );
    assert.ok(hasComp, 'should have vegetarian or days compromise');
  });

  test('F-3: fisk-allergi + fishPerWeek=3 gir 0 fish, ingen fish-kompromiss', () => {
    const meals = selectMeals(params({
      days: 5, allergies: ['fisk'], fishPerWeek: 3,
      cookTime: 60, difficulty: 'enkel',
    }));
    const fishCount = meals.filter(m => m.type === 'fish').length;
    assert.equal(fishCount, 0, 'no fish meals when fisk-allergi');
    const fishComp = meals._compromises?.find(c => c.type === 'fish');
    assert.ok(!fishComp, 'no fish compromise (allergi er hard regel)');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('C. Tilberedningstid + Vanskelighet respekteres', () => {
  test('TF-1: cookTime=30 → alle prepTime ≤ 30', () => {
    const meals = selectMeals(params({ cookTime: 30, days: 5, fishPerWeek: 2, vegetarianPerWeek: 1 }));
    for (const m of meals) {
      assert.ok(m.prepTime <= 30, `${m.name} har prepTime=${m.prepTime}`);
    }
  });

  test('TF-2: cookTime=45 → alle prepTime ≤ 45 (cookTime≥60 er "ingen grense" by design)', () => {
    const meals = selectMeals(params({ cookTime: 45, days: 7, fishPerWeek: 2, vegetarianPerWeek: 1 }));
    for (const m of meals) {
      assert.ok(m.prepTime <= 45, `${m.name} har prepTime=${m.prepTime}`);
    }
  });

  test('TF-3: difficulty=enkel → ingen avansert', () => {
    const meals = selectMeals(params({ difficulty: 'enkel', days: 7, fishPerWeek: 2, vegetarianPerWeek: 1, veganPerWeek: 1 }));
    for (const m of meals) {
      assert.notEqual(m.difficulty, 'avansert', `${m.name} er avansert`);
    }
  });

  test('TF-4: cookTime=15 → alle ≤ 15', () => {
    const meals = selectMeals(params({ cookTime: 15, days: 5, fishPerWeek: 5 }));
    for (const m of meals) {
      assert.ok(m.prepTime <= 15, `${m.name} har prepTime=${m.prepTime}`);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('D. Allergi-filtrering', () => {
  test('AL-1: gluten-allergi → ingen returnert har gluten i allergens', () => {
    const meals = selectMeals(params({
      days: 7, allergies: ['gluten'],
      fishPerWeek: 2, vegetarianPerWeek: 1, veganPerWeek: 1,
    }));
    for (const m of meals) {
      assert.ok(!m.allergens.includes('gluten'), `${m.name} har gluten`);
    }
  });

  test('AL-2: fisk-allergi → ingen type=fish', () => {
    const meals = selectMeals(params({
      days: 7, allergies: ['fisk'],
      fishPerWeek: 5, vegetarianPerWeek: 1,
    }));
    const fishCount = meals.filter(m => m.type === 'fish').length;
    assert.equal(fishCount, 0);
  });

  test('AL-3: gluten+laktose+egg → ingen returnert har noen av dem', () => {
    const meals = selectMeals(params({
      days: 5, allergies: ['gluten', 'laktose', 'egg'],
      fishPerWeek: 1, vegetarianPerWeek: 0, veganPerWeek: 1,
    }));
    for (const m of meals) {
      for (const a of ['gluten', 'laktose', 'egg']) {
        assert.ok(!m.allergens.includes(a), `${m.name} har ${a}`);
      }
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('E. Preferanse + smart-bytte', () => {
  test('P-1: 1 dag + indisk + default fish-quota → indisk vegetar via smart-bytte', () => {
    const meals = selectMeals(params({
      days: 1, fishPerWeek: 2, vegetarianPerWeek: 1, veganPerWeek: 0,
      cookTime: 30, difficulty: 'enkel', likesEspecially: 'indisk',
    }));
    assert.equal(meals.length, 1);
    assert.ok(matches(meals[0], 'indisk'), `${meals[0].name} matcher ikke indisk`);
    const prefComp = meals._compromises?.find(c => c.type === 'preference');
    assert.ok(prefComp, 'should have preference compromise');
    assert.match(prefComp.reason, /Byttet ut/);
  });

  test('P-2: 5 dager + indisk → ≥1 indisk rett, ingen preference-kompromiss', () => {
    const meals = selectMeals(params({
      days: 5, fishPerWeek: 2, vegetarianPerWeek: 1, veganPerWeek: 0,
      cookTime: 30, difficulty: 'enkel', likesEspecially: 'indisk',
    }));
    const indianCount = meals.filter(m => matches(m, 'indisk')).length;
    assert.ok(indianCount >= 1, 'expected ≥1 indisk meal');
    const prefComp = meals._compromises?.find(c => c.type === 'preference');
    assert.ok(!prefComp, 'no preference compromise expected');
  });

  test('P-3: ukjent søkeord → preference-kompromiss "ikke i databasen"', () => {
    const meals = selectMeals(params({
      days: 5, fishPerWeek: 2, vegetarianPerWeek: 1,
      cookTime: 60, difficulty: 'avansert', likesEspecially: 'mexicansk',
    }));
    const c = meals._compromises?.find(c => c.type === 'preference');
    assert.ok(c, 'should have preference compromise');
    assert.match(c.reason, /databasen/);
  });

  test('P-4: thai + cookTime=15 → preference-kompromiss "passer ikke"', () => {
    const meals = selectMeals(params({
      days: 5, fishPerWeek: 2, vegetarianPerWeek: 1,
      cookTime: 15, difficulty: 'enkel', likesEspecially: 'thai',
    }));
    const c = meals._compromises?.find(c => c.type === 'preference');
    assert.ok(c, 'should have preference compromise');
    assert.match(c.reason, /passer (ikke )?dine valg|databasen/);
  });

  test('P-5: asiatisk + fishPerWeek=2 → fisk respekterer preferanse', () => {
    let asiatiskFishCount = 0;
    for (let i = 0; i < 3; i++) {
      const meals = selectMeals(params({
        days: 1, fishPerWeek: 2, vegetarianPerWeek: 0, veganPerWeek: 0,
        cookTime: 60, difficulty: 'enkel', likesEspecially: 'asiatisk',
      }));
      if (meals.some(m => m.type === 'fish' && matches(m, 'asiatisk'))) {
        asiatiskFishCount++;
      }
    }
    assert.equal(asiatiskFishCount, 3, 'fish-velger skal være deterministisk asiatisk');
  });

  test('P-6: ingen preferanse → ingen preference-kompromiss', () => {
    const meals = selectMeals(params({
      days: 5, fishPerWeek: 2, vegetarianPerWeek: 1,
      cookTime: 60, difficulty: 'enkel',
    }));
    const c = meals._compromises?.find(c => c.type === 'preference');
    assert.ok(!c, 'no preference compromise without likesEspecially');
  });

  test('P-6b: ingen preferanse → fisk varieres mellom kall (shuffle aktiv)', () => {
    const seen = new Set();
    for (let i = 0; i < 10; i++) {
      const meals = selectMeals(params({
        days: 7, fishPerWeek: 5, cookTime: 60, difficulty: 'enkel',
      }));
      meals.filter(m => m.type === 'fish').forEach(m => seen.add(m.id));
    }
    assert.ok(seen.size >= 5, `forventet ≥ 5 unike fisk over 10 kall, fikk ${seen.size}`);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('F. Edge cases', () => {
  test('E-1: days=30 → ≤ 30 retter, ingen krasj', () => {
    const meals = selectMeals(params({
      days: 30, fishPerWeek: 5, vegetarianPerWeek: 5, veganPerWeek: 5,
      cookTime: 60, difficulty: 'avansert',
    }));
    assert.ok(meals.length <= 30);
    assert.ok(meals.length > 0);
  });

  test('E-2: days=1 + alle quotas=0 → 1 kjøttrett', () => {
    const meals = selectMeals(params({
      days: 1, fishPerWeek: 0, vegetarianPerWeek: 0, veganPerWeek: 0,
      cookTime: 60, difficulty: 'enkel',
    }));
    assert.equal(meals.length, 1);
    assert.equal(meals[0].type, 'meat');
  });

  test('E-3: dontWant=kikerter → ingen returnert har "kikerter"', () => {
    const meals = selectMeals(params({
      days: 7, fishPerWeek: 2, vegetarianPerWeek: 2, veganPerWeek: 1,
      cookTime: 60, difficulty: 'enkel', dontWant: 'kikerter',
    }));
    for (const m of meals) {
      const haystack = [m.name, ...m.tags, ...m.shoppingList.map(i => i.item)]
        .join(' ').toLowerCase();
      assert.ok(!haystack.includes('kikerter'), `${m.name} inneholder kikerter`);
    }
  });

  test('E-4: umulig kombinasjon (alle allergier + cookTime=15) → tom array eller få retter', () => {
    const meals = selectMeals(params({
      days: 5, allergies: ['gluten', 'laktose', 'egg', 'fisk', 'soya'],
      cookTime: 15, difficulty: 'enkel',
      fishPerWeek: 0, vegetarianPerWeek: 0, veganPerWeek: 0,
    }));
    // Skal ikke krasje. Akseptabelt med 0 eller veldig få.
    assert.ok(Array.isArray(meals));
    assert.ok(meals.length <= 5);
  });

  test('E-5: scaleRecipe — persons=2 skalerer ingredienser', () => {
    const meals = selectMeals(params({
      days: 1, persons: 2, fishPerWeek: 0, vegetarianPerWeek: 0, veganPerWeek: 0,
      cookTime: 60, difficulty: 'enkel',
    }));
    assert.equal(meals[0].recipe.servings, 2);
  });
});
