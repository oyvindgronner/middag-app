// mealdb-translate.js — oversetter TheMealDB-oppskrifter til norsk via Claude API
// Kjøres etter mealdb-seed.js: node mealdb-translate.js
// Krever: ANTHROPIC_API_KEY miljøvariabel

import fetch from 'node-fetch';
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('Mangler ANTHROPIC_API_KEY! Sett miljøvariabelen og prøv igjen.');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Claude API-kall ───────────────────────────────────────────────────────────

async function translateWithClaude(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 529 || res.status === 429) {
          console.warn(`  Rate limit, venter 10 s...`);
          await sleep(10000);
          continue;
        }
        throw new Error(`${res.status}: ${err}`);
      }
      const data = await res.json();
      return data.content[0].text.trim();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`  Feil (forsøk ${attempt}): ${err.message}, prøver igjen...`);
      await sleep(3000 * attempt);
    }
  }
}

// ── Batch-oversettelse av ett måltid ─────────────────────────────────────────

async function translateMeal(meal) {
  const stepsText = meal.recipe.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Oversett følgende til norsk bokmål for en norsk matoppskrift-app. Vær presis og bruk naturlig norsk kjøkkenterminologi.

OPPSKRIFTNAVN (1 linje):
${meal.name}

FREMGANGSMÅTE (${meal.recipe.steps.length} steg, behold nummereringen):
${stepsText}

Svar BARE med dette formatet (ingen forklaringer):
NAVN: [norsk navn]
STEG:
1. [norsk steg 1]
2. [norsk steg 2]
[osv.]`;

  const response = await translateWithClaude(prompt);

  // Parse svaret
  const nameMatch = response.match(/^NAVN:\s*(.+)$/m);
  const stegMatch = response.match(/^STEG:\s*\n([\s\S]+)$/m);

  if (!nameMatch || !stegMatch) {
    console.warn(`  Kunne ikke parse svar for "${meal.name}", beholder original`);
    return meal;
  }

  const norskNavn = nameMatch[1].trim();
  const norskSteg = stegMatch[1]
    .trim()
    .split(/\n/)
    .map(l => l.replace(/^\d+\.\s*/, '').trim())
    .filter(l => l.length > 5);

  if (norskSteg.length === 0) {
    console.warn(`  Ingen steg funnet for "${meal.name}", beholder original`);
    return meal;
  }

  return {
    ...meal,
    name: norskNavn,
    recipe: { ...meal.recipe, steps: norskSteg },
  };
}

// ── Les og parse meals-*.js ───────────────────────────────────────────────────

function readMealsFile(path) {
  const content = readFileSync(path, 'utf8');
  // Evaluer som ES-modul via JSON-parse av den serialiserte konstanten
  // Trekk ut arrayet mellom export const X = [ ... ];
  const match = content.match(/export const \w+ = (\[[\s\S]+\]);?\s*$/);
  if (!match) throw new Error(`Kan ikke parse ${path}`);
  // Konverter JS-objekt-syntax til JSON-kompatibel syntax
  const jsObj = match[1]
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // unquoted keys
    .replace(/:\s*null\b/g, ': null')
    .replace(/:\s*true\b/g, ': true')
    .replace(/:\s*false\b/g, ': false')
    .replace(/,\s*([\]}])/g, '$1'); // trailing commas
  try {
    return JSON.parse(jsObj);
  } catch (e) {
    throw new Error(`JSON-parse feil i ${path}: ${e.message}`);
  }
}

// ── Skriv tilbake ─────────────────────────────────────────────────────────────

function mealToJs(meal) {
  return '  ' + JSON.stringify(meal, null, 4)
    .replace(/"([a-zA-Z_][a-zA-Z0-9_]*)"\s*:/g, '$1:')
    .replace(/\n/g, '\n  ') + ',\n\n';
}

function writeFile(path, exportName, meals) {
  const content =
    `// ${path.split('/').pop()} — oversatt til norsk av mealdb-translate.js (${new Date().toISOString().slice(0, 10)})\n\n` +
    `export const ${exportName} = [\n\n` +
    meals.map(mealToJs).join('') +
    `];\n`;
  writeFileSync(path, content, 'utf8');
}

// ── Hoved ─────────────────────────────────────────────────────────────────────

const FILES = [
  { path: 'meals/meals-fish.js',         export: 'FISH_MEALS' },
  { path: 'meals/meals-meat.js',         export: 'MEAT_MEALS' },
  { path: 'meals/meals-vegetarian.js',   export: 'VEG_MEALS' },
  { path: 'meals/meals-vegan.js',        export: 'VEGAN_MEALS' },
];

async function run() {
  console.log('🌍 Oversetter oppskrifter til norsk...\n');

  for (const { path, export: exportName } of FILES) {
    let meals;
    try {
      meals = readMealsFile(path);
    } catch (e) {
      console.error(`Kan ikke lese ${path}: ${e.message}`);
      continue;
    }

    console.log(`📄 ${path} — ${meals.length} oppskrifter`);
    const translated = [];

    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];
      process.stdout.write(`  [${i + 1}/${meals.length}] ${meal.name.slice(0, 50)}...`);
      try {
        const t = await translateMeal(meal);
        translated.push(t);
        console.log(` → ${t.name}`);
      } catch (err) {
        console.warn(`\n  FEIL: ${err.message} — beholder original`);
        translated.push(meal);
      }
      // Litt pause mellom kall for å unngå rate-limiting
      if (i < meals.length - 1) await sleep(800);
    }

    writeFile(path, exportName, translated);
    console.log(`  ✅ Lagret ${translated.length} oversatte oppskrifter til ${path}\n`);

    // Pause mellom filer
    await sleep(2000);
  }

  console.log('✅ Ferdig! Restart backend: pm2 restart middag-backend');
}

run().catch(err => { console.error('Kritisk feil:', err); process.exit(1); });
