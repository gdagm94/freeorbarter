import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Message, Conversation } from '../types';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const conversationSorter = useMemo(() => (a: Conversation, b: Conversation) => {
    return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchConversations();

    const channel = supabase
      .channel('messages-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('id,sender_id,receiver_id,content,created_at,item_id,offer_item_id,read,is_offer,archived')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const map = new Map<string, Conversation & { _hasUnarchived: boolean }>();

      (data as Message[] | null)?.forEach((msg: any) => {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const convId = `user_${[user.id, otherUserId].sort().join('_')}`;
        const existing = map.get(convId);

        const unreadIncrement = msg.receiver_id === user.id && !msg.read ? 1 : 0;
        const hasOffer = !!msg.offer_item_id || !!msg.is_offer;
        const isUnarchived = !msg.archived;

        if (!existing) {
          map.set(convId, {
            id: convId,
            item_id: msg.item_id || '',
            item_title: '',
            item_image: '',
            other_user_id: otherUserId,
            other_user_name: 'User',
            other_user_avatar: null,
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: unreadIncrement,
            has_offer: hasOffer,
            archived: !isUnarchived,
            _hasUnarchived: isUnarchived,
          });
        } else {
          // Update last message if newer
          if (new Date(msg.created_at) > new Date(existing.last_message_time)) {
            existing.last_message = msg.content;
            existing.last_message_time = msg.created_at;
            existing.item_id = msg.item_id || '';
          }
          existing.unread_count += unreadIncrement;
          existing.has_offer = existing.has_offer || hasOffer;
          existing._hasUnarchived = existing._hasUnarchived || isUnarchived;
          existing.archived = !existing._hasUnarchived;
        }
      });

      const list = Array.from(map.values()).sort(conversationSorter).map(({ _hasUnarchived, ...conv }) => conv);
      setConversations(list);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity 
      style={styles.conversationItem}
      onPress={() => navigation.navigate('Chat', { otherUserId: item.other_user_id, itemId: item.item_id || null })}
    >
      <View style={styles.conversationHeader}>
        <Text style={styles.conversationTitle}>{item.other_user_name || 'Conversation'}</Text>
        <Text style={styles.conversationTime}>{new Date(item.last_message_time).toLocaleString()}</Text>
      </View>
      <Text style={styles.conversationPreview}>{item.last_message}</Text>
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Messages</Text>
        </View>
        <View style={styles.content}>
          <Text>Loading conversations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
      </View>
      
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation by messaging a seller about an item
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 16,
    color: '#3B82F6',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 16,
  },
  conversationItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  conversationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  conversationPreview: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
