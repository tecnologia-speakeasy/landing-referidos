import { consultar } from './db';

/**
 * Cuántas personas se pueden mandar en un solo envío. No es un tope de
 * referidos (cada estudiante puede referir a todas las que quiera, en tantos
 * envíos como necesite): solo evita una consulta gigante con una petición
 * armada a mano.
 */
export const MAXIMO_POR_ENVIO = 50;

/** Cuántas personas ha referido ya el estudiante. */
export async function contarReferidos(estudianteId: number): Promise<number> {
  const { rows } = await consultar<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM persona_referida WHERE estudiante_id = $1',
    [estudianteId],
  );
  return rows[0]?.total ?? 0;
}
