import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.petdate.app',
  appName: 'PetDate',
  webDir: 'www',
  server: {
    url: 'https://petdate.ir',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Keep in sync with index.html viewport lock (no pinch zoom).
  },
};

export default config;
