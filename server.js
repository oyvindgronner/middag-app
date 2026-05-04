import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import { selectMeals } from './planner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy so rate limiting works correctly behind nginx
app.set('trust proxy', 1);

// ── DATABASE CLIENT ──────────────────────────────────────────────────────
const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'postgres',
});

// Initialize database tables on startup
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meal_ratings (
        id SERIAL PRIMARY KEY,
        meal_id VARCHAR(255) NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(meal_id, ip_address)
      );

      CREATE INDEX IF NOT EXISTS idx_meal_id ON meal_ratings(meal_id);
    `);
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.warn('⚠️ Database initialization skipped (likely no PostgreSQL):', err.message);
  }
}

initializeDatabase();

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
  const adults = parseInt(q.adults);
  const children = parseInt(q.children);
  const params = {
    days,
    persons:           Math.min(Math.max((isNaN(adults) ? 2 : adults) + (isNaN(children) ? 0 : children), 1), 20),
    hasChildren:       (isNaN(children) ? 0 : children) > 0,
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
    // Hent ratings for rating-basert sortering (optional, graceful fallback)
    let ratings = {};
    try {
      const ratingResult = await pool.query(`
        SELECT meal_id, AVG(rating) as avg_rating
        FROM meal_ratings
        GROUP BY meal_id
      `);
      ratings = Object.fromEntries(
        ratingResult.rows.map(r => [r.meal_id, parseFloat(r.avg_rating)])
      );
    } catch (err) {
      // DB unavailable, continue without rating-based sorting
      console.log('⚠️ Ratings unavailable, continuing without rating-based sorting');
    }

    // Velg måltider (ratings will be used for sorting if available)
    let meals = selectMeals(params, ratings);

    if (!meals.length) {
      return res.status(422).json({
        error: 'Ingen måltider passer kriteriene. Prøv å justere filtrene.',
      });
    }

    // Preserve _compromises before mapping (array properties are lost by map())
    const compromisesData = meals._compromises;

    // Sorter handleliste per måltid
    meals = meals.map(meal => ({
      ...meal,
      shoppingList: sortByCategory(meal.shoppingList),
    }));

    // Restore _compromises on new array
    meals._compromises = compromisesData;

    // Bygg samlet handleliste (bruker veiledende priser fra oppskriftene)
    const shoppingList = mergeShoppingList(meals);
    const totalPrice = shoppingList.reduce((s, i) => s + (i.estimatedPrice || 0), 0);
    const storeComparison = null; // Deaktivert - bruker veiledende priser istedenfor

    // Extract compromises if any (property on meals array)
    const compromises = meals._compromises || null;
    // Remove _compromises from meals array so it doesn't pollute the JSON response
    delete meals._compromises;

    res.json({
      meta: {
        days:        params.days,
        persons:     params.persons,
        generatedAt: new Date().toISOString(),
        isDummy:     false,
        compromises,
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

// ---------------------------------------------------------------------------
// GET /api/meals/:mealId/rating
// ---------------------------------------------------------------------------

app.get('/api/meals/:mealId/rating', async (req, res) => {
  const { mealId } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as count,
        AVG(rating) as average
      FROM meal_ratings
      WHERE meal_id = $1
    `, [mealId]);

    const row = result.rows[0];
    const ratingCount = parseInt(row.count) || 0;
    const averageRating = ratingCount > 0 ? parseFloat(row.average).toFixed(1) : 0;

    res.json({
      averageRating: parseFloat(averageRating),
      ratingCount,
    });
  } catch (err) {
    // Database not available - return empty ratings (UI will show no ratings)
    console.warn('[/api/meals/:id/rating] Database unavailable, returning default:', err.message);
    res.json({
      averageRating: 0,
      ratingCount: 0,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/meals/:mealId/rating
// ---------------------------------------------------------------------------

const ratingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: 'For mange rating-submissions. Vent minst 60 sekunder før nytt forsøk.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/meals/:mealId/rating', ratingLimiter, express.json(), async (req, res) => {
  const { mealId } = req.params;
  const { rating } = req.body;
  const ip = req.ip || 'unknown';

  // Validation
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating må være et tall mellom 1 og 5.' });
  }

  try {
    // Insert or update rating (UPSERT via ON CONFLICT)
    const result = await pool.query(`
      INSERT INTO meal_ratings (meal_id, rating, ip_address)
      VALUES ($1, $2, $3)
      ON CONFLICT (meal_id, ip_address) DO UPDATE
        SET rating = $2, created_at = CURRENT_TIMESTAMP
      RETURNING rating
    `, [mealId, rating, ip]);

    // Fetch updated average
    const avgResult = await pool.query(`
      SELECT
        COUNT(*) as count,
        AVG(rating) as average
      FROM meal_ratings
      WHERE meal_id = $1
    `, [mealId]);

    const row = avgResult.rows[0];
    const ratingCount = parseInt(row.count) || 0;
    const averageRating = ratingCount > 0 ? parseFloat(row.average).toFixed(1) : 0;

    console.log(`⭐ Rating mottatt: ${mealId} = ${rating} stjerner (fra ${ip})`);

    res.json({
      ok: true,
      averageRating: parseFloat(averageRating),
      ratingCount,
    });
  } catch (err) {
    // Database not available - still accept the rating (UI optimism), return default
    console.warn('[POST /api/meals/:id/rating] Database unavailable, rating accepted but not persisted:', err.message);
    res.json({
      ok: true,
      averageRating: 0,
      ratingCount: 1, // Assume this rating counts
    });
  }
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Middag-backend kjører på http://localhost:${PORT}`);
});
