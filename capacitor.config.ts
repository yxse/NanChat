import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';
const config: CapacitorConfig = {
  appId: 'com.nanwallet.app',
  appName: 'NanWallet',
  webDir: 'dist',
  plugins: {
    FirebaseMessaging: {
      presentationOptions: [],
    },
    Keyboard: {
      resize: KeyboardResize.None,
    },
  },
};

export default config;
