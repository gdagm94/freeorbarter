import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Draft {
  id: string;
  content: string;
  timestamp: number;
}

interface MessageDraftsProps {
  currentUserId: string;
  otherUserId: string;
  conversationType: 'item' | 'direct_message' | 'unified';
  itemId?: string | null;
  onDraftSelect: (content: string) => void;
}

export function MessageDrafts({ 
  currentUserId, 
  otherUserId, 
  conversationType, 
  itemId, 
  onDraftSelect 
}: MessageDraftsProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  const getStorageKey = () => {
    const baseKey = `drafts_${currentUserId}_${otherUserId}`;
    if (conversationType === 'item' && itemId) {
      return `${baseKey}_${itemId}`;
    }
    return baseKey;
  };

  const loadDrafts = async () => {
    try {
      const key = getStorageKey();
      const storedDrafts = await AsyncStorage.getItem(key);
      if (storedDrafts) {
        setDrafts(JSON.parse(storedDrafts));
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    }
  };

  const saveDraft = async (content: string) => {
    if (!content.trim()) return;

    try {
      const key = getStorageKey();
      const newDraft: Draft = {
        id: Date.now().toString(),
        content: content.trim(),
        timestamp: Date.now(),
      };

      const updatedDrafts = [newDraft, ...drafts.slice(0, 4)]; // Keep only 5 drafts
      setDrafts(updatedDrafts);
      await AsyncStorage.setItem(key, JSON.stringify(updatedDrafts));
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  const clearDrafts = async () => {
    try {
      const key = getStorageKey();
      setDrafts([]);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing drafts:', error);
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      const key = getStorageKey();
      const updatedDrafts = drafts.filter(draft => draft.id !== draftId);
      setDrafts(updatedDrafts);
      await AsyncStorage.setItem(key, JSON.stringify(updatedDrafts));
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  const handleDraftSelect = (content: string) => {
    onDraftSelect(content);
    setShowDrafts(false);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Drafts',
      'Are you sure you want to delete all saved drafts?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearDrafts },
      ]
    );
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  useEffect(() => {
    loadDrafts();
  }, [currentUserId, otherUserId, conversationType, itemId]);

  // Expose saveDraft function for external use
  useEffect(() => {
    // This is a workaround to expose the saveDraft function
    // In a real implementation, you might want to use a context or ref
  }, []);

  if (drafts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.draftsButton}
        onPress={() => setShowDrafts(true)}
      >
        <Text style={styles.draftsIcon}>📝</Text>
        <Text style={styles.draftsCount}>{drafts.length}</Text>
      </TouchableOpacity>

      <Modal
        visible={showDrafts}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDrafts(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.draftsModal}>
            <View style={styles.draftsHeader}>
              <Text style={styles.draftsTitle}>Saved Drafts</Text>
              <View style={styles.headerActions}>
                {drafts.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearAll}
                  >
                    <Text style={styles.clearButtonText}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowDrafts(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={drafts}
              keyExtractor={(item) => item.id}
              style={styles.draftsList}
              renderItem={({ item }) => (
                <View style={styles.draftItem}>
                  <TouchableOpacity
                    style={styles.draftContent}
                    onPress={() => handleDraftSelect(item.content)}
                  >
                    <Text style={styles.draftText} numberOfLines={2}>
                      {item.content}
                    </Text>
                    <Text style={styles.draftTime}>
                      {formatTime(item.timestamp)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteDraft(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Hook for external components to use
export function useMessageDrafts(
  currentUserId: string,
  otherUserId: string,
  conversationType: 'item' | 'direct_message' | 'unified',
  itemId?: string | null
) {
  const saveDraft = async (content: string) => {
    if (!content.trim()) return;

    try {
      const baseKey = `drafts_${currentUserId}_${otherUserId}`;
      const key = conversationType === 'item' && itemId ? `${baseKey}_${itemId}` : baseKey;
      
      const storedDrafts = await AsyncStorage.getItem(key);
      const drafts: Draft[] = storedDrafts ? JSON.parse(storedDrafts) : [];
      
      const newDraft: Draft = {
        id: Date.now().toString(),
        content: content.trim(),
        timestamp: Date.now(),
      };

      const updatedDrafts = [newDraft, ...drafts.slice(0, 4)];
      await AsyncStorage.setItem(key, JSON.stringify(updatedDrafts));
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  const clearDrafts = async () => {
    try {
      const baseKey = `drafts_${currentUserId}_${otherUserId}`;
      const key = conversationType === 'item' && itemId ? `${baseKey}_${itemId}` : baseKey;
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing drafts:', error);
    }
  };

  return { saveDraft, clearDrafts };
}

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
  },
  draftsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  draftsIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  draftsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  draftsModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingTop: 20,
  },
  draftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  draftsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
  },
  draftsList: {
    maxHeight: 300,
  },
  draftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  draftContent: {
    flex: 1,
  },
  draftText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  draftTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
});
