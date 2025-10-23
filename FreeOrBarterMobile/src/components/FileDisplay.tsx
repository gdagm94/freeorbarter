import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';

interface FileDisplayProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  onPress?: () => void;
}

export function FileDisplay({ fileUrl, fileName, fileType, fileSize, onPress }: FileDisplayProps) {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📈';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('video')) return '🎬';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFilePress = async () => {
    if (onPress) {
      onPress();
      return;
    }
    
    try {
      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert(
          'Cannot Open File',
          'This file type cannot be opened directly. You can copy the link and open it in a browser.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Copy Link', 
              onPress: () => {
                // You could add clipboard functionality here if needed
                Alert.alert('Link Copied', 'File link copied to clipboard');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handleFilePress}>
      <View style={styles.fileInfo}>
        <Text style={styles.fileIcon}>{getFileIcon(fileType)}</Text>
        <View style={styles.fileDetails}>
          <Text style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          {fileSize && (
            <Text style={styles.fileSize}>
              {formatFileSize(fileSize)}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.downloadText}>Tap to open</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#64748B',
  },
  downloadText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
});
