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
};

export default config;
