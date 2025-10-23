import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Haptics from 'expo-haptics';

interface Thread {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
  last_message_time: string;
}

interface MessageThreadingProps {
  currentUserId: string;
  otherUserId: string;
  itemId: string | null;
  conversationType: 'item' | 'direct_message' | 'unified';
  selectedThreadId: string | null;
  onThreadSelect: (threadId: string | null) => void;
  onThreadCreated: (threadId: string, threadTitle: string) => void;
}

export function MessageThreading({
  currentUserId,
  otherUserId,
  itemId,
  conversationType,
  selectedThreadId,
  onThreadSelect,
  onThreadCreated,
}: MessageThreadingProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateThread, setShowCreateThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');

  useEffect(() => {
    fetchThreads();
  }, [currentUserId, otherUserId, itemId, conversationType]);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      
      // Build the filter based on conversation type
      let filter = `and(participant1.eq.${currentUserId},participant2.eq.${otherUserId})`;
      
      if (conversationType === 'item' && itemId) {
        filter += `,item_id.eq.${itemId}`;
      } else if (conversationType === 'direct_message') {
        filter += `,item_id.is.null`;
      }

      const { data, error } = await supabase
        .from('message_threads')
        .select(`
          *,
          messages:message_thread_messages(count)
        `)
        .or(filter)
        .order('last_message_time', { ascending: false });

      if (error) throw error;

      const formattedThreads = data?.map(thread => ({
        id: thread.id,
        title: thread.title,
        created_at: thread.created_at,
        message_count: thread.messages?.[0]?.count || 0,
        last_message_time: thread.last_message_time,
      })) || [];

      setThreads(formattedThreads);
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const createThread = async () => {
    if (!newThreadTitle.trim()) {
      Alert.alert('Error', 'Please enter a thread title');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('message_threads')
        .insert([{
          title: newThreadTitle.trim(),
          participant1: currentUserId,
          participant2: otherUserId,
          item_id: conversationType === 'item' ? itemId : null,
          created_by: currentUserId,
          last_message_time: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      setNewThreadTitle('');
      setShowCreateThread(false);
      onThreadCreated(data.id, data.title);
      fetchThreads();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating thread:', error);
      Alert.alert('Error', 'Failed to create thread');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const selectThread = (threadId: string | null) => {
    onThreadSelect(threadId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderThread = ({ item }: { item: Thread }) => (
    <TouchableOpacity
      style={[
        styles.threadItem,
        selectedThreadId === item.id && styles.selectedThread,
      ]}
      onPress={() => selectThread(item.id)}
    >
      <View style={styles.threadContent}>
        <Text style={styles.threadTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.threadMeta}>
          {item.message_count} messages
        </Text>
      </View>
      <View style={styles.threadIndicator}>
        {selectedThreadId === item.id && (
          <View style={styles.selectedIndicator} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Threads</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateThread(true)}
        >
          <Text style={styles.createButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={threads}
        renderItem={renderThread}
        keyExtractor={(item) => item.id}
        style={styles.threadList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No threads yet</Text>
            <Text style={styles.emptySubtext}>
              Create a thread to organize your conversation
            </Text>
          </View>
        }
      />

      {/* Create Thread Modal */}
      <Modal
        visible={showCreateThread}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateThread(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Thread</Text>
            
            <TextInput
              style={styles.titleInput}
              placeholder="Thread title"
              value={newThreadTitle}
              onChangeText={setNewThreadTitle}
              autoFocus
              maxLength={50}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateThread(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={createThread}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    backgroundColor: '#f8f9fa',
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  threadList: {
    flex: 1,
  },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectedThread: {
    backgroundColor: '#e3f2fd',
  },
  threadContent: {
    flex: 1,
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 4,
  },
  threadMeta: {
    fontSize: 12,
    color: '#6c757d',
  },
  threadIndicator: {
    width: 20,
    alignItems: 'center',
  },
  selectedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007bff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6c757d',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 20,
    textAlign: 'center',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
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
});
