import pg from 'pg';
import { envDb } from './env';

const { Pool } = pg;

/**
 * Pool de PostgreSQL como singleton.
 *
 * Se guarda en `globalThis` para que el hot reload de `astro dev` (que reevalúa
 * los módulos) no abra un pool nuevo en cada recarga, y para reutilizar
 * conexiones entre invocaciones que caigan en la misma instancia de Vercel.
 */
const CLAVE_GLOBAL = Symbol.for('speakeasy.referidos.pg.pool');

type GlobalConPool = typeof globalThis & { [CLAVE_GLOBAL]?: pg.Pool };
const global = globalThis as GlobalConPool;

export function obtenerPool(): pg.Pool {
  const existente = global[CLAVE_GLOBAL];
  if (existente) return existente;

  const env = envDb();

  const pool = new Pool({
    host: env.PGHOST,
    port: env.PGPORT,
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    // Las tablas viven en su propio esquema (`referidos`), separadas de las de
    // los otros proyectos que comparten la base. Así las consultas no llevan el
    // prefijo a cuestas.
    options: `-c search_path=${env.PGSCHEMA},public`,
    // Los proveedores gestionados (Neon, Supabase, RDS, Railway...) usan
    // certificados que Node no valida contra su almacén por defecto.
    ssl: env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
    max: env.PGPOOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // Sin este listener, un error de red en una conexión inactiva tumba el proceso.
  pool.on('error', (error) => {
    console.error('[db] error en una conexión inactiva del pool:', error);
  });

  global[CLAVE_GLOBAL] = pool;
  return pool;
}

/** Atajo tipado para consultas sueltas. */
export async function consultar<T extends pg.QueryResultRow = pg.QueryResultRow>(
  texto: string,
  valores: readonly unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return obtenerPool().query<T>(texto, valores as unknown[]);
}
