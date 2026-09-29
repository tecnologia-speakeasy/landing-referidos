-- =============================================================================
-- 001_init — esquema inicial de la landing de referidos Speak Easy
--
-- Las tablas se crean en el esquema indicado por PGSCHEMA (por defecto
-- `referidos`); el script de migración lo crea si falta y fija el search_path
-- antes de ejecutar este archivo, por eso aquí van sin prefijo.
--
-- Todo es `IF NOT EXISTS`: correrlo sobre una base donde las tablas ya existen
-- no altera nada.
-- =============================================================================

-- Estudiantes que refieren: el nombre y el correo que escriben en el
-- formulario de entrada. El correo es único para que, si alguien vuelve a
-- entrar, sus referidos sigan colgando del mismo estudiante.
CREATE TABLE IF NOT EXISTS estudiantes (
  id              SERIAL      PRIMARY KEY,
  nombre          TEXT        NOT NULL,
  email           TEXT        NOT NULL UNIQUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personas referidas: cada una pertenece al estudiante que la refirió.
CREATE TABLE IF NOT EXISTS persona_referida (
  id             SERIAL      PRIMARY KEY,
  estudiante_id  INTEGER     NOT NULL REFERENCES estudiantes (id) ON DELETE CASCADE,
  nombre         TEXT        NOT NULL,
  telefono       TEXT        NOT NULL,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS persona_referida_estudiante_idx ON persona_referida (estudiante_id);
