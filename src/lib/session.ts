import type { AstroCookies } from 'astro';
import { SignJWT, jwtVerify } from 'jose';
import { envSesion } from './env';

export const NOMBRE_COOKIE = 'se_referidos';

/** Duración de la sesión: 30 días, lo que dura de sobra la campaña de referidos. */
const DURACION_SEGUNDOS = 30 * 24 * 60 * 60;

export interface Sesion {
  /** `estudiantes.id`: a este estudiante se le cuelgan los referidos. */
  estudianteId: number;
  nombre: string;
  email: string;
}

function clave(): Uint8Array {
  return new TextEncoder().encode(envSesion().SESSION_SECRET);
}

/**
 * Firma la sesión y la deja en una cookie httpOnly. Va firmada para que nadie
 * pueda cambiar el id a mano y registrar referidos a nombre de otro estudiante.
 */
export async function crearSesion(cookies: AstroCookies, sesion: Sesion): Promise<void> {
  const token = await new SignJWT({
    estudianteId: sesion.estudianteId,
    nombre: sesion.nombre,
    email: sesion.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(clave());

  cookies.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_SEGUNDOS,
  });
}

/** Lee y verifica la cookie de sesión. Devuelve null si falta, expiró o es inválida. */
export async function leerSesion(cookies: AstroCookies): Promise<Sesion | null> {
  const token = cookies.get(NOMBRE_COOKIE)?.value;
  if (!token) return null;

  // Fuera del try a propósito: si falta SESSION_SECRET es un error de
  // configuración y debe verse, no confundirse con "no hay sesión".
  const secreto = clave();

  try {
    const { payload } = await jwtVerify(token, secreto, { algorithms: ['HS256'] });

    const estudianteId = payload.estudianteId;
    if (typeof estudianteId !== 'number' || !Number.isInteger(estudianteId)) return null;

    return {
      estudianteId,
      nombre: typeof payload.nombre === 'string' ? payload.nombre : '',
      email: typeof payload.email === 'string' ? payload.email : '',
    };
  } catch {
    // Firma inválida, token expirado o secreto rotado: se trata como "sin sesión".
    return null;
  }
}

export function cerrarSesion(cookies: AstroCookies): void {
  cookies.delete(NOMBRE_COOKIE, { path: '/' });
}
