import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FreeorBarter',
  slug: 'freeorbarter-mobile',
  scheme: 'freeorbarter',
  version: '1.0.5',
  orientation: 'default',
  userInterfaceStyle: 'light',
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
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'We need access to your photos to let you upload item images.',
      NSPhotoLibraryAddUsageDescription: 'We need permission to save images to your photo library.',
      NSCameraUsageDescription: 'We need camera access to take photos of your items.',
      ITSAppUsesNonExemptEncryption: false
    }
  },
  android: {
    package: 'com.freeorbarter.mobile'
  },
  plugins: [],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    passwordResetRedirect: process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT,
    eas: {
      projectId: '26392f6b-81c3-4ccf-9cf2-e64326418380'
    }
  }
});
