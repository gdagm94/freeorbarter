import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FreeorBarter',
  slug: 'freeorbarter-mobile',
  scheme: 'freeorbarter',
  version: '1.0.9',
  orientation: 'default',
  userInterfaceStyle: 'light',
  notification: {
    // Allow alerts/badges while foreground on iOS; Android channel is created in code
    iosDisplayInForeground: true,
  },
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.freeorbarter.mobile',
    entitlements: {
      'com.apple.developer.aps-environment': 'production',
    },
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'We need access to your photos to let you upload item images.',
      NSPhotoLibraryAddUsageDescription: 'We need permission to save images to your photo library.',
      NSCameraUsageDescription: 'We need camera access to take photos of your items.',
      NSUserNotificationUsageDescription: 'We use notifications to alert you about new messages, offers, and account updates.',
      UIBackgroundModes: ['remote-notification', 'fetch'],
      ITSAppUsesNonExemptEncryption: false
    },
  },
  android: {
    package: 'com.freeorbarter.mobile'
  },
  plugins: [
    'expo-notifications',
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    passwordResetRedirect: process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT,
    eas: {
      projectId: '26392f6b-81c3-4ccf-9cf2-e64326418380'
    }
  }
});
