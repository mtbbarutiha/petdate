import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { registerPetdateSW } from './lib/swRegister';
import './styles/global.css';
import './styles/pepito.css';
import './styles/chat.css';
import './styles/theme-dark.css';
import { initTheme } from './lib/theme';
import { I18nProvider, initLang } from './i18n';

initTheme();
initLang();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);

// Do not block first paint on SW registration / cache bust.
void registerPetdateSW();
