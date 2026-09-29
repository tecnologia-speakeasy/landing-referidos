import { consultar } from './db';

/** Tope de personas que puede referir cada estudiante, en total. */
export const MAXIMO_REFERIDOS = 5;

/** Cuántas personas ha referido ya el estudiante. */
export async function contarReferidos(estudianteId: number): Promise<number> {
  const { rows } = await consultar<{ total: number }>(
    'SELECT COUNT(*)::int AS total FROM persona_referida WHERE estudiante_id = $1',
    [estudianteId],
  );
  return rows[0]?.total ?? 0;
}
