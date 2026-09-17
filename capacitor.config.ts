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
    // Capacitor www keeps viewport zoom locked; public web allows a11y pinch-zoom.
  },
};

export default config;
