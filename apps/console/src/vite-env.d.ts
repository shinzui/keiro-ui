/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The console's version, injected by Vite `define` (apps/console/vite.config.ts). */
declare const __APP_VERSION__: string
/** The short git commit the bundle was built from, or "unknown". */
declare const __GIT_COMMIT__: string
