import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface NotificationRow {
  id: string;
  user_id: string;
  sender_id: string | null;
  type: 'friend_request' | 'friend_request_approved' | 'new_listing' | 'direct_message' | 'watchlist_update';
  content: string;
  related_id: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications((data as NotificationRow[]) || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchNotifications)
      .subscribe();
    return () => channel.unsubscribe();
  }, [fetchNotifications, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const renderItem = ({ item }: { item: NotificationRow }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => {
        markAsRead(item.id);
        if (item.type === 'direct_message' && item.related_id) {
          // related_id could be the sender or message id; open Messages tab
          navigation.navigate('Chat', { otherUserId: item.sender_id });
        } else if ((item.type === 'new_listing' || item.type === 'watchlist_update') && item.related_id) {
          navigation.navigate('ItemDetails', { itemId: item.related_id });
        }
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardType}>{item.type.replace('_', ' ')}</Text>
        <Text style={styles.cardTime}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
      <Text style={styles.cardContent}>{item.content}</Text>
      {!item.read && <Text style={styles.unreadBadge}>NEW</Text>}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No notifications'}</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  backButton: {
    fontSize: 16,
    color: '#3B82F6',
    marginRight: 16,
  },
  listContainer: {
    padding: 16,
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
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unreadCard: {
    borderColor: '#3B82F6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardType: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  cardTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cardContent: {
    fontSize: 16,
    color: '#1F2937',
  },
  unreadBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F6',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    overflow: 'hidden',
  },
});
