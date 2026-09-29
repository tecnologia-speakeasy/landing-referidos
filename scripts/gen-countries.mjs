#!/usr/bin/env node
/**
 * Genera la lista de países del selector de indicativo y copia sus banderas.
 *
 *   node scripts/gen-countries.mjs
 *
 * - Indicativos: libphonenumber-js (datos de Google).
 * - Nombres: Intl.DisplayNames en español.
 * - Banderas: country-flag-icons (SVG 3:2) → public/img/flags/<iso>.svg.
 *
 * No se consulta nada en tiempo de ejecución: el resultado (src/lib/countries.ts
 * y public/img/flags/) va versionado en git. Solo hay que volver a correrlo para
 * actualizar los datos.
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destinoLista = join(raiz, 'src', 'lib', 'countries.ts');
const destinoBanderas = join(raiz, 'public', 'img', 'flags');
const origenBanderas = join(
  dirname(createRequire(import.meta.url).resolve('country-flag-icons/package.json')),
  '3x2',
);

/** Mercados principales: van primero y en este orden. */
const TOP = ['co', 'mx', 'pe', 'ec', 'cl', 'ar', 'us', 'es'];

const nombres = new Intl.DisplayNames(['es'], { type: 'region' });

const paises = getCountries().map((codigo) => ({
  iso: codigo.toLowerCase(),
  code: getCountryCallingCode(codigo),
  name: nombres.of(codigo) ?? codigo,
}));

const principales = TOP.map((iso) => {
  const pais = paises.find((p) => p.iso === iso);
  if (!pais) throw new Error(`libphonenumber-js no trae el país "${iso}"`);
  return { ...pais, top: true };
});

const resto = paises
  .filter((p) => !TOP.includes(p.iso))
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

const lineas = [...principales, ...resto].map(
  (p) =>
    `  { iso: '${p.iso}', code: '${p.code}', name: ${JSON.stringify(p.name)}${p.top ? ', top: true' : ''} },`,
);

writeFileSync(
  destinoLista,
  `// GENERADO POR scripts/gen-countries.mjs — no editar a mano.
// Indicativos: libphonenumber-js. Nombres: Intl.DisplayNames en espanol.
// Regenerar:  node scripts/gen-countries.mjs

export type Country = { iso: string; code: string; name: string; top?: boolean }

/** Los marcados con \`top\` van primero: son los mercados principales. */
export const COUNTRIES: Country[] = [
${lineas.join('\n')}
]

export const DEFAULT_ISO = 'co'
export const DEFAULT_DIAL = '57'
`,
);

// Se vacía la carpeta para no dejar banderas de países que ya no estén.
rmSync(destinoBanderas, { recursive: true, force: true });
mkdirSync(destinoBanderas, { recursive: true });
for (const { iso } of paises) {
  copyFileSync(join(origenBanderas, `${iso.toUpperCase()}.svg`), join(destinoBanderas, `${iso}.svg`));
}

console.log(`${paises.length} países → src/lib/countries.ts y public/img/flags/`);
