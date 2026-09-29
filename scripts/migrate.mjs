#!/usr/bin/env node
/**
 * Aplica las migraciones SQL pendientes de db/migrations en orden alfabético.
 *
 * Cada archivo se ejecuta dentro de una transacción y se registra en la tabla
 * `_migraciones` (dentro del esquema de este proyecto), así que volver a correr
 * `npm run migrate` no repite nada.
 *
 *   npm run migrate
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const raizProyecto = join(dirname(fileURLToPath(import.meta.url)), '..');

// .env.local pisa a .env (dotenv no sobrescribe lo ya cargado).
dotenv.config({ path: join(raizProyecto, '.env.local'), quiet: true });
dotenv.config({ path: join(raizProyecto, '.env'), quiet: true });

const requeridas = ['PGHOST', 'PGUSER', 'PGDATABASE'];
const faltantes = requeridas.filter((clave) => !process.env[clave]);
if (faltantes.length > 0) {
  console.error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  console.error('Copia .env.example a .env.local y rellena los datos de PostgreSQL.');
  process.exit(1);
}

const cliente = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD ?? '',
  database: process.env.PGDATABASE,
  ssl: (process.env.PGSSL ?? 'require') === 'require' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15_000,
});

const carpeta = join(raizProyecto, 'db', 'migrations');

const esquema = process.env.PGSCHEMA ?? 'referidos';
if (!/^[a-z_][a-z0-9_]*$/i.test(esquema)) {
  console.error(`PGSCHEMA inválido: "${esquema}". Solo letras, números y guiones bajos.`);
  process.exit(1);
}

try {
  await cliente.connect();
  console.log(`Conectado a ${process.env.PGHOST}/${process.env.PGDATABASE}`);

  // Las tablas de referidos viven aisladas en su propio esquema.
  await cliente.query(`CREATE SCHEMA IF NOT EXISTS "${esquema}"`);
  await cliente.query(`SET search_path TO "${esquema}", public`);
  console.log(`Esquema: ${esquema}`);

  await cliente.query(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      nombre      TEXT PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await cliente.query('SELECT nombre FROM _migraciones');
  const aplicadas = new Set(rows.map((fila) => fila.nombre));

  const archivos = readdirSync(carpeta)
    .filter((nombre) => nombre.endsWith('.sql'))
    .sort();

  const pendientes = archivos.filter((nombre) => !aplicadas.has(nombre));

  if (pendientes.length === 0) {
    console.log('No hay migraciones pendientes.');
  }

  for (const nombre of pendientes) {
    const sql = readFileSync(join(carpeta, nombre), 'utf8');
    process.stdout.write(`Aplicando ${nombre}... `);
    try {
      await cliente.query('BEGIN');
      await cliente.query(sql);
      await cliente.query('INSERT INTO _migraciones (nombre) VALUES ($1)', [nombre]);
      await cliente.query('COMMIT');
      console.log('OK');
    } catch (error) {
      await cliente.query('ROLLBACK');
      console.log('FALLÓ');
      throw error;
    }
  }

  console.log(`Listo. ${pendientes.length} migración(es) aplicada(s) ahora; ${archivos.length} en total.`);
} catch (error) {
  console.error(`\nError al migrar: ${describir(error)}`);
  console.error(
    'Comprueba PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE y el valor de PGSSL en .env.local.',
  );
  process.exitCode = 1;
} finally {
  await cliente.end().catch(() => {});
}

/** Mensaje legible para errores de pg, que a veces llegan como AggregateError vacío. */
function describir(error) {
  if (error instanceof AggregateError) {
    const partes = error.errors.map((e) => describir(e)).filter(Boolean);
    return partes.length > 0 ? partes.join(' | ') : 'no se pudo conectar con PostgreSQL';
  }
  if (error instanceof Error) {
    const codigo = error.code ? ` (${error.code})` : '';
    return `${error.message || 'error sin mensaje'}${codigo}`;
  }
  return String(error);
}
