# Landing de referidos — Speak Easy

Página para que los estudiantes de Speak Easy refieran a familiares y amigos al
programa Aprende Inglés con Speak Easy.

- **Astro 7** en modo servidor (SSR) desplegado en **Vercel**
- **Tailwind CSS 4**, diseño móvil primero (desktop a partir de 1024px)
- **PostgreSQL** con el paquete `pg` (sin ORM) y migraciones en SQL plano
- Misma base de datos que `landing-auth-zoom`, pero en su propio esquema: `referidos`

Diseño: Figma · REFERIDOS-LANDING ([desktop](https://www.figma.com/design/6tLeXU2MUMznXXYUPqrkHB/REFERIDOS-LANDING?node-id=5-45),
[móvil](https://www.figma.com/design/6tLeXU2MUMznXXYUPqrkHB/REFERIDOS-LANDING?node-id=21-2)).

---

## Cómo funciona

1. El estudiante entra a `/` y escribe su **nombre** y su **correo** (misma
   página de entrada que `landing-auth-zoom`). No se valida el formato: solo que
   no vayan vacíos.
2. `POST /api/estudiante` hace *upsert* en `estudiantes` por correo (recortado y
   en minúsculas) y deja una **cookie firmada** (JWT HS256, `httpOnly`, 30 días)
   con el id del estudiante. Si el correo ya existía, se reutiliza el registro.
3. En `/referidos` ve la landing y, al final, el formulario de hasta **5
   referidos** (nombre y celular). Sin cookie válida, vuelve a `/`.
4. `POST /api/referidos` guarda las filas llenas en `persona_referida`,
   asociadas al estudiante de la cookie:
   - las filas vacías se ignoran; las que tienen solo nombre o solo celular se
     rechazan;
   - el tope de 5 cuenta también los envíos anteriores, y se comprueba en la
     misma transacción que inserta, con el estudiante bloqueado.

## Base de datos

```
referidos.estudiantes        id, nombre, email (único), creado_en, actualizado_en
referidos.persona_referida   id, estudiante_id → estudiantes.id, nombre, telefono, creado_en
```

Consulta rápida de quién refirió a quién:

```sql
SELECT e.nombre AS estudiante, e.email, p.nombre AS referido, p.telefono, p.creado_en
FROM referidos.persona_referida p
JOIN referidos.estudiantes e ON e.id = p.estudiante_id
ORDER BY p.creado_en DESC;
```

## Puesta en marcha

```sh
npm install
cp .env.example .env.local     # y rellenar los datos de PostgreSQL y SESSION_SECRET
npm run migrate                # crea el esquema `referidos` y sus tablas si faltan
npm run dev
```

En Vercel hay que cargar las mismas variables de `.env.example` en
*Settings → Environment Variables*.

### Windows con Smart App Control

Si `npm run dev` falla con *"Cannot find native binding"*, no es un problema de
npm: Smart App Control bloquea el compilador nativo de Astro. Se soluciona con
la versión WebAssembly del compilador, que Astro usa sola cuando la nativa no
carga (hay que repetirlo después de cada `npm install`):

```sh
npm install --no-save --force @astrojs/compiler-binding-wasm32-wasi@<versión de @astrojs/compiler-binding>
```

## Imágenes

La página usa los **originales de diseño tal cual**, desde `design/originales/`
(fondos, foto de Felipe y fondos del formulario de entrada). Se cargan en
`src/lib/originales.ts` y Vite los copia sin tocarlos al build, con un nombre
público limpio (sin espacios ni acentos, ver `astro.config.mjs`). Para cambiar
una imagen basta con reemplazar el archivo en `design/originales/` manteniendo
su nombre.

Los iconos de las tarjetas (`public/img/iconos/`) también son los originales y
se sirven tal cual.

`public/img/*.webp` y `npm run optimizar-imagenes` son versiones comprimidas de
esos mismos originales; hoy la página no las usa.

La foto de Felipe trae el halo incluido, así que es mucho más grande que la
persona: su tamaño y posición en cada breakpoint están calculados en
`src/styles/global.css` (`.foto-felipe`). Si cambia el original, hay que
revisar esas cifras.

## Estructura

```
db/migrations/001_init.sql        Tablas estudiantes y persona_referida
scripts/migrate.mjs               Aplica las migraciones pendientes (npm run migrate)
scripts/optimizar-imagenes.mjs    Genera public/img desde design/originales
src/lib/env.ts                    Validación de variables de entorno (zod)
src/lib/db.ts                     Pool de PostgreSQL (singleton)
src/lib/session.ts                Cookie firmada con el id del estudiante
src/lib/referidos.ts              Tope de referidos y conteo por estudiante
src/lib/originales.ts             Imágenes originales de design/originales
src/layouts/Layout.astro          <head> común: favicon, precarga de fuente
src/styles/global.css             Fuentes, tokens del diseño, fondos y tarjetas
src/components/TarjetaBeneficio.astro   Tarjeta de "¿Cómo funciona este regalo?"
src/pages/index.astro             Formulario de entrada (nombre y correo)
src/pages/referidos.astro         Landing con el formulario de referidos
src/pages/api/estudiante.ts       Registra al estudiante y crea la cookie
src/pages/api/referidos.ts        Guarda los referidos del estudiante
```
