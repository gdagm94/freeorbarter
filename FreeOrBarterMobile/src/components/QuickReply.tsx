import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

interface QuickReplyProps {
  messageId: string;
  senderId: string;
  receiverId: string;
  itemId?: string | null;
  onReplySent?: () => void;
  onClose?: () => void;
}

const QUICK_REPLIES = [
  "Thanks!",
  "Sounds good",
  "I'm interested",
  "Let me think about it",
  "Can we meet up?",
  "What's your location?",
  "Perfect!",
  "No thanks",
];

export default function QuickReply({
  messageId,
  senderId,
  receiverId,
  itemId,
  onReplySent,
  onClose,
}: QuickReplyProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendQuickReply = async (replyText?: string) => {
    const messageContent = replyText || message.trim();
    if (!messageContent) return;

    try {
      setSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { error } = await supabase
        .from('messages')
        .insert([{
          sender_id: receiverId, // Current user is the receiver responding
          receiver_id: senderId,
          content: messageContent,
          item_id: itemId || null,
          read: false,
          is_offer: false,
        }]);

      if (error) {
        console.error('Error sending quick reply:', error);
        Alert.alert('Error', 'Failed to send reply');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage('');
      
      if (onReplySent) {
        onReplySent();
      }
    } catch (error) {
      console.error('Error in sendQuickReply:', error);
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleQuickReplyPress = (reply: string) => {
    sendQuickReply(reply);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Quick Reply</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Reply Buttons */}
      <View style={styles.quickRepliesContainer}>
        <Text style={styles.quickRepliesTitle}>Quick responses:</Text>
        <View style={styles.quickRepliesGrid}>
          {QUICK_REPLIES.map((reply, index) => (
            <TouchableOpacity
              key={index}
              style={styles.quickReplyButton}
              onPress={() => handleQuickReplyPress(reply)}
              disabled={sending}
            >
              <Text style={styles.quickReplyText}>{reply}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Custom Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a custom reply..."
          multiline
          maxLength={500}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!message.trim() || sending) && styles.sendButtonDisabled
          ]}
          onPress={() => sendQuickReply()}
          disabled={!message.trim() || sending}
        >
          <Text style={styles.sendButtonText}>
            {sending ? 'Sending...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  quickRepliesContainer: {
    marginBottom: 16,
  },
  quickRepliesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  quickRepliesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickReplyButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickReplyText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
