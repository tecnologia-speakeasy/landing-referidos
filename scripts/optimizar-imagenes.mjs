#!/usr/bin/env node
/**
 * Genera los recursos gráficos que sirve la web a partir de los originales de
 * diseño (`design/originales/`), que NO se despliegan.
 *
 *   npm run optimizar-imagenes
 *
 * Solo hay que volver a correrlo cuando diseño entregue un original nuevo; el
 * resultado (`public/img/`) va versionado en git.
 */
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'design', 'originales');
const destinoImg = join(raiz, 'public', 'img');

mkdirSync(destinoImg, { recursive: true });

/**
 * Los nombres de los originales llevan espacios y acentos, y el acento puede
 * venir descompuesto (NFD) según el sistema que los exportó. Se localizan por
 * un fragmento normalizado en vez de por nombre exacto.
 */
const archivos = readdirSync(origen);

function original(fragmento) {
  const buscado = normalizar(fragmento);
  const encontrado = archivos.find((nombre) => normalizar(nombre).includes(buscado));
  if (!encontrado) {
    throw new Error(`No encuentro el original que contenga "${fragmento}" en design/originales/`);
  }
  return join(origen, encontrado);
}

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Fondos: degradados y tramas finas; con calidad alta no aparecen bandas. */
const fondos = [
  ['fondo - seccion 1', 'fondo-hero.webp'],
  ['fondo - seccion 3', 'fondo-referidos.webp'],
  ['login-zoom-fondo-desktop', 'fondo-formulario-desktop.webp'],
  ['login-zoom-fondo-movil', 'fondo-formulario-movil.webp'],
];

for (const [fragmento, salida] of fondos) {
  const info = await sharp(original(fragmento))
    .webp({ quality: 90, effort: 6 })
    .toFile(join(destinoImg, salida));
  console.log(`img/${salida.padEnd(30)} ${info.width}x${info.height}  ${kb(info.size)}`);
}

/**
 * Foto de Felipe: recorte con el halo ya incluido.
 *
 * - Se corta justo por debajo del recorte horizontal de la foto (la última fila
 *   con píxeles opacos). Lo que queda más abajo es solo halo y en la página
 *   nunca se ve: en desktop lo tapa el final de la sección y en móvil el
 *   fundido. Así el archivo pesa un 27 % menos.
 * - El halo es casi todo semitransparente, así que el canal alfa va sin
 *   pérdida: con compresión aparecen anillos escalonados en el resplandor.
 */
{
  const salida = 'felipe.webp';
  const ruta = original('felipe - seccion 1');
  const { data, info: crudo } = await sharp(ruta)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let corte = crudo.height;
  buscar: for (let y = crudo.height - 1; y >= 0; y--) {
    for (let x = 0; x < crudo.width; x++) {
      if (data[(y * crudo.width + x) * crudo.channels + 3] >= 250) {
        corte = y + 1;
        break buscar;
      }
    }
  }

  const info = await sharp(ruta)
    .extract({ left: 0, top: 0, width: crudo.width, height: corte })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(join(destinoImg, salida));
  console.log(`img/${salida.padEnd(30)} ${info.width}x${info.height}  ${kb(info.size)}`);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}
