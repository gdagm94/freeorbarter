import { useState, useEffect } from 'react';
import { Platform, Dimensions, ScaledSize } from 'react-native';

interface DeviceInfo {
  isPad: boolean;
  isTablet: boolean;
  width: number;
  height: number;
  isLandscape: boolean;
  isPortrait: boolean;
}

export function useDeviceInfo(): DeviceInfo {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const width = dimensions.width;
  const height = dimensions.height;
  const isLandscape = width > height;
  const isPortrait = height > width;

  // Detect iPad: Platform.isPad on iOS, or screen size >= 600px on Android
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const isTablet = isPad || (Platform.OS === 'android' && (width >= 600 || height >= 600));

  return {
    isPad,
    isTablet,
    width,
    height,
    isLandscape,
    isPortrait,
  };
}

