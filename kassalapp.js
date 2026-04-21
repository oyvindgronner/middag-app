// kassalapp.js — prioppslag via kassal.app API med per-butikk-sammenligning

import fetch from 'node-fetch';

const KASSAL_BASE  = 'https://kassal.app/api/v1';
const API_KEY      = process.env.KASSALAPP_API_KEY;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 timer

// Cache: søkeord → { byStore: Map<storeName, {price, unitPrice}>, ts }
const searchCache = new Map();

// Normaliser butikknavn fra API til visningsnavn
function normStore(raw) {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  const MAP = {
    'rema 1000': 'REMA 1000', 'rema': 'REMA 1000', 'rema1000': 'REMA 1000',
    'kiwi': 'Kiwi',
    'meny': 'Meny',
    'spar': 'Spar',
    'extra': 'Extra',
    'obs': 'Obs',
    'bunnpris': 'Bunnpris',
    'joker': 'Joker',
    'coop': 'Coop',
    'oda': 'Oda',
    'mega': 'Mega',
    'coop prix': 'Coop Prix',
  };
  return MAP[n] ?? raw.trim();
}

// Trekk ut gram fra mengde-streng: "400 g" → 400, "1 kg" → 1000, null hvis ukjent
function parseGrams(amountStr) {
  if (!amountStr) return null;
  const m = amountStr.match(/([0-9]+(?:[.,][0-9]+)?)\s*(g|kg)\b/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return m[2].toLowerCase() === 'kg' ? v * 1000 : v;
}

// Hent priser per butikk for et søkeord
async function fetchStorePrices(query) {
  const key = query.toLowerCase().trim();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.byStore;

  const byStore = new Map(); // storeName → { price, unitPrice }
  if (!API_KEY) return byStore;

  try {
    const url = `${KASSAL_BASE}/products?search=${encodeURIComponent(query)}&size=60`;
    const res  = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal:  AbortSignal.timeout(5000),
    });
    if (!res.ok) { console.warn(`[kassal] ${res.status} for "${query}"`); return byStore; }

    const data     = await res.json();
    const products = data.data ?? [];

    // Bygg et sett med søkeord for relevanssjekk
    const searchWords = key.split(/\s+/).filter(w => w.length > 2);

    for (const p of products) {
      const price     = p.current_price;
      const unitPrice = p.current_unit_price; // kr/kg
      const weight    = p.weight;             // gram
      const weightUnit = p.weight_unit?.toLowerCase();

      if (typeof price !== 'number' || price <= 0) continue;
      // Filtrer ut bulk (>2 kg) og mini-porsjoner (<80 g) for å unngå skjevhet
      if (weight && weightUnit === 'g' && (weight < 80 || weight > 2000)) continue;
      // Filtrer ut produkter der navn ikke inneholder noe av søkeordet
      const productName = (p.name || '').toLowerCase();
      if (searchWords.length > 0 && !searchWords.some(w => productName.includes(w))) continue;

      const storeName = normStore(p.store?.name);
      if (!storeName) continue;

      // Velg produkt med lavest enhetspris per butikk
      const existing = byStore.get(storeName);
      const betterUnit = !existing ||
        (unitPrice && (!existing.unitPrice || unitPrice < existing.unitPrice));
      const betterPrice = !existing || price < existing.price;

      if (betterUnit || (!unitPrice && betterPrice)) {
        byStore.set(storeName, { price: Math.round(price), unitPrice, name: p.name });
      }
    }

    searchCache.set(key, { byStore, ts: Date.now() });
  } catch (err) {
    console.warn(`[kassal] feil for "${query}": ${err.message}`);
  }
  return byStore;
}

// Beregn pris for én vare ved en butikk
function calcItemPrice(storeEntry, amountStr) {
  if (!storeEntry) return null;
  const grams = parseGrams(amountStr);
  if (grams && storeEntry.unitPrice) {
    // unitPrice er kr/kg → konverter til kr for mengden
    return Math.round((storeEntry.unitPrice / 1000) * grams);
  }
  return storeEntry.price;
}

/**
 * Beriker den samlede handlelisten og bygger butikksammenligning.
 *
 * Returnerer:
 * {
 *   items: [...enrichedShoppingList],   // med cheapestStore, cheapestPrice, storeBreakdown
 *   storeComparison: {
 *     recommendation: 'REMA 1000',
 *     cheapestTotal: 450,
 *     storeRanking: [{store, total, extra}],   // sortert billigst → dyrest
 *     savingsVsMostExpensive: 120
 *   } | null
 * }
 */
export async function analyzeShoppingListPrices(shoppingList) {
  if (!API_KEY) return { items: shoppingList, storeComparison: null };

  // Hent alle unike søkeord parallelt
  const terms = [...new Set(
    shoppingList.filter(i => i.search).map(i => i.search.toLowerCase().trim())
  )];
  await Promise.all(terms.map(t => fetchStorePrices(t)));

  // Berik hvert element
  const enriched = shoppingList.map(item => {
    if (!item.search) return item;
    const byStore = searchCache.get(item.search.toLowerCase().trim())?.byStore;
    if (!byStore?.size) return item;

    const breakdown = {};  // storeName → pris for denne varen
    let cheapestStore = null;
    let cheapestPrice = Infinity;

    for (const [store, entry] of byStore) {
      const p = calcItemPrice(entry, item.amount);
      if (p == null) continue;
      breakdown[store] = p;
      if (p < cheapestPrice) { cheapestPrice = p; cheapestStore = store; }
    }

    if (!cheapestStore) return item;

    // Sanity-sjekk: hvis Kassal-prisen er mistenkelig lav ift. fallback-estimat, forkast den
    const fallback = item.estimatedPrice;
    if (fallback && cheapestPrice < fallback * 0.3) return item;

    const foundProduct = byStore.get(cheapestStore)?.name ?? null;

    return {
      ...item,
      estimatedPrice: cheapestPrice,
      cheapestStore,
      foundProduct,
      storeBreakdown: breakdown,
    };
  });

  // ── Bygg butikksammenligning ──────────────────────────────────────────────
  const storeTotals  = new Map(); // storeName → sum
  const storeCounts  = new Map(); // storeName → antall varer med pris
  const searchable   = enriched.filter(i => i.search);

  for (const item of searchable) {
    if (!item.storeBreakdown) continue;
    for (const [store, price] of Object.entries(item.storeBreakdown)) {
      storeTotals.set(store, (storeTotals.get(store) ?? 0) + price);
      storeCounts.set(store, (storeCounts.get(store) ?? 0) + 1);
    }
  }

  // Bare ta med butikker som dekker minst 50 % av varene
  const threshold = Math.max(2, Math.ceil(searchable.length * 0.5));
  const ranked = [...storeTotals.entries()]
    .filter(([s]) => (storeCounts.get(s) ?? 0) >= threshold)
    .sort((a, b) => a[1] - b[1]);

  if (ranked.length < 2) return { items: enriched, storeComparison: null };

  const cheapest     = ranked[0];
  const mostExpensive = ranked[ranked.length - 1];

  const storeComparison = {
    recommendation:        cheapest[0],
    cheapestTotal:         cheapest[1],
    storeRanking:          ranked.map(([store, total]) => ({
      store,
      total,
      extra: total - cheapest[1],
    })),
    savingsVsMostExpensive: mostExpensive[1] - cheapest[1],
  };

  return { items: enriched, storeComparison };
}
