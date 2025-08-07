import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Free or Barter',
  slug: 'freeorbarter-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  scheme: 'freeorbarter',
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
      NSLocationWhenInUseUsageDescription: 'Your location is used to show nearby items and enhance search results.',
      NSCameraUsageDescription: 'Camera access is used to take photos for your listings.',
      NSPhotoLibraryUsageDescription: 'Photo library access is used to select images for your listings.',
      NSPhotoLibraryAddUsageDescription: 'Allows saving images to your photo library.'
    }
  },
  android: {
    package: 'com.freeorbarter.mobile'
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
  plugins: [
    'expo-router'
  ]
});
