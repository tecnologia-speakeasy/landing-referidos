import { z } from 'zod';

/**
 * Lectura y validación de variables de entorno. SOLO servidor: este módulo
 * nunca debe importarse desde código que se envíe al navegador.
 *
 * Se validan por grupos (sesión, base de datos) para que el error diga
 * exactamente qué integración está mal configurada.
 *
 * Las variables se leen con acceso estático a `import.meta.env` (así las inyecta
 * Vite en dev y en el bundle SSR) con respaldo en `process.env`, que es de donde
 * vienen en Vercel en tiempo de ejecución.
 */
const crudas: Record<string, string | undefined> = {
  SESSION_SECRET: import.meta.env.SESSION_SECRET ?? process.env.SESSION_SECRET,
  PGHOST: import.meta.env.PGHOST ?? process.env.PGHOST,
  PGPORT: import.meta.env.PGPORT ?? process.env.PGPORT,
  PGUSER: import.meta.env.PGUSER ?? process.env.PGUSER,
  PGPASSWORD: import.meta.env.PGPASSWORD ?? process.env.PGPASSWORD,
  PGDATABASE: import.meta.env.PGDATABASE ?? process.env.PGDATABASE,
  PGSCHEMA: import.meta.env.PGSCHEMA ?? process.env.PGSCHEMA,
  PGSSL: import.meta.env.PGSSL ?? process.env.PGSSL,
  PGPOOL_MAX: import.meta.env.PGPOOL_MAX ?? process.env.PGPOOL_MAX,
};

/** Error de configuración; se distingue de los errores de negocio. */
export class ErrorConfiguracion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorConfiguracion';
  }
}

/** Valida un grupo de variables una sola vez y cachea el resultado. */
function grupo<T extends z.ZodType>(nombre: string, esquema: T): () => z.infer<T> {
  let cache: z.infer<T> | null = null;

  return () => {
    if (cache) return cache;

    // Las vacías se tratan como ausentes para que apliquen los valores por defecto.
    const limpias = Object.fromEntries(
      Object.entries(crudas).filter(([, valor]) => valor !== undefined && valor !== ''),
    );

    const resultado = esquema.safeParse(limpias);
    if (!resultado.success) {
      const detalle = resultado.error.issues
        .map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`)
        .join('\n');
      throw new ErrorConfiguracion(
        `Faltan o son inválidas las variables de entorno de ${nombre}:\n${detalle}\n` +
          'Revisa tu .env.local (o las variables del proyecto en Vercel) tomando .env.example como referencia.',
      );
    }

    cache = resultado.data;
    return cache;
  };
}

/** Sesión: clave para firmar la cookie. */
export const envSesion = grupo(
  'la sesión',
  z.object({
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
  }),
);

/** PostgreSQL: conexión por host. */
export const envDb = grupo(
  'PostgreSQL',
  z.object({
    PGHOST: z.string().min(1, 'Falta PGHOST'),
    PGPORT: z.coerce.number().int().positive().default(5432),
    PGUSER: z.string().min(1, 'Falta PGUSER'),
    PGPASSWORD: z.string().default(''),
    PGDATABASE: z.string().min(1, 'Falta PGDATABASE'),
    /** Esquema donde viven las tablas de referidos, aisladas del resto de la base. */
    PGSCHEMA: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*$/i, 'PGSCHEMA solo admite letras, números y guiones bajos')
      .default('referidos'),
    PGSSL: z.enum(['require', 'disable']).default('require'),
    PGPOOL_MAX: z.coerce.number().int().positive().default(3),
  }),
);
