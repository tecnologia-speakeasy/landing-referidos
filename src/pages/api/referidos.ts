import type { APIRoute } from 'astro';
import { obtenerPool } from '@/lib/db';
import { json } from '@/lib/http';
import { MAXIMO_REFERIDOS } from '@/lib/referidos';
import { cerrarSesion, leerSesion } from '@/lib/session';

export const prerender = false;

interface Referido {
  nombre: string;
  telefono: string;
}

/**
 * Guarda las personas que refiere el estudiante de la sesión.
 *
 * - Las filas que llegan vacías del todo se ignoran: el formulario siempre
 *   manda sus cinco filas, y lo normal es que no se llenen todas.
 * - Cada estudiante puede referir como mucho MAXIMO_REFERIDOS personas en
 *   total, sumando envíos anteriores. El conteo y la inserción van en la misma
 *   transacción, con el estudiante bloqueado, para que dos envíos simultáneos
 *   no se salten el tope.
 */
export const POST: APIRoute = async (contexto) => {
  try {
    return await manejarPost(contexto);
  } catch (error) {
    console.error('[referidos] error no controlado:', error);
    return json(
      { ok: false, error: 'No pudimos guardar tus referidos. Inténtalo de nuevo en un momento.' },
      500,
    );
  }
};

const SIN_SESION = {
  ok: false,
  error: 'Tu sesión expiró. Vuelve a escribir tu nombre y tu correo.',
  redirect: '/',
};

const manejarPost: APIRoute = async ({ request, cookies }) => {
  const sesion = await leerSesion(cookies);
  if (!sesion) return json(SIN_SESION, 401);

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ ok: false, error: 'Petición inválida.' }, 400);
  }

  const lista = (cuerpo as { referidos?: unknown } | null)?.referidos;
  if (!Array.isArray(lista)) {
    return json({ ok: false, error: 'Petición inválida.' }, 400);
  }

  const referidos: Referido[] = lista
    .map((fila) => {
      const datos = fila as { nombre?: unknown; telefono?: unknown } | null;
      return {
        nombre: String(datos?.nombre ?? '').trim().replace(/\s+/g, ' '),
        telefono: String(datos?.telefono ?? '').trim(),
      };
    })
    .filter((r) => r.nombre !== '' || r.telefono !== '');

  if (referidos.length === 0) {
    return json(
      { ok: false, error: 'Escribe el nombre y el celular de al menos una persona.' },
      400,
    );
  }

  if (referidos.some((r) => r.nombre === '' || r.telefono === '')) {
    return json({ ok: false, error: 'Completa el nombre y el celular de cada referido.' }, 400);
  }

  const cliente = await obtenerPool().connect();
  try {
    await cliente.query('BEGIN');

    const estudiante = await cliente.query(
      'SELECT id FROM estudiantes WHERE id = $1 FOR UPDATE',
      [sesion.estudianteId],
    );

    // La cookie apunta a un estudiante que ya no existe (se borró a mano).
    if (estudiante.rowCount === 0) {
      await cliente.query('ROLLBACK');
      cerrarSesion(cookies);
      return json(SIN_SESION, 401);
    }

    const { rows } = await cliente.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM persona_referida WHERE estudiante_id = $1',
      [sesion.estudianteId],
    );
    const yaReferidos = rows[0]?.total ?? 0;
    const disponibles = MAXIMO_REFERIDOS - yaReferidos;

    if (referidos.length > disponibles) {
      await cliente.query('ROLLBACK');
      return json(
        {
          ok: false,
          error:
            disponibles <= 0
              ? `Ya registraste a tus ${MAXIMO_REFERIDOS} referidos.`
              : `Solo puedes añadir ${disponibles} ${disponibles === 1 ? 'referido' : 'referidos'} más.`,
        },
        409,
      );
    }

    const valores: string[] = [];
    const marcadores = referidos.map((r, i) => {
      valores.push(r.nombre, r.telefono);
      return `($1, $${i * 2 + 2}, $${i * 2 + 3})`;
    });

    await cliente.query(
      `INSERT INTO persona_referida (estudiante_id, nombre, telefono)
       VALUES ${marcadores.join(', ')}`,
      [sesion.estudianteId, ...valores],
    );

    await cliente.query('COMMIT');

    return json({
      ok: true,
      registrados: referidos.length,
      restantes: disponibles - referidos.length,
    });
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
};

/** Cualquier método distinto de POST. */
export const ALL: APIRoute = () => json({ ok: false, error: 'Método no permitido.' }, 405);
