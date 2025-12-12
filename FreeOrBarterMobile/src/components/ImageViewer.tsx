import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function ImageViewer({ visible, images, initialIndex = 0, onClose, onIndexChange }: ImageViewerProps) {
  if (!images.length) return null;

  const insets = useSafeAreaInsets();
  const normalizedImages = useMemo(
    () => images.map((uri) => ({ uri })),
    [images],
  );

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  return (
    <ImageViewing
      images={normalizedImages}
      imageIndex={currentIndex}
      visible={visible}
      onRequestClose={onClose}
      onImageIndexChange={(index) => {
        setCurrentIndex(index);
        onIndexChange?.(index);
      }}
      doubleTapToZoomEnabled
      swipeToCloseEnabled={false}
      presentationStyle="overFullScreen"
      animationType="none"
      backgroundColor="#000000"
      HeaderComponent={() => (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            accessibilityLabel="Close image viewer"
          >
            <Text style={styles.headerButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      FooterComponent={() => (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.footerTop}>
            <Text style={styles.footerText}>
              {currentIndex + 1} / {normalizedImages.length}
            </Text>
            <View style={styles.dotsRow}>
              {normalizedImages.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    gap: 12,
  },
  footerTop: {
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
});
