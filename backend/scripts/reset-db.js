const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log("Tables found:", res.rows.map(r => r.tablename));

    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    console.log("✅ All tables dropped. Database is clean.");
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.error("Error:", e.message); process.exit(1); });
