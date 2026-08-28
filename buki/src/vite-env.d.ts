/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUKI_MODE?: 'mock' | 'real'
  readonly VITE_BUKI_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
