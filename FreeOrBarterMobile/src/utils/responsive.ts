import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useDeviceInfo } from '../hooks/useDeviceInfo';

export interface ResponsiveStyles {
  container: ViewStyle;
  contentContainer: ViewStyle;
  formContainer: ViewStyle;
  cardContainer: ViewStyle;
}

/**
 * Get responsive container styles based on device type
 */
export function useResponsiveStyles(): ResponsiveStyles {
  const { isTablet, width } = useDeviceInfo();
  const fullWidth: `${number}%` = '100%';

  // Max widths for different container types
  const maxWidths = {
    form: isTablet ? 600 : width,
    content: isTablet ? 1200 : width,
    card: isTablet ? 800 : width,
  };

  return {
    container: {
      width: fullWidth,
      maxWidth: maxWidths.content,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 24 : 16,
    },
    contentContainer: {
      width: fullWidth,
      maxWidth: maxWidths.content,
      alignSelf: 'center',
    },
    formContainer: {
      width: fullWidth,
      maxWidth: maxWidths.form,
      alignSelf: 'center',
    },
    cardContainer: {
      width: fullWidth,
      maxWidth: maxWidths.card,
      alignSelf: 'center',
    },
  };
}

/**
 * Get responsive padding based on device type
 */
export function getResponsivePadding(isTablet: boolean): number {
  return isTablet ? 24 : 16;
}

/**
 * Get responsive margin based on device type
 */
export function getResponsiveMargin(isTablet: boolean): number {
  return isTablet ? 24 : 16;
}

/**
 * Get number of columns for grid layouts based on device type
 */
export function getGridColumns(isTablet: boolean, isLandscape: boolean): number {
  if (isTablet) {
    return isLandscape ? 4 : 3;
  }
  return 2;
}

/**
 * Get responsive font size multiplier
 */
export function getFontSizeMultiplier(isTablet: boolean): number {
  return isTablet ? 1.1 : 1;
}

