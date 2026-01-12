import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  RefreshControl,
  Animated,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Message, Conversation } from '../types';
import * as Haptics from 'expo-haptics';

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'offers' | 'deleted'>('all');
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const swipeAnimations = useRef<Map<string, Animated.Value>>(new Map());

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) fetchConversations();
    });
    return unsubscribe;
  }, [navigation, user]);

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          items:item_id (
            id,
            title,
            images,
            type
          ),
          sender:sender_id (
            username,
            avatar_url
          ),
          receiver:receiver_id (
            username,
            avatar_url
          )
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by user pairs
      const conversationMap = new Map<string, Conversation>();
      const unreadCountMap = new Map<string, number>();

      (data as any[])?.forEach(message => {
        const otherUserId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
        const conversationId = `user_${[user.id, otherUserId].sort().join('_')}`;

        // Track unread counts
        if (message.receiver_id === user.id && !message.read) {
          unreadCountMap.set(
            conversationId, 
            (unreadCountMap.get(conversationId) || 0) + 1
          );
        }
        
        if (!conversationMap.has(conversationId)) {
          const otherUserInfo = message.sender_id === otherUserId 
            ? message.sender 
            : message.receiver;
          
          const hasOffer = data.some(
            (msg: any) => {
              const msgOtherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
              return msgOtherUserId === otherUserId && msg.offer_item_id;
            }
          );

          conversationMap.set(conversationId, {
            id: conversationId,
            item_id: message.item_id || '',
            item_title: message.items?.title || '',
            item_image: message.items?.images?.[0] || '',
            other_user_id: otherUserId,
            other_user_name: otherUserInfo?.username || 'User',
            other_user_avatar: otherUserInfo?.avatar_url,
            last_message: message.content,
            last_message_time: message.created_at,
            unread_count: 0,
            has_offer: hasOffer,
            archived: message.archived || false,
            deleted: message.deleted || false,
            silenced: message.silenced || false,
          });
        } else {
          const existing = conversationMap.get(conversationId)!;
          if (new Date(message.created_at) > new Date(existing.last_message_time)) {
            existing.last_message = message.content;
            existing.last_message_time = message.created_at;
            if (message.items) {
              existing.item_title = message.items.title;
              existing.item_image = message.items.images?.[0] || '';
            }
          }
        }
      });

      // Apply unread counts
      unreadCountMap.forEach((count, id) => {
        const conversation = conversationMap.get(id);
        if (conversation) {
          conversation.unread_count = count;
        }
      });

      const allConversations = Array.from(conversationMap.values()).sort(conversationSorter);
      setConversations(allConversations);

    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const getSwipeAnimation = (itemId: string) => {
    if (!swipeAnimations.current.has(itemId)) {
      swipeAnimations.current.set(itemId, new Animated.Value(0));
    }
    return swipeAnimations.current.get(itemId)!;
  };

  const handleSwipeLeft = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSwipedItemId(itemId);
    Animated.timing(getSwipeAnimation(itemId), {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleSwipeRight = (itemId: string) => {
    setSwipedItemId(null);
    Animated.timing(getSwipeAnimation(itemId), {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const deleteConversation = async (conversationId: string, otherUserId: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      Alert.alert(
        'Delete Conversation',
        'Are you sure you want to delete this conversation? You can retrieve it later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('messages')
                .update({ deleted: true })
                .eq('sender_id', user?.id)
                .or(`sender_id.eq.${otherUserId},receiver_id.eq.${otherUserId}`)
                .eq('receiver_id', user?.id);

              if (error) throw error;
              
              setConversations(prev => 
                prev.map(conv => 
                  conv.id === conversationId ? { ...conv, deleted: true } : conv
                )
              );
              
              handleSwipeRight(conversationId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting conversation:', error);
      Alert.alert('Error', 'Failed to delete conversation');
    }
  };

  const retrieveConversation = async (conversationId: string, otherUserId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { error } = await supabase
        .from('messages')
        .update({ deleted: false })
        .eq('sender_id', user?.id)
        .or(`sender_id.eq.${otherUserId},receiver_id.eq.${otherUserId}`)
        .eq('receiver_id', user?.id);

      if (error) throw error;
      
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId ? { ...conv, deleted: false } : conv
        )
      );
      
      handleSwipeRight(conversationId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error retrieving conversation:', error);
      Alert.alert('Error', 'Failed to retrieve conversation');
    }
  };

  const silenceConversation = async (conversationId: string, otherUserId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { error } = await supabase
        .from('messages')
        .update({ silenced: true })
        .eq('sender_id', user?.id)
        .or(`sender_id.eq.${otherUserId},receiver_id.eq.${otherUserId}`)
        .eq('receiver_id', user?.id);

      if (error) throw error;
      
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId ? { ...conv, silenced: true } : conv
        )
      );
      
      handleSwipeRight(conversationId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error silencing conversation:', error);
      Alert.alert('Error', 'Failed to silence conversation');
    }
  };

  const filteredConversations = conversations.filter(conv => {
    if (filter === 'unread') return conv.unread_count > 0 && !conv.archived && !conv.deleted;
    if (filter === 'offers') return conv.has_offer && !conv.archived && !conv.deleted;
    if (filter === 'deleted') return conv.deleted === true;
    return !conv.archived && !conv.deleted;
  });

  const renderConversation = ({ item }: { item: Conversation }) => (
    <View style={styles.conversationWrapper}>
      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {item.deleted ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.retrieveButton]}
            onPress={() => retrieveConversation(item.id, item.other_user_id)}
          >
            <Text style={styles.actionButtonText}>📥</Text>
            <Text style={styles.actionButtonLabel}>Retrieve</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.silenceButton]}
              onPress={() => silenceConversation(item.id, item.other_user_id)}
            >
              <Text style={styles.actionButtonText}>🔇</Text>
              <Text style={styles.actionButtonLabel}>Silence</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => deleteConversation(item.id, item.other_user_id)}
            >
              <Text style={styles.actionButtonText}>🗑️</Text>
              <Text style={styles.actionButtonLabel}>Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Conversation Item */}
      <Animated.View
        style={[
          styles.conversationItem,
          item.unread_count > 0 && styles.unreadConversation,
          item.deleted && styles.deletedConversation,
          { transform: [{ translateX: getSwipeAnimation(item.id) }] }
        ]}
      >
        <TouchableOpacity 
          style={styles.conversationTouchable}
          onPress={() => {
            if (item.deleted) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const otherUserId = item.other_user_id;
            navigation.navigate('Chat', { 
              otherUserId, 
              itemId: item.item_id || null 
            });
          }}
          onLongPress={() => handleSwipeLeft(item.id)}
          activeOpacity={0.8}
        >
      <View style={styles.conversationContent}>
        {/* User Avatar */}
        <View style={styles.avatarContainer}>
          {item.other_user_avatar ? (
            <Image 
              source={{ uri: item.other_user_avatar }} 
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
          )}
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread_count > 9 ? '9+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>

        {/* Conversation Info */}
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={[
              styles.userName,
              item.unread_count > 0 && styles.unreadUserName
            ]}>
              {item.other_user_name}
            </Text>
            <Text style={styles.timestamp}>
              {formatTime(item.last_message_time)}
            </Text>
          </View>

          {/* Item Context */}
          {item.item_title && (
            <View style={styles.itemContext}>
              {item.item_image && (
                <Image 
                  source={{ uri: item.item_image }} 
                  style={styles.itemThumbnail}
                />
              )}
              <Text style={styles.itemTitle} numberOfLines={1}>
                📦 {item.item_title}
              </Text>
            </View>
          )}

          {/* Last Message */}
          <Text style={[
            styles.lastMessage,
            item.unread_count > 0 && styles.unreadLastMessage
          ]} numberOfLines={2}>
            {item.last_message}
          </Text>

          {/* Offer Indicator */}
          {item.has_offer && (
            <View style={styles.offerIndicator}>
              <Text style={styles.offerText}>🔄 Barter offer</Text>
            </View>
          )}
        </View>

        {/* Chevron */}
        <Text style={styles.chevron}>›</Text>
        </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      {[
        { key: 'all', label: 'All', emoji: '💬' },
        { key: 'unread', label: 'Unread', emoji: '🔴' },
        { key: 'offers', label: 'Offers', emoji: '🔄' },
        { key: 'deleted', label: 'Deleted', emoji: '🗑️' },
      ].map((filterOption) => (
        <TouchableOpacity
          key={filterOption.key}
          style={[
            styles.filterTab,
            filter === filterOption.key && styles.activeFilterTab,
          ]}
          onPress={() => {
            setFilter(filterOption.key as any);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.filterEmoji}>{filterOption.emoji}</Text>
          <Text style={[
            styles.filterText,
            filter === filterOption.key && styles.activeFilterText,
          ]}>
            {filterOption.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>
          {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>
                {filter === 'unread' ? '✅' : 
                 filter === 'offers' ? '🔄' : 
                 filter === 'deleted' ? '🗑️' : '💬'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'unread' ? 'All caught up!' : 
                 filter === 'offers' ? 'No barter offers yet' : 
                 filter === 'deleted' ? 'No deleted conversations' :
                 'No conversations yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {filter === 'unread' ? 'Check back later for new messages' :
                 filter === 'offers' ? 'Barter offers will appear here' :
                 filter === 'deleted' ? 'Deleted conversations will appear here' :
                 'Start a conversation by messaging someone about their item'}
              </Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffInHours < 168) { // 7 days
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  conversationWrapper: {
    position: 'relative',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  actionButtons: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  actionButton: {
    width: 60,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginLeft: 4,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  retrieveButton: {
    backgroundColor: '#10B981',
  },
  silenceButton: {
    backgroundColor: '#F59E0B',
  },
  actionButtonText: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionButtonLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeFilterTab: {
    backgroundColor: '#3B82F6',
  },
  filterEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingVertical: 8,
  },
  conversationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 2,
  },
  conversationTouchable: {
    flex: 1,
  },
  deletedConversation: {
    backgroundColor: '#F3F4F6',
    opacity: 0.7,
  },
  unreadConversation: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
    shadowOpacity: 0.1,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
    gap: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  unreadUserName: {
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  itemContext: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  itemThumbnail: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 6,
  },
  itemTitle: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  lastMessage: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 18,
  },
  unreadLastMessage: {
    fontWeight: '600',
    color: '#374151',
  },
  offerIndicator: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  offerText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  chevron: {
    fontSize: 20,
    color: '#CBD5E1',
    fontWeight: '300',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});