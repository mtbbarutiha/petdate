import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { registerPetdateSW } from './lib/swRegister';
/* Full Pepito landing chrome must ship with the entry graph again.
 * Route-lazy + input/8s defer (#571) left about/services/hero grid unstyled
 * (giant blobs, RTL crush, dark void). Sheets are render-blocking on first paint —
 * do not media=print defer them (that FOUC matched "broken until scroll").
 * Shop-only CSS stays lazy via loadShopCss. */
import './styles/theme-dark.css';
import './styles/global.css';
import './styles/pepito.css';
import { initTheme } from './lib/theme';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { initLang } from './i18n/lang';

initTheme();
initLang();

/**
 * Product UX: block iOS Safari pinch-zoom gesture.
 * Web viewport meta allows accessibility zoom; Capacitor www + Android WebView stay locked.
 */
if (typeof window !== 'undefined') {
  const blockGestureZoom = (e: Event) => {
    e.preventDefault();
  };
  document.addEventListener('gesturestart', blockGestureZoom, { passive: false });
  document.addEventListener('gesturechange', blockGestureZoom, { passive: false });
  document.addEventListener('gestureend', blockGestureZoom, { passive: false });
}

/** Remount app chrome when language changes so all surfaces refresh without a full page reload. */
function LangKeyedApp() {
  const { lang } = useI18n();
  return <App key={lang} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        <BrowserRouter>
          <LangKeyedApp />
        </BrowserRouter>
      </I18nProvider>
    </AppErrorBoundary>
  </StrictMode>,
);

void registerPetdateSW();
