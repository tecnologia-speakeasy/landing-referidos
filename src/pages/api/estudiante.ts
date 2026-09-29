import type { APIRoute } from 'astro';
import { consultar } from '@/lib/db';
import { json } from '@/lib/http';
import { crearSesion } from '@/lib/session';

export const prerender = false;

/**
 * Registra al estudiante que va a referir con el nombre y el correo del
 * formulario de entrada, y lo recuerda con una cookie firmada.
 *
 * No se valida el formato de nada: solo se recortan espacios y el correo se
 * pasa a minúsculas para que la misma persona no quede duplicada por escribirlo
 * distinto. Si el correo ya existe se actualiza el nombre y se reutiliza el
 * registro, así sus referidos siguen colgando del mismo estudiante.
 *
 * Envoltorio: cualquier error inesperado (configuración inválida, caída de red)
 * se registra en el servidor y se responde en JSON, nunca con una página de error.
 */
export const POST: APIRoute = async (contexto) => {
  try {
    return await manejarPost(contexto);
  } catch (error) {
    console.error('[estudiante] error no controlado:', error);
    return json(
      { ok: false, error: 'El servidor no pudo procesar tu solicitud. Inténtalo más tarde.' },
      500,
    );
  }
};

const manejarPost: APIRoute = async ({ request, cookies }) => {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ ok: false, error: 'Petición inválida.' }, 400);
  }

  const datos = cuerpo as { nombre?: unknown; email?: unknown } | null;
  const nombre = String(datos?.nombre ?? '').trim().replace(/\s+/g, ' ');
  const email = String(datos?.email ?? '').trim().toLowerCase();

  // Sin nombre o sin correo no hay a quién asociarle los referidos.
  if (nombre === '' || email === '') {
    return json({ ok: false, error: 'Escribe tu nombre y tu correo para continuar.' }, 400);
  }

  const { rows } = await consultar<{ id: number }>(
    `INSERT INTO estudiantes (nombre, email)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET
       nombre         = EXCLUDED.nombre,
       actualizado_en = NOW()
     RETURNING id`,
    [nombre, email],
  );

  const estudianteId = rows[0]?.id;
  if (estudianteId === undefined) {
    throw new Error('El INSERT de estudiantes no devolvió el id.');
  }

  await crearSesion(cookies, { estudianteId, nombre, email });

  return json({ ok: true, redirect: '/referidos' });
};

/** Cualquier método distinto de POST. */
export const ALL: APIRoute = () => json({ ok: false, error: 'Método no permitido.' }, 405);
