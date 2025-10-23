import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';

interface FileAttachmentProps {
  onFileUpload: (fileUrl: string, fileName: string, fileType: string) => void;
  onClose: () => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
}

export function FileAttachment({ onFileUpload, onClose, uploading, setUploading }: FileAttachmentProps) {
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);

      // Create a unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `message-files/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('message-files')
        .upload(filePath, selectedFile, {
          contentType: selectedFile.mimeType || 'application/octet-stream',
        });

      if (error) {
        console.error('Error uploading file:', error);
        Alert.alert('Error', 'Failed to upload file');
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('message-files')
        .getPublicUrl(filePath);

      onFileUpload(urlData.publicUrl, selectedFile.name, selectedFile.mimeType || 'application/octet-stream');
      onClose();
    } catch (error) {
      console.error('Error in uploadFile:', error);
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

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
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Attach File</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {!selectedFile ? (
              <View style={styles.pickerContainer}>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={pickDocument}
                  disabled={uploading}
                >
                  <Text style={styles.pickerIcon}>📁</Text>
                  <Text style={styles.pickerText}>Choose File</Text>
                  <Text style={styles.pickerSubtext}>
                    Select a document, image, or other file
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.filePreview}>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileIcon}>
                    {getFileIcon(selectedFile.mimeType || '')}
                  </Text>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={2}>
                      {selectedFile.name}
                    </Text>
                    <Text style={styles.fileSize}>
                      {formatFileSize(selectedFile.size || 0)}
                    </Text>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={styles.changeFileButton}
                  onPress={pickDocument}
                  disabled={uploading}
                >
                  <Text style={styles.changeFileText}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={uploading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.uploadButton,
                (!selectedFile || uploading) && styles.uploadButtonDisabled
              ]}
              onPress={uploadFile}
              disabled={!selectedFile || uploading}
            >
              <Text style={[
                styles.uploadButtonText,
                (!selectedFile || uploading) && styles.uploadButtonTextDisabled
              ]}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  content: {
    padding: 16,
  },
  pickerContainer: {
    alignItems: 'center',
  },
  pickerButton: {
    alignItems: 'center',
    padding: 32,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  pickerIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  pickerSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
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
    color: '#374151',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  changeFileButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
  },
  changeFileText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  uploadButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  uploadButtonTextDisabled: {
    color: '#D1D5DB',
  },
});
