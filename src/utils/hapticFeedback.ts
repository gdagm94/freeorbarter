// Haptic feedback utility for web app
// Uses the Vibration API when available

export const hapticFeedback = {
  // Light haptic feedback (like button tap)
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  },

  // Medium haptic feedback (like selection change)
  medium: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  },

  // Heavy haptic feedback (like error or important action)
  heavy: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  },

  // Success haptic feedback (like successful action)
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }
  },

  // Error haptic feedback (like failed action)
  error: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  },

  // Custom vibration pattern
  custom: (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }
};

// Check if haptic feedback is supported
export const isHapticSupported = (): boolean => {
  return 'vibrate' in navigator;
};
