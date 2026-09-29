import type { AstroCookies } from 'astro';
import { SignJWT, jwtVerify } from 'jose';
import { envSesion } from './env';

export const NOMBRE_COOKIE = 'se_referidos';

/**
 * La sesión vale para una sola carga de /referidos, que se usa en computadores
 * compartidos. La cookie solo lleva el token del formulario de entrada a esa
 * página, que la borra al leerla (`tomarSesion`) y deja el token en el HTML.
 * El envío de los referidos lo manda en la cabecera Authorization
 * (`leerSesion`). Al recargar ya no hay cookie y se vuelve al formulario de
 * entrada.
 *
 * Dos horas sobran para llenar el formulario con la página abierta.
 */
const DURACION_SEGUNDOS = 2 * 60 * 60;

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

/**
 * Lee la cookie de sesión y la borra en la misma respuesta, así la sesión no
 * sobrevive a una recarga. Devuelve también el token, que la página guarda para
 * mandarlo al enviar los referidos. Null si falta, expiró o es inválida.
 */
export async function tomarSesion(
  cookies: AstroCookies,
): Promise<{ sesion: Sesion; token: string } | null> {
  const token = cookies.get(NOMBRE_COOKIE)?.value;
  if (!token) return null;

  cerrarSesion(cookies);
  const sesion = await verificarToken(token);
  return sesion ? { sesion, token } : null;
}

/** Lee y verifica el token de la cabecera `Authorization: Bearer …`. */
export async function leerSesion(request: Request): Promise<Sesion | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  return token ? verificarToken(token) : null;
}

/** Verifica el token firmado. Devuelve null si expiró o es inválido. */
async function verificarToken(token: string): Promise<Sesion | null> {

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
