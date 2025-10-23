import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import QuickReply from './QuickReply';
import { supabase } from '../lib/supabase';

interface NotificationData {
  messageId: string;
  senderId: string;
  senderName: string;
  messageContent: string;
  itemId?: string;
}

interface NotificationQuickReplyProps {
  visible: boolean;
  notificationData: NotificationData | null;
  onClose: () => void;
  onReplySent: () => void;
}

export default function NotificationQuickReply({
  visible,
  notificationData,
  onClose,
  onReplySent,
}: NotificationQuickReplyProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleReplySent = () => {
    onReplySent();
    onClose();
  };

  if (!notificationData || !user) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Notification Preview */}
          <View style={styles.notificationPreview}>
            <View style={styles.notificationHeader}>
              <Text style={styles.senderName}>{notificationData.senderName}</Text>
              <Text style={styles.timestamp}>now</Text>
            </View>
            <Text style={styles.messagePreview} numberOfLines={2}>
              {notificationData.messageContent}
            </Text>
          </View>

          {/* Quick Reply Component */}
          <QuickReply
            messageId={notificationData.messageId}
            senderId={notificationData.senderId}
            receiverId={user.id}
            itemId={notificationData.itemId}
            onReplySent={handleReplySent}
            onClose={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  notificationPreview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748B',
  },
  messagePreview: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
});
