import type { ImageMetadata } from 'astro';

/**
 * Imágenes originales de diseño (`design/originales/`), referenciadas tal cual:
 * sin convertir ni recomprimir. Vite copia cada archivo al build sin tocarlo
 * (solo le añade un hash al nombre para la caché).
 *
 * Los nombres llevan espacios y acentos, y el acento viene descompuesto (NFD)
 * según el sistema que los exportó, así que escribir la ruta exacta en un
 * `import` es frágil. Se cargan todos con un glob y se localizan por un
 * fragmento normalizado, igual que en scripts/optimizar-imagenes.mjs.
 */
const archivos = import.meta.glob<ImageMetadata>('/design/originales/*.png', {
  eager: true,
  import: 'default',
});

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function original(fragmento: string): ImageMetadata {
  const buscado = normalizar(fragmento);
  const encontrado = Object.entries(archivos).find(([ruta]) => normalizar(ruta).includes(buscado));
  if (!encontrado) {
    throw new Error(`No encuentro el original que contenga "${fragmento}" en design/originales/`);
  }
  return encontrado[1];
}

/** Felipe con el halo alrededor (1365x1365, fondo transparente). */
export const fotoFelipe = original('felipe - seccion 1');

/** Fondo del bloque superior: hero + frase de confianza. */
export const fondoHero = original('fondo - seccion 1');

/** Fondo del bloque inferior: formulario de referidos + cierre. */
export const fondoReferidos = original('fondo - seccion 3');

/** Fondos del formulario de entrada (los mismos de landing-auth-zoom). */
export const fondoFormularioDesktop = original('login-zoom-fondo-desktop');
export const fondoFormularioMovil = original('login-zoom-fondo-movil');

/** Valor listo para `background-image` desde una variable CSS. */
export function urlCss(imagen: ImageMetadata): string {
  return `url("${imagen.src}")`;
}
