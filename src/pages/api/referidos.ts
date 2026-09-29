import type { APIRoute } from 'astro';
import type { Country } from '@/lib/countries';
import { consultar } from '@/lib/db';
import { json } from '@/lib/http';
import { MAXIMO_POR_ENVIO } from '@/lib/referidos';
import { leerSesion } from '@/lib/session';
import { componerE164, paisPorIso, problemaTelefono } from '@/lib/telefono';

export const prerender = false;

interface Referido {
  nombre: string;
  pais: Country | undefined;
  telefono: string;
}

/**
 * Guarda las personas que refiere el estudiante de la sesión.
 *
 * - Las filas que llegan vacías del todo se ignoran: el formulario manda todas
 *   sus filas, y lo normal es que no se llenen todas.
 * - No hay tope de referidos por estudiante; solo se limita cuántas filas
 *   llegan en un envío (MAXIMO_POR_ENVIO).
 * - Cada celular llega sin indicativo, con el país aparte; se valida con las
 *   reglas de ese país y se guarda en formato E.164 (ver `@/lib/telefono`).
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

const manejarPost: APIRoute = async ({ request }) => {
  const sesion = await leerSesion(request);
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

  if (lista.length > MAXIMO_POR_ENVIO) {
    return json(
      { ok: false, error: `Puedes enviar hasta ${MAXIMO_POR_ENVIO} personas a la vez.` },
      400,
    );
  }

  const referidos: Referido[] = lista
    .map((fila) => {
      const datos = fila as { nombre?: unknown; pais?: unknown; telefono?: unknown } | null;
      return {
        nombre: String(datos?.nombre ?? '').trim().replace(/\s+/g, ' '),
        pais: paisPorIso(String(datos?.pais ?? '')),
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

  const valores: string[] = [];
  for (const r of referidos) {
    if (!r.pais) {
      return json({ ok: false, error: `Elige el país del celular de ${r.nombre}.` }, 400);
    }
    const problema = problemaTelefono(r.pais, r.telefono);
    if (problema) {
      return json({ ok: false, error: `El celular de ${r.nombre} ${problema}.` }, 400);
    }
    valores.push(r.nombre, componerE164(r.pais, r.telefono));
  }

  const marcadores = referidos.map((_, i) => `($${i * 2 + 2}::text, $${i * 2 + 3}::text)`);

  // Una sola sentencia: si el estudiante ya no existe (se borró a mano), el
  // SELECT no da filas y no se inserta nada.
  const { rowCount } = await consultar(
    `INSERT INTO persona_referida (estudiante_id, nombre, telefono)
     SELECT e.id, v.nombre, v.telefono
     FROM estudiantes e
     CROSS JOIN (VALUES ${marcadores.join(', ')}) AS v (nombre, telefono)
     WHERE e.id = $1`,
    [sesion.estudianteId, ...valores],
  );

  if (rowCount === 0) return json(SIN_SESION, 401);

  return json({ ok: true, registrados: referidos.length });
};

/** Cualquier método distinto de POST. */
export const ALL: APIRoute = () => json({ ok: false, error: 'Método no permitido.' }, 405);
