/** Respuesta JSON de los endpoints de /api. */
export function json(datos: unknown, estado = 200): Response {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
