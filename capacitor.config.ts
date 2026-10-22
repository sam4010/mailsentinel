import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mailsentinel.app',
  appName: 'MailSentinel',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https'
  }
};

export default config;
