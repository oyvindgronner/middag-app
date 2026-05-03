import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { selectMeals } from './planner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// ── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
app.use(helmet()); // Security headers: CSP, X-Frame-Options, X-Content-Type-Options, etc.

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── RATE LIMITING ───────────────────────────────────────────────────────────
// Beskytter API mot DoS-angrep og abuse
const mealPlanLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minutt
  max: 10,                  // Maks 10 requests per minutt per IP
  message: 'For mange requests til /api/meal-plan. Vent minst 60 sekunder før nytt forsøk.',
  standardHeaders: true,    // Returner rate limit info i `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for local development (localhost)
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

const feedbackLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minutt
  max: 5,                   // Maks 5 feedback per minutt per IP
  message: 'For mange feedback-submissions. Vent minst 60 sekunder før nytt forsøk.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Sorteringsrekkefølge for handleliste (tilsvarer butikkinnredning)
const CATEGORY_ORDER = ['Frukt/grønt', 'Meieri', 'Kjøtt', 'Fisk', 'Tørrvarer', 'Frys', 'Diverse'];

function sortByCategory(list) {
  return [...list].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function mergeShoppingList(meals) {
  const map = new Map();
  for (const meal of meals) {
    for (const item of meal.shoppingList) {
      if (map.has(item.item)) {
        const existing = map.get(item.item);
        existing.fromMeals = [...(existing.fromMeals || [meal.day]), meal.day];
      } else {
        map.set(item.item, { ...item, fromMeals: [meal.day] });
      }
    }
  }
  return sortByCategory([...map.values()]);
}

// ---------------------------------------------------------------------------
// GET /api/meal-plan
// ---------------------------------------------------------------------------

app.get('/api/meal-plan', mealPlanLimiter, async (req, res) => {
  const q = req.query;

  const days = Math.min(Math.max(parseInt(q.days) || 5, 1), 30);
  const params = {
    days,
    persons:           Math.min(Math.max((parseInt(q.adults) || 2) + (parseInt(q.children) || 0), 1), 20),
    hasChildren:       (parseInt(q.children) || 0) > 0,
    allergies:         [].concat(q.allergies || []),
    cookTime:          parseInt(q.cookTime) || 30,
    difficulty:        q.difficulty || 'enkel',
    leftovers:         q.leftovers === 'true',
    fishPerWeek:       Math.min(Math.max(parseInt(q.fishPerWeek) ?? 2, 0), days),
    vegetarianPerWeek: Math.min(Math.max(parseInt(q.vegetarianPerWeek) ?? 1, 0), days),
    veganPerWeek:      Math.min(Math.max(parseInt(q.veganPerWeek) ?? 0, 0), days),
    likesEspecially:   q.likesEspecially || '',
    dontWant:          q.dontWant || '',
  };

  try {
    // Velg måltider
    let meals = selectMeals(params);

    if (!meals.length) {
      return res.status(422).json({
        error: 'Ingen måltider passer kriteriene. Prøv å justere filtrene.',
      });
    }

    // Sorter handleliste per måltid
    meals = meals.map(meal => ({
      ...meal,
      shoppingList: sortByCategory(meal.shoppingList),
    }));

    // Bygg samlet handleliste (bruker veiledende priser fra oppskriftene)
    const shoppingList = mergeShoppingList(meals);
    const totalPrice = shoppingList.reduce((s, i) => s + (i.estimatedPrice || 0), 0);
    const storeComparison = null; // Deaktivert - bruker veiledende priser istedenfor

    res.json({
      meta: {
        days:        params.days,
        persons:     params.persons,
        generatedAt: new Date().toISOString(),
        isDummy:     false,
      },
      meals,
      shoppingList,
      totalPrice,
      storeComparison,
    });
  } catch (err) {
    console.error('[/api/meal-plan]', err);
    res.status(500).json({ error: 'Intern serverfeil. Prøv igjen.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/feedback
// ---------------------------------------------------------------------------

app.post('/api/feedback', feedbackLimiter, express.json(), (req, res) => {
  const { name, email, type, message } = req.body;

  if (!name || !email || !type || !message) {
    return res.status(400).json({ error: 'Alle felter er obligatoriske.' });
  }

  try {
    const timestamp = new Date().toISOString();
    const feedbackEntry = {
      timestamp,
      name,
      email,
      type,
      message,
    };

    // ── SECURE LOGGING ────────────────────────────────────────────────────
    // Only log non-sensitive metadata, NOT user emails/names/messages
    // This prevents sensitive data exposure in logs
    const logEntry = {
      timestamp,
      type,
      messageLength: message.length,
      action: 'feedback_received',
      ipAddress: req.ip,
    };
    console.log('📧 Feedback mottatt:', logEntry);
    // In production, would send to secure logging service, never console.log emails

    // TODO: Send feedbackEntry to secure storage (e.g., database, encrypted file, or email service)
    // For now, feedback data is received and validated but not persisted (security-first approach)

    res.json({ ok: true });
  } catch (err) {
    console.error('[/api/feedback] Error processing feedback:', err.message);
    res.status(500).json({ error: 'Kunne ikke behandle tilbakemeldingen.' });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Middag-backend kjører på http://localhost:${PORT}`);
});
