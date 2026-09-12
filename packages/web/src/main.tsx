import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { registerPetdateSW } from './lib/swRegister';
import './styles/global.css';
import './styles/pepito.css';
import './styles/chat.css';
import './styles/theme-dark.css';
import { initTheme } from './lib/theme';
import { I18nProvider, initLang, useI18n } from './i18n';

initTheme();
initLang();

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
