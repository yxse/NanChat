import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nanwallet.app',
  appName: 'NanWallet',
  webDir: 'dist',
  plugins: {
    FirebaseMessaging: {
      presentationOptions: [],
    },
  },
};

export default config;
