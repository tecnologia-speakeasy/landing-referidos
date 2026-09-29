/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SESSION_SECRET?: string;
  readonly PGHOST?: string;
  readonly PGPORT?: string;
  readonly PGUSER?: string;
  readonly PGPASSWORD?: string;
  readonly PGDATABASE?: string;
  readonly PGSCHEMA?: string;
  readonly PGSSL?: string;
  readonly PGPOOL_MAX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
