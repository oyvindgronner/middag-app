// scale-recipe.js — Skaler oppskrifter basert på antall personer

/**
 * Skaler en oppskrift fra en størrelse til en annen
 * @param {Object} meal - Måltid-objektet med recipe og shoppingList
 * @param {number} originalServings - Antall porsjoner i original recipe
 * @param {number} newServings - Ønsket antall porsjoner
 * @returns {Object} Skalert måltid
 */
export function scaleRecipe(meal, originalServings, newServings) {
  if (originalServings === newServings) return meal;
  if (originalServings <= 0) return meal;

  const scaleFactor = newServings / originalServings;

  return {
    ...meal,
    shoppingList: meal.shoppingList.map(item => ({
      ...item,
      amount: scaleAmountText(item.amount, scaleFactor),
      estimatedPrice: Math.round(item.estimatedPrice * scaleFactor),
    })),
    recipe: {
      ...meal.recipe,
      servings: newServings,
      steps: meal.recipe.steps.map(step => scaleStepText(step, scaleFactor)),
    },
  };
}

/**
 * Skaler mengde-tekst fra shoppingList (f.eks "400 g", "3 stk", "2 dl")
 */
function scaleAmountText(amount, scaleFactor) {
  if (!amount || scaleFactor === 1) return amount;

  // Håndter formater som "400 g", "3 stk", "250 ml", "2 dl", "1 bunt", osv.
  const match = amount.match(/^([\d.,½¾]+)\s*(.*)$/);
  if (!match) return amount;

  const [, numStr, unit] = match;
  const num = parseFloat(numStr.replace(',', '.'));

  if (isNaN(num)) return amount;

  const scaled = num * scaleFactor;
  const formatted = formatNumber(scaled);

  return formatted + (unit ? ' ' + unit : '');
}

/**
 * Skaler tallverdier i en steg-tekst (gram, dl, ss, ts, etc.)
 * Håndterer: "400 g", "3 dl", "2 ss", "1 ts", "½", "¾", osv.
 */
function scaleStepText(step, scaleFactor) {
  if (scaleFactor === 1) return step;

  // Regex for tall + enhet kombinasjoner
  const patterns = [
    // "400 g", "3 dl", "2 ss", "1 ts"
    { regex: /(\d+(?:[.,]\d+)?)\s*(g|dl|cl|l|ml|ss|ts|stk|pk)/gi, handler: (match, num, unit) => {
      const scaled = parseFloat(num.replace(',', '.')) * scaleFactor;
      return formatNumber(scaled) + ' ' + unit;
    }},
    // Halve og kvartal: "½", "¾"
    { regex: /([½¾⅓⅔])/g, handler: (match) => {
      const fractions = { '½': 0.5, '¾': 0.75, '⅓': 0.333, '⅔': 0.667 };
      const scaled = fractions[match] * scaleFactor;
      return formatFraction(scaled);
    }},
  ];

  let result = step;
  for (const { regex, handler } of patterns) {
    result = result.replace(regex, handler);
  }

  return result;
}

/**
 * Formater tall som pent lesbar mengde
 * "0.75" → "¾", "1.5" → "1½", osv.
 */
function formatNumber(num) {
  if (num <= 0) return '0';

  const rounded = Math.round(num * 4) / 4; // Rund til nærmeste kvart

  // Konverter til brøk hvis det gir mening
  if (rounded % 1 === 0.5) {
    return Math.floor(rounded) + '½';
  }
  if (rounded % 1 === 0.75) {
    return Math.floor(rounded) + '¾';
  }
  if (rounded % 1 === 0.25) {
    const whole = Math.floor(rounded);
    return whole > 0 ? whole + '¼' : '¼';
  }
  if (rounded % 1 === 0) {
    return rounded.toString();
  }

  // Returner som desimal hvis det ikke passer til brøk
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Formater brøker
 */
function formatFraction(num) {
  if (num <= 0) return '0';

  const frac = Math.round(num * 4) / 4;
  const whole = Math.floor(frac);
  const remainder = frac - whole;

  const fractionMap = {
    0.25: '¼',
    0.5: '½',
    0.75: '¾',
    0.333: '⅓',
    0.667: '⅔',
  };

  const fracStr = fractionMap[Math.round(remainder * 1000) / 1000] || '';
  return whole > 0 ? whole + fracStr : fracStr;
}
