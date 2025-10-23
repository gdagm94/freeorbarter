import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface FileViewerProps {
  visible: boolean;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  onClose: () => void;
}

export function FileViewer({ 
  visible, 
  fileUrl, 
  fileName, 
  fileType, 
  fileSize, 
  onClose 
}: FileViewerProps) {
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
    if (!bytes || bytes === 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async () => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Get file extension from URL or filename
      const fileExt = fileName.split('.').pop() || 'file';
      const filename = `${fileName.split('.')[0]}_${Date.now()}.${fileExt}`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);
      
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri);
        Alert.alert('Success', 'File downloaded successfully');
      } else {
        Alert.alert('Error', 'Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const handleOpenExternally = async () => {
    try {
      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file type');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Alert.alert('Error', 'Failed to open file');
    }
  };

  const isImageFile = fileType.startsWith('image/');
  const isPdfFile = fileType.includes('pdf');
  const isTextFile = fileType.includes('text/') || fileType.includes('plain');

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>File Viewer</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.fileInfo}>
              <Text style={styles.fileIcon}>{getFileIcon(fileType)}</Text>
              <View style={styles.fileDetails}>
                <Text style={styles.fileName}>{fileName}</Text>
                <Text style={styles.fileType}>{fileType}</Text>
                {fileSize && (
                  <Text style={styles.fileSize}>{formatFileSize(fileSize)}</Text>
                )}
              </View>
            </View>

            <View style={styles.previewContainer}>
              {isImageFile && (
                <View style={styles.imagePreview}>
                  <Text style={styles.previewText}>🖼️ Image Preview</Text>
                  <Text style={styles.previewSubtext}>
                    Tap "Open Externally" to view the image
                  </Text>
                </View>
              )}
              
              {isPdfFile && (
                <View style={styles.pdfPreview}>
                  <Text style={styles.previewText}>📄 PDF Document</Text>
                  <Text style={styles.previewSubtext}>
                    Download to view the PDF content
                  </Text>
                </View>
              )}
              
              {isTextFile && (
                <View style={styles.textPreview}>
                  <Text style={styles.previewText}>📝 Text File</Text>
                  <Text style={styles.previewSubtext}>
                    Download to view the text content
                  </Text>
                </View>
              )}
              
              {!isImageFile && !isPdfFile && !isTextFile && (
                <View style={styles.genericPreview}>
                  <Text style={styles.previewText}>📎 File</Text>
                  <Text style={styles.previewSubtext}>
                    Download to access this file
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
              <Text style={styles.downloadButtonText}>💾 Download</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.externalButton} onPress={handleOpenExternally}>
              <Text style={styles.externalButtonText}>🔗 Open Externally</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fileIcon: {
    fontSize: 48,
    marginRight: 16,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  fileType: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  previewContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  imagePreview: {
    alignItems: 'center',
  },
  pdfPreview: {
    alignItems: 'center',
  },
  textPreview: {
    alignItems: 'center',
  },
  genericPreview: {
    alignItems: 'center',
  },
  previewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  previewSubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  externalButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  externalButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
});
