import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Haptics from 'expo-haptics';
import { acceptFriendRequest, declineFriendRequest } from '../lib/friends';

interface NotificationRow {
  id: string;
  user_id: string;
  sender_id: string | null;
  type:
    | 'friend_request'
    | 'friend_request_approved'
    | 'friend_request_declined'
    | 'new_listing'
    | 'direct_message'
    | 'watchlist_update';
  content: string;
  related_id: string | null;
  read: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendRequestActions, setFriendRequestActions] = useState<Record<string, 'idle' | 'accept' | 'decline'>>({});

  const fetchNotifications = useCallback(
    async (options?: { skipSkeleton?: boolean }) => {
      if (!user?.id) return;
    try {
        if (!options?.skipSkeleton) {
          setLoading(true);
        }
      const { data, error } = await supabase
        .from('notifications')
        .select(
          `
          *,
          sender:sender_id (
            id,
            username,
            avatar_url
          )
        `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications((data as NotificationRow[]) || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
        if (!options?.skipSkeleton) {
          setLoading(false);
        }
        setRefreshing(false);
    }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-changes-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchNotifications({ skipSkeleton: true });
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, fetchNotifications]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user?.id) fetchNotifications({ skipSkeleton: true });
    });
    return unsubscribe;
  }, [navigation, user?.id, fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications({ skipSkeleton: true });
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return '👥';
      case 'friend_request_approved':
        return '✅';
      case 'friend_request_declined':
        return '🚫';
      case 'new_listing':
        return '📦';
      case 'direct_message':
        return '💬';
      case 'watchlist_update':
        return '⭐';
      default:
        return '🔔';
    }
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'friend_request':
        return 'Friend Request';
      case 'friend_request_approved':
        return 'Friend Added';
      case 'friend_request_declined':
        return 'Request Declined';
      case 'new_listing':
        return 'New Listing';
      case 'direct_message':
        return 'Message';
      case 'watchlist_update':
        return 'Watchlist';
      default:
        return 'Notification';
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const target = new Date(timestamp).getTime();
    const diff = Math.max(0, now - target);

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleOpenProfile = (item: NotificationRow) => {
    if (!item.sender_id) return;
    navigation.navigate('UserProfile', { userId: item.sender_id });
  };

  const handleNotificationPress = (item: NotificationRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAsRead(item.id);

    switch (item.type) {
      case 'friend_request':
      case 'friend_request_approved':
        handleOpenProfile(item);
        break;
      case 'direct_message':
        if (item.sender_id) {
          navigation.navigate('Chat', { otherUserId: item.sender_id });
        }
        break;
      case 'new_listing':
      case 'watchlist_update':
        if (item.related_id) {
          navigation.navigate('ItemDetails', { itemId: item.related_id });
        }
        break;
      default:
        break;
    }
  };

  const handleFriendRequestAction = async (notification: NotificationRow, action: 'accept' | 'decline') => {
    if (!notification.related_id) {
      Alert.alert('Request unavailable', 'This friend request is no longer available.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFriendRequestActions(prev => ({ ...prev, [notification.id]: action }));

    try {
      if (action === 'accept') {
        const { error } = await acceptFriendRequest(notification.related_id);
        if (error) throw error;
      } else {
        const { error } = await declineFriendRequest(notification.related_id);
        if (error) throw error;
      }

      await markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => {
          if (n.id !== notification.id) return n;

          if (action === 'accept') {
            return {
              ...n,
              read: true,
              type: 'friend_request_approved',
              content: `You and ${n.sender?.username ?? 'this user'} are now friends!`,
            };
          }

          return {
            ...n,
            read: true,
            type: 'friend_request_declined',
            content: `You declined ${n.sender?.username ?? 'this user'}'s friend request.`,
          };
        }),
      );
    } catch (err) {
      console.error('Error handling friend request action:', err);
      const message =
        err instanceof Error && err.message.includes('not found')
          ? 'This request was already handled.'
          : action === 'accept'
            ? 'Failed to accept request'
            : 'Failed to decline request';
      Alert.alert('Notice', message);
      if (message === 'This request was already handled.') {
        await fetchNotifications({ skipSkeleton: true });
      }
    } finally {
      setFriendRequestActions(prev => ({ ...prev, [notification.id]: 'idle' }));
    }
  };

  const renderItem = ({ item }: { item: NotificationRow }) => (
    <NotificationCard
      notification={item}
      icon={getNotificationIcon(item.type)}
      typeLabel={getNotificationTypeText(item.type)}
      relativeTime={getRelativeTime(item.created_at)}
      unread={!item.read}
      onPress={() => handleNotificationPress(item)}
      showFriendActions={item.type === 'friend_request'}
      onAccept={item.type === 'friend_request' ? () => handleFriendRequestAction(item, 'accept') : undefined}
      onDecline={item.type === 'friend_request' ? () => handleFriendRequestAction(item, 'decline') : undefined}
      onViewProfile={
        item.type === 'friend_request' && item.sender_id
          ? () => {
              markAsRead(item.id);
              handleOpenProfile(item);
            }
          : undefined
      }
      actionState={friendRequestActions[item.id] ?? 'idle'}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButtonContainer}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              {loading ? 'Loading...' : 'You\'ll see updates about messages, friend requests, and new listings here.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

interface NotificationCardProps {
  notification: NotificationRow;
  icon: string;
  typeLabel: string;
  relativeTime: string;
  unread: boolean;
  onPress: () => void;
  showFriendActions: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onViewProfile?: () => void;
  actionState?: 'idle' | 'accept' | 'decline';
}

function NotificationCard({
  notification,
  icon,
  typeLabel,
  relativeTime,
  unread,
  onPress,
  showFriendActions,
  onAccept,
  onDecline,
  onViewProfile,
  actionState = 'idle',
}: NotificationCardProps) {
  const accepting = actionState === 'accept';
  const declining = actionState === 'decline';

  return (
    <TouchableOpacity
      style={[styles.notificationCard, unread && styles.unreadCard]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={styles.cardContent}>
        <View style={[styles.notificationIcon, unread && styles.notificationIconUnread]}>
          {notification.sender?.avatar_url ? (
            <Image source={{ uri: notification.sender.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.iconEmoji}>{icon}</Text>
          )}
        </View>
        <View style={styles.notificationDetails}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationType}>{typeLabel}</Text>
            <Text style={styles.notificationTime}>{relativeTime}</Text>
          </View>
          {notification.sender?.username ? (
            <Text style={styles.senderName}>{notification.sender.username}</Text>
          ) : null}
          <Text style={[styles.notificationMessage, unread && styles.unreadMessage]} numberOfLines={3}>
            {notification.content}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, unread && styles.statusPillUnread]}>
              <Text style={styles.statusPillText}>{unread ? 'New' : 'Read'}</Text>
            </View>
          </View>

          {showFriendActions && (
            <View style={styles.friendActionsRow}>
              <TouchableOpacity
                style={[styles.friendActionButton, styles.acceptButton]}
                onPress={onAccept}
                disabled={accepting || declining}
                activeOpacity={0.8}
              >
                {accepting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.friendActionText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.friendActionButton, styles.declineButton]}
                onPress={onDecline}
                disabled={accepting || declining}
                activeOpacity={0.8}
              >
                {declining ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.friendActionText}>Decline</Text>
                )}
              </TouchableOpacity>
              {onViewProfile && (
                <TouchableOpacity
                  style={[styles.friendActionButton, styles.viewProfileButton]}
                  onPress={onViewProfile}
                  disabled={accepting || declining}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewProfileText}>View Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 20,
    color: '#475569',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  unreadCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#F8FAFF',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 52,
    height: 52,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationIconUnread: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  iconEmoji: {
    fontSize: 22,
  },
  notificationDetails: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'capitalize',
  },
  notificationTime: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  senderName: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 8,
  },
  unreadMessage: {
    color: '#1E293B',
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  statusPillUnread: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    position: 'absolute',
    top: 12,
    right: 12,
  },
  friendActionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  friendActionButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexGrow: 1,
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 10,
  },
  friendActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#22C55E',
  },
  declineButton: {
    backgroundColor: '#EF4444',
  },
  viewProfileButton: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#FFFFFF',
  },
  viewProfileText: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
});
