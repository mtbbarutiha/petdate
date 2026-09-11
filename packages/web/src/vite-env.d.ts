/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_PUBLIC_PDF_URL?: string;
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  /** Microsoft Clarity project id (short alphanumeric — not a UUID). */
  readonly VITE_CLARITY_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
