import pg from 'pg';
import 'dotenv/config';

const client = new pg.Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'postgres',
});

(async () => {
  try {
    await client.connect();
    console.log('✅ Tilkoblet PostgreSQL');

    // Create meal_ratings table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS meal_ratings (
        id SERIAL PRIMARY KEY,
        meal_id VARCHAR(255) NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(meal_id, ip_address)
      );

      CREATE INDEX IF NOT EXISTS idx_meal_id ON meal_ratings(meal_id);
    `;

    await client.query(createTableSQL);
    console.log('✅ Tabell meal_ratings opprettet (eller eksisterer allerede)');

    // Verify
    const result = await client.query('SELECT * FROM information_schema.tables WHERE table_name = $1', ['meal_ratings']);
    if (result.rows.length > 0) {
      console.log('✅ Verifisering: Tabell eksisterer');

      // Show columns
      const colResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'meal_ratings'
        ORDER BY ordinal_position
      `);
      console.log('\n📋 Tabell-struktur:');
      colResult.rows.forEach(row => {
        console.log(`  • ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
      });
    }

    await client.end();
    console.log('\n✅ Oppgjøring ferdig!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Feil:', err.message);
    process.exit(1);
  }
})();
