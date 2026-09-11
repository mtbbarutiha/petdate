/* Fallback for older clients that still request /registerSW.js.
   Current app registers /sw.js from src/lib/swRegister.ts. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  });
}
