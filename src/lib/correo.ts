/**
 * Formato del correo del estudiante. Lo usan el formulario de entrada, para
 * avisar antes de enviar, y la API, que rechaza lo que no parezca un correo.
 */

/**
 * El patrón de `<input type="email">` (WHATWG), pero exigiendo que el dominio
 * termine en una extensión de letras (".com", ".co"…): "maria@gmail" no pasa.
 */
const PATRON_CORREO =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

/** Largo máximo de una dirección de correo (RFC 5321). */
export const MAXIMO_CARACTERES_CORREO = 254;

export const MENSAJE_CORREO_INVALIDO =
  'Escribe un correo válido, por ejemplo maria.garcia@email.com.';

/** Si el texto tiene forma de correo. Se espera ya recortado de espacios. */
export function correoValido(correo: string): boolean {
  const [usuario = ''] = correo.split('@');
  return (
    correo.length <= MAXIMO_CARACTERES_CORREO &&
    PATRON_CORREO.test(correo) &&
    // El patrón acepta puntos sueltos en el usuario; ningún proveedor común los permite.
    !usuario.startsWith('.') &&
    !usuario.endsWith('.') &&
    !usuario.includes('..')
  );
}
