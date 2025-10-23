import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Haptics from 'expo-haptics';

interface CreateThreadFromMessageProps {
  visible: boolean;
  messageId: string;
  messageContent: string;
  currentUserId: string;
  otherUserId: string;
  itemId: string | null;
  conversationType: 'item' | 'direct_message' | 'unified';
  onThreadCreated: (threadId: string, threadTitle: string) => void;
  onClose: () => void;
}

export function CreateThreadFromMessage({
  visible,
  messageId,
  messageContent,
  currentUserId,
  otherUserId,
  itemId,
  conversationType,
  onThreadCreated,
  onClose,
}: CreateThreadFromMessageProps) {
  const [threadTitle, setThreadTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const createThread = async () => {
    if (!threadTitle.trim()) {
      Alert.alert('Error', 'Please enter a thread title');
      return;
    }

    try {
      setLoading(true);

      // Create the thread
      const { data: threadData, error: threadError } = await supabase
        .from('message_threads')
        .insert([{
          title: threadTitle.trim(),
          participant1: currentUserId,
          participant2: otherUserId,
          item_id: conversationType === 'item' ? itemId : null,
          created_by: currentUserId,
          last_message_time: new Date().toISOString(),
        }])
        .select()
        .single();

      if (threadError) throw threadError;

      // Associate the message with the thread
      const { error: messageError } = await supabase
        .from('messages')
        .update({ thread_id: threadData.id })
        .eq('id', messageId);

      if (messageError) throw messageError;

      setThreadTitle('');
      onThreadCreated(threadData.id, threadData.title);
      onClose();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating thread from message:', error);
      Alert.alert('Error', 'Failed to create thread');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setThreadTitle('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Thread</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>Thread Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter thread title"
              value={threadTitle}
              onChangeText={setThreadTitle}
              autoFocus
              maxLength={50}
            />

            <View style={styles.messagePreview}>
              <Text style={styles.previewLabel}>From message:</Text>
              <Text style={styles.previewContent} numberOfLines={3}>
                {messageContent}
              </Text>
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.createButton, loading && styles.disabledButton]}
                onPress={createThread}
                disabled={loading}
              >
                <Text style={styles.createButtonText}>
                  {loading ? 'Creating...' : 'Create Thread'}
                </Text>
              </TouchableOpacity>
            </View>
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
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6c757d',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  messagePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
    marginBottom: 4,
  },
  previewContent: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    marginRight: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  createButton: {
    backgroundColor: '#007bff',
    marginLeft: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
