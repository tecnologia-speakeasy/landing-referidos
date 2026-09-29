import type { Country } from './countries';
import { PAIS_POR_DEFECTO, paisPorIso } from './telefono';

/**
 * Selector de indicativo de una fila del formulario (ver SelectorPais.astro):
 * un botón con la bandera y el indicativo, y un campo oculto con el país que
 * se envía. Solo corre en el navegador.
 */

/** Texto comparable en el buscador: sin tildes y en minúsculas ("México" → "mexico"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** El país elegido en el selector. */
export function paisDe(selector: Element): Country {
  const iso = selector.querySelector<HTMLInputElement>('input[name="pais"]')?.value ?? '';
  return paisPorIso(iso) ?? PAIS_POR_DEFECTO;
}

/**
 * Cambia el país del selector y avisa con un evento `change` (que burbujea)
 * desde el campo oculto, para que el formulario ajuste el número.
 */
export function elegirPais(selector: Element, pais: Country): void {
  const valor = selector.querySelector<HTMLInputElement>('input[name="pais"]');
  const bandera = selector.querySelector<HTMLImageElement>('.bandera');
  const indicativo = selector.querySelector<HTMLElement>('.indicativo');
  if (!valor || !bandera || !indicativo || valor.value === pais.iso) return;

  valor.value = pais.iso;
  bandera.src = `/img/flags/${pais.iso}.svg`;
  bandera.alt = pais.name;
  indicativo.textContent = `+${pais.code}`;
  valor.dispatchEvent(new Event('change', { bubbles: true }));
}
