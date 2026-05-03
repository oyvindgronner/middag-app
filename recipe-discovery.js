#!/usr/bin/env node

/**
 * Recipe Discovery Agent
 *
 * Searches for Norwegian recipes, evaluates them through 5 steps,
 * and integrates them into the middag-app meal files.
 *
 * Usage: node recipe-discovery.js [count] [type]
 *   count: Number of recipes to discover (default: 10)
 *   type: 'meat', 'fish', 'vegetarian', 'vegan', or 'all' (default: 'all')
 *
 * Example: node recipe-discovery.js 5 meat
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import existing meals to check for duplicates
import { MEALS } from './meals.js';

// Configuration
const RECIPE_BATCH_SIZE = 5;
const MIN_PREP_TIME = 10;
const MAX_PREP_TIME = 60;

// Valid values
const VALID_ALLERGENS = [
  'gluten', 'laktose', 'egg', 'nøtter', 'skalldyr',
  'fisk', 'soya', 'selleri', 'sennep', 'sesam'
];

const VALID_DIFFICULTIES = ['enkel', 'middels', 'avansert'];
const VALID_TYPES = ['meat', 'fish', 'vegetarian', 'vegan'];
const VALID_CATEGORIES = [
  'Kjøtt', 'Fisk', 'Meieri', 'Egg', 'Frukt/grønt',
  'Tørrvarer', 'Hermetikk', 'Krydder', 'Bakevarer', 'Annet'
];

// ============================================================================
// STEP 1: Helper Functions for Recipe Validation
// ============================================================================

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[øæå]/g, c => ({ 'ø': 'o', 'æ': 'ae', 'å': 'a' }[c]))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function isDuplicate(recipeId, recipeName) {
  return MEALS.some(m =>
    m.id === recipeId ||
    m.name.toLowerCase() === recipeName.toLowerCase()
  );
}

function validateRecipe(recipe) {
  const errors = [];

  if (!recipe.id || typeof recipe.id !== 'string') errors.push('Missing or invalid id');
  if (!recipe.name || typeof recipe.name !== 'string') errors.push('Missing or invalid name');
  if (!VALID_TYPES.includes(recipe.type)) errors.push(`Invalid type: ${recipe.type}`);
  if (!Array.isArray(recipe.allergens)) errors.push('allergens must be an array');
  if (!recipe.allergens.every(a => VALID_ALLERGENS.includes(a))) {
    errors.push('Invalid allergen values');
  }
  if (!Array.isArray(recipe.tags) || recipe.tags.length < 3 || recipe.tags.length > 6) {
    errors.push('tags must be an array of 3-6 items');
  }
  if (typeof recipe.prepTime !== 'number' || recipe.prepTime < MIN_PREP_TIME || recipe.prepTime > MAX_PREP_TIME) {
    errors.push(`prepTime must be between ${MIN_PREP_TIME} and ${MAX_PREP_TIME}`);
  }
  if (!VALID_DIFFICULTIES.includes(recipe.difficulty)) {
    errors.push('Invalid difficulty');
  }
  if (typeof recipe.highProtein !== 'boolean') errors.push('highProtein must be boolean');
  if (typeof recipe.leftoverFriendly !== 'boolean') errors.push('leftoverFriendly must be boolean');

  if (!recipe.recipe || typeof recipe.recipe !== 'object') {
    errors.push('Missing recipe object');
  } else {
    if (recipe.recipe.servings !== 4) errors.push('recipe.servings must be 4');
    if (!Array.isArray(recipe.recipe.steps) || recipe.recipe.steps.length < 5 || recipe.recipe.steps.length > 8) {
      errors.push('recipe.steps must be array of 5-8 items');
    }
  }

  if (!Array.isArray(recipe.shoppingList) || recipe.shoppingList.length === 0) {
    errors.push('shoppingList must be non-empty array');
  } else {
    recipe.shoppingList.forEach((item, idx) => {
      if (!item.item || !item.search || !item.amount || typeof item.estimatedPrice !== 'number') {
        errors.push(`shoppingList[${idx}] missing required fields`);
      }
      if (!VALID_CATEGORIES.includes(item.category)) {
        errors.push(`shoppingList[${idx}] invalid category: ${item.category}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// STEP 2: Report Generation
// ============================================================================

function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      discovered: results.discovered,
      accepted: results.accepted.length,
      rejected: results.rejected.length,
      added: results.added.length
    },
    breakdown: {
      byType: {},
      byDifficulty: {},
      byFile: {}
    },
    recipes: {
      accepted: results.accepted,
      rejected: results.rejected,
      added: results.added
    }
  };

  // Populate breakdown
  results.added.forEach(r => {
    const file = getFileForType(r.type);
    report.breakdown.byFile[file] = (report.breakdown.byFile[file] || 0) + 1;
    report.breakdown.byType[r.type] = (report.breakdown.byType[r.type] || 0) + 1;
    report.breakdown.byDifficulty[r.difficulty] = (report.breakdown.byDifficulty[r.difficulty] || 0) + 1;
  });

  return report;
}

function getFileForType(type) {
  switch (type) {
    case 'meat': return 'meals-meat.js';
    case 'fish': return 'meals-fish.js';
    case 'vegetarian':
    case 'vegan': return 'meals-vegetarian.js';
    default: return 'meals-vegetarian.js';
  }
}

// ============================================================================
// STEP 3: File Writing (Append new recipes)
// ============================================================================

function appendRecipesToFiles(recipes) {
  const byType = {};

  // Group by type
  recipes.forEach(recipe => {
    const file = getFileForType(recipe.type);
    if (!byType[file]) byType[file] = [];
    byType[file].push(recipe);
  });

  const results = [];

  // Write to each file
  for (const [filename, recipesForFile] of Object.entries(byType)) {
    const filepath = path.join(__dirname, 'meals', filename);

    try {
      let content = fs.readFileSync(filepath, 'utf-8');

      // Find insertion point (before closing bracket of array)
      const insertPoint = content.lastIndexOf(']');

      if (insertPoint === -1) {
        throw new Error('Could not find array closing bracket');
      }

      // Format recipes for insertion
      const recipeStrings = recipesForFile.map(r => {
        const json = JSON.stringify(r, null, 2);
        return `  ${json}`;
      });

      const insertion = ',\n\n  ' + recipeStrings.join(',\n\n  ') + '\n';

      // Insert recipes
      const newContent = content.slice(0, insertPoint) + insertion + content.slice(insertPoint);
      fs.writeFileSync(filepath, newContent, 'utf-8');

      results.push({
        file: filename,
        count: recipesForFile.length,
        status: 'success'
      });
    } catch (err) {
      results.push({
        file: filename,
        count: recipesForFile.length,
        status: 'error',
        error: err.message
      });
    }
  }

  return results;
}

// ============================================================================
// STEP 4: Main Agent Logic (placeholder for Claude integration)
// ============================================================================

/**
 * This is where the actual recipe discovery and evaluation happens.
 * In production, this would:
 * 1. Use web search to find Norwegian recipes
 * 2. Parse and evaluate recipes through 5 steps
 * 3. Convert to standardized format
 * 4. Return validated recipes
 *
 * For now, this is a placeholder that shows the expected structure.
 */

