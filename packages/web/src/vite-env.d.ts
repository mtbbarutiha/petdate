/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_PUBLIC_PDF_URL?: string;
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
  /** Microsoft Clarity project id (short alphanumeric — not a UUID). */
  readonly VITE_CLARITY_PROJECT_ID?: string;
  /** Google Tag Manager container id (e.g. GTM-KQPJT9Q4). */
  readonly VITE_GTM_ID?: string;
  /** Optional GA4 Measurement ID (G-XXXXXXXX). Never invent — leave unset until real. */
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly VITE_GOOGLE_ANALYTICS_ID?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
