/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_JAVA_GATEWAY_URL: string;
  readonly VITE_EVAL_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