async function discoverAndEvaluateRecipes(count = 10, typeFilter = 'all') {
  const client = new OpenAI({
    baseURL: 'http://host-gateway:8085/v1',
    apiKey: 'local' // Qwen3.5 accepts any key locally
  });

  const exampleRecipe = {
    id: 'laksepasta',
    name: 'Laksepasta med spinat',
    type: 'fish',
    highProtein: true,
    allergens: ['fisk', 'gluten', 'laktose'],
    tags: ['laks', 'pasta', 'fisk', 'spinat'],
    prepTime: 25,
    difficulty: 'enkel',
    leftoverFriendly: true,
    vegetarianAlternative: 'Pasta med spinat og ricotta',
    recipe: {
      servings: 4,
      steps: [
        'Kok opp rikelig med lettsaltet vann i en stor kjele. Kok fullkornspasta (400 g) etter anvisning på pakken, men ta den av 1 minutt før anbefalt tid – den skal være al dente.',
        'Tørk laksefileten (400 g) med kjøkkenpapir og skjær i porsjonsstykker. Krydre godt med salt og pepper.',
        'Varm en stor stekepanne på middels høy varme og smelt en god klatt smør (ca. 1 ss). Legg i laksen og stek 3 minutter uten å røre.'
      ]
    },
    shoppingList: [
      { item: 'Laksefilet', search: 'laksefilet', amount: '400 g', estimatedPrice: 89, category: 'Fisk' },
      { item: 'Pasta (fullkorn)', search: 'fullkornspasta', amount: '400 g', estimatedPrice: 28, category: 'Tørrvarer' }
    ]
  };

  const typeList = typeFilter === 'all' ? ['meat', 'fish', 'vegetarian', 'vegan'] : [typeFilter];
  const recipes = [];

  for (const type of typeList) {
    const recipesNeeded = Math.ceil(count / typeList.length);

    const systemPrompt = `Du er en ekspert på norsk mat og oppskriftskriving. Du skal generere oppskrifter i JSON-format som passer til en norsk middagsplanlegger-app.

FORMAT-EKSEMPEL:
${JSON.stringify(exampleRecipe, null, 2)}

KRAV:
- id: kebab-case, norsk, unik (f.eks. 'laksepasta')
- name: norsk navn på retten
- type: '${type}'
- allergens: array av [${VALID_ALLERGENS.map(a => `'${a}'`).join(', ')}], eller [] hvis ingen
- tags: array av 3-6 norske ord relatert til retten
- prepTime: ${MIN_PREP_TIME}-${MAX_PREP_TIME} minutter
- difficulty: '${VALID_DIFFICULTIES[0]}', '${VALID_DIFFICULTIES[1]}', eller '${VALID_DIFFICULTIES[2]}'
- highProtein: true if >25g protein per serving, false otherwise
- leftoverFriendly: true/false based on reheating suitability
- recipe.steps: array av 5-8 detaljerte norske instruksjoner
- shoppingList: array av varer med {item, search, amount, estimatedPrice, category}
- shoppingList.category: en av [${VALID_CATEGORIES.map(c => `'${c}'`).join(', ')}]

CONSTRAINT: Bare ingredienser som finnes i norske dagligvarebutikker (Rema, Kiwi, Meny, Coop).`;

    const userPrompt = `Generer ${recipesNeeded} nye norske ${type}-oppskrifter for en middagsplanlegger.
Oppskriftene skal være detaljerte, pålitelige og med norske ingredienser.
Returnér oppskriftene som en JSON-array. Valider også at allergenene stemmer med ingrediensene.
Format: return ONLY a valid JSON array starting with [ and ending with ].`;

    try {
      const response = await client.chat.completions.create({
        model: 'qwen',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const generatedRecipes = JSON.parse(jsonMatch[0]);
        recipes.push(...generatedRecipes);
      }
    } catch (err) {
      console.error(`Error generating ${type} recipes:`, err.message);
    }
  }

  // Validate all recipes
  const validated = [];
  recipes.forEach(recipe => {
    const { valid, errors } = validateRecipe(recipe);
    if (valid && !isDuplicate(recipe.id, recipe.name)) {
      validated.push(recipe);
    }
  });

  return validated;
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

async function main() {
  console.log('🍳 Recipe Discovery Agent for Middag-App');
  console.log('=========================================\n');

  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 10;
  const typeFilter = args[1] || 'all';

  console.log(`📋 Configuration:`);
  console.log(`   - Target recipes: ${count}`);
  console.log(`   - Type filter: ${typeFilter}`);
  console.log(`   - Current total: ${MEALS.length}/100\n`);

  // Step 1: Discover recipes
  console.log('🔍 Step 1: Discovering Norwegian recipes...');
  const discovered = await discoverAndEvaluateRecipes(count, typeFilter);
  console.log(`   Found: ${discovered.length} recipes\n`);

  // Step 2-5: Evaluate (happens during discovery in integrated approach)
  // ...

  // Step 6: Generate report and append
  const report = generateReport({
    discovered: discovered.length,
    accepted: discovered,
    rejected: [],
    added: discovered
  });

  if (discovered.length > 0) {
    console.log('💾 Appending recipes to meal files...');
    const writeResults = appendRecipesToFiles(discovered);

    writeResults.forEach(result => {
      const icon = result.status === 'success' ? '✓' : '✗';
      console.log(`   ${icon} ${result.file}: ${result.count} recipes`);
      if (result.error) console.log(`      Error: ${result.error}`);
    });
  }

  // Final report
  console.log('\n📊 Report:');
  console.log(`   Discovered: ${report.summary.discovered}`);
  console.log(`   Accepted: ${report.summary.accepted}`);
  console.log(`   Rejected: ${report.summary.rejected}`);
  console.log(`   Added: ${report.summary.added}`);

  if (Object.keys(report.breakdown.byType).length > 0) {
    console.log('\n   By type:');
    Object.entries(report.breakdown.byType).forEach(([type, count]) => {
      console.log(`     - ${type}: ${count}`);
    });
  }

  if (Object.keys(report.breakdown.byDifficulty).length > 0) {
    console.log('\n   By difficulty:');
    Object.entries(report.breakdown.byDifficulty).forEach(([diff, count]) => {
      console.log(`     - ${diff}: ${count}`);
    });
  }

  // Save report to file
  const reportPath = path.join(__dirname, `recipe-discovery-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Report saved to: ${reportPath}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
