// meals.js — komplett måltidbatabase
// allergens-verdier matcher checkboxene i frontend:
// gluten | laktose | egg | nøtter | skalldyr | fisk | soya | selleri | sennep | sesam

import { FISH_MEALS }  from './meals/meals-fish.js';
import { MEAT_MEALS }  from './meals/meals-meat.js';
import { VEG_MEALS }   from './meals/meals-vegetarian.js';
import { VEGAN_MEALS } from './meals/meals-vegan.js';

export const MEALS = [...FISH_MEALS, ...MEAT_MEALS, ...VEG_MEALS, ...VEGAN_MEALS];
