import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';
const config: CapacitorConfig = {
  appId: 'com.nanchat.app',
  appName: 'NanChat',
  webDir: 'dist',
  plugins: {
    FirebaseMessaging: {
      presentationOptions: [],
    },
    Keyboard: {
      resize: KeyboardResize.None,
    },
    LocalNotifications: {
      smallIcon: "nanchat_notif",
    },
  },
};

if (process.env.NODE_ENV === 'development') {
  config.server = {
    url: process.env.CAPACITOR_DEV_SERVER_URL || 'http://localhost:5173',
    cleartext: true,
  };
}
export default config;
