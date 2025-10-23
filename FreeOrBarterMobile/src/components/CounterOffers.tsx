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
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Haptics from 'expo-haptics';

interface CounterOffer {
  id: string;
  original_offer_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string | null;
  };
  original_offer?: {
    content: string;
    sender?: {
      username: string;
    };
  };
}

interface CounterOffersProps {
  visible: boolean;
  messageId: string | null;
  currentUserId: string;
  onClose: () => void;
  onOfferResponse: () => void;
}

export function CounterOffers({ visible, messageId, currentUserId, onClose, onOfferResponse }: CounterOffersProps) {
  const [counterOffers, setCounterOffers] = useState<CounterOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateCounter, setShowCreateCounter] = useState(false);
  const [counterOfferMessage, setCounterOfferMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (visible && messageId) {
      fetchCounterOffers();
    }
  }, [visible, messageId]);

  const fetchCounterOffers = async () => {
    if (!messageId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('counter_offers')
        .select(`
          *,
          sender:sender_id (
            username,
            avatar_url
          ),
          original_offer:original_offer_id (
            content,
            sender:sender_id (
              username
            )
          )
        `)
        .eq('original_offer_id', messageId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCounterOffers(data || []);
    } catch (error) {
      console.error('Error fetching counter offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCounterOffer = async () => {
    if (!messageId || !user) return;
    if (!counterOfferMessage.trim()) {
      Alert.alert('Error', 'Please enter a counter offer message');
      return;
    }

    try {
      setSending(true);

      // First, get the original offer to find the receiver
      const { data: originalOffer, error: offerError } = await supabase
        .from('messages')
        .select('sender_id, receiver_id')
        .eq('id', messageId)
        .single();

      if (offerError) throw offerError;

      const { error } = await supabase
        .from('counter_offers')
        .insert([{
          original_offer_id: messageId,
          sender_id: user.id,
          receiver_id: originalOffer.sender_id,
          content: counterOfferMessage.trim(),
          status: 'pending',
        }]);

      if (error) throw error;

      setCounterOfferMessage('');
      setShowCreateCounter(false);
      fetchCounterOffers();
      onOfferResponse();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error creating counter offer:', error);
      Alert.alert('Error', 'Failed to create counter offer');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  const respondToCounterOffer = async (counterOfferId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('counter_offers')
        .update({ status })
        .eq('id', counterOfferId);

      if (error) throw error;

      // If accepted, create a new message
      if (status === 'accepted') {
        const counterOffer = counterOffers.find(co => co.id === counterOfferId);
        if (counterOffer) {
          await supabase
            .from('messages')
            .insert([{
              content: `Counter offer accepted: ${counterOffer.content}`,
              sender_id: currentUserId,
              receiver_id: counterOffer.sender_id,
              item_id: null,
              read: false,
              is_offer: true,
              archived: false,
            }]);
        }
      }

      fetchCounterOffers();
      onOfferResponse();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error responding to counter offer:', error);
      Alert.alert('Error', 'Failed to respond to counter offer');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const renderCounterOffer = ({ item }: { item: CounterOffer }) => (
    <View style={styles.counterOfferCard}>
      <View style={styles.counterOfferHeader}>
        <View style={styles.senderInfo}>
          <Text style={styles.senderName}>
            {item.sender?.username || 'Unknown User'}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={[
          styles.statusBadge, 
          item.status === 'pending' ? styles.statusPending :
          item.status === 'accepted' ? styles.statusAccepted :
          styles.statusDeclined
        ]}>
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.counterOfferContent}>
        {item.content}
      </Text>

      {item.status === 'pending' && item.receiver_id === currentUserId && (
        <View style={styles.responseButtons}>
          <TouchableOpacity
            style={[styles.responseButton, styles.declineButton]}
            onPress={() => respondToCounterOffer(item.id, 'declined')}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.responseButton, styles.acceptButton]}
            onPress={() => respondToCounterOffer(item.id, 'accepted')}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

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
            <Text style={styles.title}>Counter Offers</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowCreateCounter(true)}
              >
                <Text style={styles.createButtonText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={counterOffers}
            renderItem={renderCounterOffer}
            keyExtractor={(item) => item.id}
            style={styles.counterOffersList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No counter offers yet</Text>
                <Text style={styles.emptySubtext}>
                  Make a counter offer to negotiate
                </Text>
              </View>
            }
          />

          {/* Create Counter Offer Modal */}
          <Modal
            visible={showCreateCounter}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCreateCounter(false)}
          >
            <View style={styles.overlay}>
              <View style={styles.createContainer}>
                <View style={styles.createHeader}>
                  <Text style={styles.createTitle}>Make Counter Offer</Text>
                  <TouchableOpacity
                    onPress={() => setShowCreateCounter(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.createContent}>
                  <Text style={styles.label}>Counter Offer Message</Text>
                  <TextInput
                    style={styles.messageInput}
                    placeholder="Enter your counter offer..."
                    value={counterOfferMessage}
                    onChangeText={setCounterOfferMessage}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                  />

                  <View style={styles.createButtons}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => setShowCreateCounter(false)}
                      disabled={sending}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, styles.sendButton, sending && styles.disabledButton]}
                      onPress={createCounterOffer}
                      disabled={sending}
                    >
                      <Text style={styles.sendButtonText}>
                        {sending ? 'Sending...' : 'Send Counter Offer'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
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
    height: '80%',
    maxWidth: 500,
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffc107',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
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
  counterOffersList: {
    flex: 1,
    padding: 16,
  },
  counterOfferCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  counterOfferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  timestamp: {
    fontSize: 12,
    color: '#6c757d',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#fff3cd',
  },
  statusAccepted: {
    backgroundColor: '#d4edda',
  },
  statusDeclined: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#495057',
  },
  counterOfferContent: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
    marginBottom: 12,
  },
  responseButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  responseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  declineButton: {
    backgroundColor: '#dc3545',
  },
  declineButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  acceptButton: {
    backgroundColor: '#28a745',
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
  createContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  createTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
  },
  createContent: {
    padding: 20,
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
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  createButtons: {
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
    backgroundColor: '#ffc107',
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
