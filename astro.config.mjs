// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

/**
 * Nombre público de los archivos que Vite copia al build. Los originales de
 * design/originales llevan espacios y acentos (a veces descompuestos, NFD), y
 * eso en una URL es frágil: aquí se reduce a letras ASCII, números y guiones.
 * El archivo original no se toca; solo cambia el nombre de la copia servida.
 * @param {string} nombre
 */
function nombreLimpio(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// https://astro.build/config
export default defineConfig({
  // SSR: las rutas /api y la landing (que lee la sesión) necesitan servidor.
  output: 'server',
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (archivo) => {
            const nombre = (archivo.names[0] ?? 'archivo').replace(/\.[^.]+$/, '');
            return `_astro/${nombreLimpio(nombre) || 'archivo'}.[hash][extname]`;
          },
        },
      },
    },
  },
});
