// Creates the database named in .env if it does not exist yet.
import pg from 'pg';
import { config } from '../config.js';

export async function ensureDatabase() {
  const client = new pg.Client({
    host: config.db.host, port: config.db.port,
    user: config.db.user, password: config.db.password, database: 'postgres',
  });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.name]);
    if (!rowCount) {
      if (!/^[a-zA-Z0-9_]+$/.test(config.db.name)) throw new Error('DB_NAME may only contain letters, digits and _');
      await client.query(`CREATE DATABASE "${config.db.name}"`);
      console.log(`Created database ${config.db.name}`);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureDatabase().then(() => console.log('Database ready')).catch((e) => { console.error(e.message); process.exit(1); });
}
