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
  Dimensions,
  SafeAreaView,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';

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

  const getFileTypeDisplay = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'Image File';
    if (mimeType.includes('pdf')) return 'PDF Document';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Word Document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel Spreadsheet';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PowerPoint Presentation';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive File';
    if (mimeType.includes('audio')) return 'Audio File';
    if (mimeType.includes('video')) return 'Video File';
    if (mimeType.includes('text/')) return 'Text File';
    return 'Unknown File Type';
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Get file extension from URL or filename
      const fileExt = fileName.split('.').pop() || 'file';
      const filename = `${fileName.split('.')[0]}_${Date.now()}.${fileExt}`;
      
      // Use the legacy FileSystem API
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);
      
      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'File downloaded successfully');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const handleOpenExternally = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Cannot open this file type');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>File Viewer</Text>
              <Text style={styles.subtitle}>Preview and manage your file</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }} 
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* File Information Card */}
            <View style={styles.fileCard}>
              <View style={styles.fileIconContainer}>
                <Text style={styles.fileIcon}>{getFileIcon(fileType)}</Text>
              </View>
              
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {fileName}
                </Text>
                <Text style={styles.fileTypeDisplay}>
                  {getFileTypeDisplay(fileType)}
                </Text>
                {fileSize && (
                  <View style={styles.fileSizeContainer}>
                    <Text style={styles.fileSizeLabel}>Size:</Text>
                    <Text style={styles.fileSize}>{formatFileSize(fileSize)}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* File Preview Section */}
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Preview</Text>
              
              <View style={styles.previewContainer}>
                {isImageFile && (
                  <View style={styles.previewContent}>
                    <Text style={styles.previewIcon}>🖼️</Text>
                    <Text style={styles.previewText}>Image File</Text>
                    <Text style={styles.previewSubtext}>
                      Tap "Open Externally" to view the full image
                    </Text>
                  </View>
                )}
                
                {isPdfFile && (
                  <View style={styles.previewContent}>
                    <Text style={styles.previewIcon}>📄</Text>
                    <Text style={styles.previewText}>PDF Document</Text>
                    <Text style={styles.previewSubtext}>
                      Download to view the PDF content on your device
                    </Text>
                  </View>
                )}
                
                {isTextFile && (
                  <View style={styles.previewContent}>
                    <Text style={styles.previewIcon}>📝</Text>
                    <Text style={styles.previewText}>Text File</Text>
                    <Text style={styles.previewSubtext}>
                      Download to read the text content
                    </Text>
                  </View>
                )}
                
                {!isImageFile && !isPdfFile && !isTextFile && (
                  <View style={styles.previewContent}>
                    <Text style={styles.previewIcon}>📎</Text>
                    <Text style={styles.previewText}>File Attachment</Text>
                    <Text style={styles.previewSubtext}>
                      Download to access this file on your device
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleDownload}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonIcon}>💾</Text>
              <Text style={styles.primaryButtonText}>Download File</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={handleOpenExternally}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonIcon}>🔗</Text>
              <Text style={styles.secondaryButtonText}>Open Externally</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  fileCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fileIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  fileIcon: {
    fontSize: 40,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 24,
  },
  fileTypeDisplay: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  fileSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileSizeLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    marginRight: 8,
  },
  fileSize: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  previewSection: {
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  previewContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  previewContent: {
    alignItems: 'center',
  },
  previewIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  previewText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  previewSubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  secondaryButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
  },
});
