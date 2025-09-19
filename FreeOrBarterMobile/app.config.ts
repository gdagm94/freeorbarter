import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Free or Barter',
  slug: 'freeorbarter-mobile',
  scheme: 'freeorbarter',
  version: '1.0.0',
  orientation: 'portrait',
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
      NSCameraUsageDescription: 'We need camera access to take photos of your items.'
    }
  },
  android: {
    package: 'com.freeorbarter.mobile'
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  // plugins: [
  //   'expo-notifications'
  // ]
});
