import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    });

    // Cloud SQL Developer Edition scales to zero when idle and terminates idle clients (57P01).
    // The pg Pool automatically discards terminated idle clients and reconnects on next query.
    global._postgresPool.on('error', () => {
      // Handled automatically by pg.Pool reconnection lifecycle
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
