import { COUNTRIES, DEFAULT_ISO, type Country } from './countries';

/**
 * Reglas del celular de un referido. El país (y con él el indicativo) se elige
 * aparte; en el campo va solo el número. Las usan el formulario, que no deja
 * escribir de más, y la API, que rechaza lo que llegue fuera de ellas y guarda
 * el número en formato E.164 (+573001234567).
 *
 * Solo cuentan los dígitos: los espacios, guiones, puntos y paréntesis se
 * permiten para que cada quien lo escriba como le sea natural.
 */

/** Un celular (o un fijo) colombiano tiene siempre 10 dígitos. */
const DIGITOS_COLOMBIA = 10;

/**
 * Para el resto de países basta un mínimo que deje pasar los números cortos de
 * la región: Uruguay, Centroamérica y Bolivia usan 8; Surinam y Guyana, 7.
 */
const MINIMO_DIGITOS_OTROS = 7;

/** Un número E.164 tiene como mucho 15 dígitos, contando el indicativo. */
const MAXIMO_DIGITOS_E164 = 15;

/** Países donde el 0 inicial es parte del número internacional (fijos de Italia). */
const CONSERVAN_CERO = new Set(['it', 'sm', 'va']);

const SEPARADORES = new Set([' ', '-', '.', '(', ')']);

export const PAIS_POR_DEFECTO = COUNTRIES.find((p) => p.iso === DEFAULT_ISO)!;

export function paisPorIso(iso: string): Country | undefined {
  return COUNTRIES.find((p) => p.iso === iso);
}

/** Cuántos dígitos puede tener el número, sin contar el indicativo. */
export function limitesTelefono(pais: Country): { minimo: number; maximo: number } {
  if (pais.iso === 'co') return { minimo: DIGITOS_COLOMBIA, maximo: DIGITOS_COLOMBIA };
  return { minimo: MINIMO_DIGITOS_OTROS, maximo: MAXIMO_DIGITOS_E164 - pais.code.length };
}

/** Cuántos dígitos tiene el número, sin contar los separadores. */
export function contarDigitos(telefono: string): number {
  return telefono.replace(/\D/g, '').length;
}

/**
 * Deja solo dígitos y separadores, y descarta los dígitos que pasen de `maximo`.
 * Admite un "+" al comienzo mientras se escribe un indicativo, que
 * `separarIndicativo` convierte en el país apenas lo reconoce.
 *
 * Recorre el texto de izquierda a derecha sin mirar lo que viene después, así
 * que limpiar un prefijo da un prefijo del resultado completo: el formulario se
 * apoya en eso para saber dónde dejar el cursor.
 */
export function limpiarTelefono(telefono: string, maximo: number): string {
  let limpio = '';
  let digitos = 0;

  for (const caracter of telefono) {
    if (caracter >= '0' && caracter <= '9') {
      if (digitos === maximo) continue;
      digitos++;
      limpio += caracter;
    } else if (SEPARADORES.has(caracter) || (caracter === '+' && limpio.trim() === '')) {
      limpio += caracter;
    }
  }

  return limpio;
}

/**
 * Si el número empieza por "+" y un indicativo conocido (lo normal al pegarlo
 * de WhatsApp o de los contactos), devuelve ese país y el resto del número.
 * Ningún indicativo es el comienzo de otro, así que se reconoce apenas se
 * termina de escribir. Si varios países lo comparten (+1, +7, +44…) se
 * conserva `actual` cuando es uno de ellos.
 */
export function separarIndicativo(
  telefono: string,
  actual: Country,
): { pais: Country; resto: string } | null {
  const texto = telefono.trimStart();
  if (!texto.startsWith('+')) return null;

  const digitos = texto.replace(/\D/g, '');
  for (let largo = 1; largo <= 3 && largo <= digitos.length; largo++) {
    const indicativo = digitos.slice(0, largo);
    const candidatos = COUNTRIES.filter((p) => p.code === indicativo);
    if (candidatos.length === 0) continue;

    const pais = candidatos.find((p) => p.iso === actual.iso) ?? candidatos[0]!;

    // Se quitan el "+" y los dígitos del indicativo, con los separadores que haya entre ellos.
    let vistos = 0;
    let i = 1;
    while (i < texto.length && vistos < largo) {
      if (/\d/.test(texto[i]!)) vistos++;
      i++;
    }
    return { pais, resto: texto.slice(i).trimStart() };
  }

  return null;
}

/**
 * Qué tiene mal el número, como frase que sigue a "El celular de…"; null si
 * está bien. Espera el número ya recortado de espacios.
 */
export function problemaTelefono(pais: Country, telefono: string): string | null {
  const { minimo, maximo } = limitesTelefono(pais);
  const digitos = contarDigitos(telefono);

  if (telefono.includes('+')) {
    return 'debe ir sin el indicativo: elige el país en la lista';
  }
  if (digitos < minimo || digitos > maximo) {
    if (minimo === maximo) return `debe tener ${minimo} dígitos`;
    return digitos < minimo
      ? `debe tener al menos ${minimo} dígitos`
      : `no puede tener más de ${maximo} dígitos`;
  }
  if (limpiarTelefono(telefono, maximo) !== telefono) {
    return 'solo puede tener números';
  }
  return null;
}

/**
 * El número en formato E.164: "+", indicativo y dígitos. Se quita el 0 que en
 * muchos países se marca antes del número dentro del país (el "09…" de un
 * celular de Ecuador, por ejemplo) y que no va en el formato internacional.
 */
export function componerE164(pais: Country, telefono: string): string {
  let digitos = telefono.replace(/\D/g, '');
  if (digitos.startsWith('0') && !CONSERVAN_CERO.has(pais.iso)) digitos = digitos.slice(1);
  return `+${pais.code}${digitos}`;
}
