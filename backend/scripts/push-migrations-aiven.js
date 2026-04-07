#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const projectRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(projectRoot, "migrations");
const schemaMigrationsTable = "schema_migrations";

dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local"), override: true });

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const isVerbose = args.has("--verbose");

const log = (message) => {
  console.log(`[aiven-migrate] ${message}`);
};

const fail = (message) => {
  console.error(`[aiven-migrate] ${message}`);
  process.exit(1);
};

const loadCaCertificate = () => {
  if (process.env.DB_SSL_CA && process.env.DB_SSL_CA.trim()) {
    return process.env.DB_SSL_CA;
  }

  if (process.env.DB_SSL_CA_PATH && process.env.DB_SSL_CA_PATH.trim()) {
    const caPath = path.isAbsolute(process.env.DB_SSL_CA_PATH)
      ? process.env.DB_SSL_CA_PATH
      : path.join(projectRoot, process.env.DB_SSL_CA_PATH);

    if (!fs.existsSync(caPath)) {
      fail(`DB_SSL_CA_PATH points to a missing file: ${caPath}`);
    }

    return fs.readFileSync(caPath, "utf8");
  }

  return undefined;
};

const getSslConfig = (hostname) => {
  const normalizedHost = String(hostname || "").toLowerCase();
  const wantsSsl =
    process.env.DB_SSL === "true" ||
    normalizedHost.includes("aivencloud.com") ||
    Boolean(process.env.DATABASE_URL);

  if (!wantsSsl) {
    return false;
  }

  const ca = loadCaCertificate();
  const rejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" || Boolean(ca);

  return ca
    ? { rejectUnauthorized, ca }
    : { rejectUnauthorized };
};

const getConnectionConfig = () => {
  const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();

  if (databaseUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(databaseUrl);
    } catch (error) {
      fail(`Invalid DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      connectionString: databaseUrl,
      ssl: getSslConfig(parsedUrl.hostname),
      application_name: "versafic-aiven-migrations",
      connectionTimeoutMillis: 15000,
      statement_timeout: 60000,
    };
  }

  const requiredVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = requiredVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail(
      `Missing database variables: ${missing.join(
        ", "
      )}. Set DATABASE_URL or the DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME fields.`
    );
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: getSslConfig(process.env.DB_HOST),
    application_name: "versafic-aiven-migrations",
    connectionTimeoutMillis: 15000,
    statement_timeout: 60000,
  };
};

const getMigrationFiles = () => {
  if (!fs.existsSync(migrationsDir)) {
    fail(`Migrations directory not found: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
};

const ensureSchemaMigrationsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${schemaMigrationsTable} (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const getAppliedMigrations = async (client) => {
  const result = await client.query(
    `SELECT migration_name FROM ${schemaMigrationsTable} ORDER BY migration_name ASC`
  );
  return new Set(result.rows.map((row) => row.migration_name));
};

const run = async () => {
  const connectionConfig = getConnectionConfig();
  const client = new Client(connectionConfig);

  try {
    await client.connect();

    const hostLabel =
      connectionConfig.host ||
      (() => {
        try {
          return new URL(connectionConfig.connectionString).hostname;
        } catch {
          return "unknown-host";
        }
      })();

    log(`Connected to ${hostLabel}`);

    await ensureSchemaMigrationsTable(client);

    const migrationFiles = getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(client);
    const pendingMigrations = migrationFiles.filter((file) => !appliedMigrations.has(file));

    log(
      `Found ${migrationFiles.length} migration file(s): ${appliedMigrations.size} applied, ${pendingMigrations.length} pending`
    );

    if (isDryRun) {
      pendingMigrations.forEach((file) => log(`PENDING ${file}`));
      if (!pendingMigrations.length) {
        log("No pending migrations.");
      }
      return;
    }

    for (const file of pendingMigrations) {
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, "utf8").trim();

      if (!sql) {
        log(`Skipping empty migration: ${file}`);
        continue;
      }

      log(`Applying ${file}`);
      await client.query("BEGIN");

      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${schemaMigrationsTable} (migration_name) VALUES ($1)`,
          [file]
        );
        await client.query("COMMIT");

        log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(
          `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (!pendingMigrations.length) {
      log("Database is already up to date.");
    } else {
      log(`Migration run complete. Applied ${pendingMigrations.length} migration(s).`);
    }

    if (isVerbose) {
      const finalApplied = await getAppliedMigrations(client);
      log(`Applied migrations: ${Array.from(finalApplied).join(", ") || "none"}`);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    await client.end().catch(() => undefined);
  }
};

run();
