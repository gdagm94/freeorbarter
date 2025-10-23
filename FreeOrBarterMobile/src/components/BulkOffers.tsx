import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Haptics from 'expo-haptics';

interface Item {
  id: string;
  title: string;
  images: string[];
  type: 'free' | 'barter';
  user_id: string;
}

interface BulkOffersProps {
  visible: boolean;
  currentUserId: string;
  otherUserId: string;
  onClose: () => void;
  onOffersSent: () => void;
}

export function BulkOffers({ visible, currentUserId, otherUserId, onClose, onOffersSent }: BulkOffersProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [offerMessage, setOfferMessage] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState('Hi! I\'m interested in your items. Would you like to trade?');
  const { user } = useAuth();

  useEffect(() => {
    if (visible && user) {
      fetchUserItems();
    }
  }, [visible, user]);

  const fetchUserItems = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('id, title, images, type, user_id')
        .eq('user_id', user.id)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectAllItems = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const sendBulkOffers = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('Error', 'Please select at least one item');
      return;
    }

    const message = useTemplate ? templateMessage : offerMessage;
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter an offer message');
      return;
    }

    try {
      setSending(true);

      const selectedItemsList = Array.from(selectedItems);
      const offers = selectedItemsList.map(itemId => ({
        content: message.trim(),
        sender_id: currentUserId,
        receiver_id: otherUserId,
        item_id: null, // This is a bulk offer, not tied to a specific item
        offer_item_id: itemId,
        read: false,
        is_offer: true,
        archived: false,
      }));

      const { error } = await supabase
        .from('messages')
        .insert(offers);

      if (error) throw error;

      // Update template usage count if using template
      if (useTemplate) {
        // This would require storing template ID, for now just a placeholder
        console.log('Template used');
      }

      Alert.alert('Success', `Sent ${selectedItemsList.length} offer(s) successfully!`);
      onOffersSent();
      onClose();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sending bulk offers:', error);
      Alert.alert('Error', 'Failed to send offers');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const isSelected = selectedItems.has(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.itemCard, isSelected && styles.selectedItem]}
        onPress={() => toggleItemSelection(item.id)}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemImageContainer}>
            {item.images && item.images.length > 0 ? (
              <Text style={styles.imagePlaceholder}>📷</Text>
            ) : (
              <Text style={styles.imagePlaceholder}>📦</Text>
            )}
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.itemType}>
              {item.type === 'free' ? 'Free' : 'Barter'}
            </Text>
          </View>
          <View style={styles.selectionIndicator}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Bulk Offers</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionText}>
                {selectedItems.size} of {items.length} items selected
              </Text>
              <TouchableOpacity onPress={selectAllItems} style={styles.selectAllButton}>
                <Text style={styles.selectAllText}>
                  {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              style={styles.itemsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No items available</Text>
                  <Text style={styles.emptySubtext}>
                    Add some items to your profile first
                  </Text>
                </View>
              }
            />

            <View style={styles.messageSection}>
              <View style={styles.templateToggle}>
                <Text style={styles.templateLabel}>Use template message</Text>
                <Switch
                  value={useTemplate}
                  onValueChange={setUseTemplate}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={useTemplate ? '#f5dd4b' : '#f4f3f4'}
                />
              </View>

              <Text style={styles.label}>Offer Message</Text>
              <TextInput
                style={styles.messageInput}
                placeholder={useTemplate ? "Template message will be used" : "Enter your offer message..."}
                value={useTemplate ? templateMessage : offerMessage}
                onChangeText={useTemplate ? setTemplateMessage : setOfferMessage}
                multiline
                numberOfLines={3}
                editable={!useTemplate}
                maxLength={500}
              />
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={sending}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.sendButton, sending && styles.disabledButton]}
                onPress={sendBulkOffers}
                disabled={sending || selectedItems.size === 0}
              >
                <Text style={styles.sendButtonText}>
                  {sending ? 'Sending...' : `Send ${selectedItems.size} Offers`}
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
    width: '95%',
    height: '90%',
    maxWidth: 600,
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
    flex: 1,
    padding: 16,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#495057',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007bff',
    borderRadius: 6,
  },
  selectAllText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  itemsList: {
    flex: 1,
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedItem: {
    borderColor: '#007bff',
    backgroundColor: '#e3f2fd',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  itemImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  imagePlaceholder: {
    fontSize: 24,
  },
  itemDetails: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 4,
  },
  itemType: {
    fontSize: 12,
    color: '#6c757d',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: 'bold',
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
  messageSection: {
    marginBottom: 16,
  },
  templateToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 80,
    textAlignVertical: 'top',
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
  sendButton: {
    backgroundColor: '#28a745',
    marginLeft: 8,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
