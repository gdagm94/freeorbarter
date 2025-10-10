import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import {
  getFriendsList,
  getPendingRequests,
  getSentRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  unfriend,
} from '../lib/friends';
import { FriendshipWithUser, FriendRequestWithUser } from '../types';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
}

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  created_at: string;
  blocked_user: {
    id: string;
    username: string;
    avatar_url: string | null;
    rating: number | null;
  };
}

export default function FriendsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'blocked'>('friends');
  const [friends, setFriends] = useState<FriendshipWithUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestWithUser[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestWithUser[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchFriendsData();
    }
  }, [user]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) fetchFriendsData();
    });
    return unsubscribe;
  }, [navigation, user]);

  const fetchFriendsData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch friends list
      const { data: friendsData, error: friendsError } = await getFriendsList(user.id);
      if (friendsError) throw friendsError;
      setFriends(friendsData);

      // Fetch pending requests
      const { data: pendingData, error: pendingError } = await getPendingRequests(user.id);
      if (pendingError) throw pendingError;
      setPendingRequests(pendingData);

      // Fetch sent requests
      const { data: sentData, error: sentError } = await getSentRequests(user.id);
      if (sentError) throw sentError;
      setSentRequests(sentData);

      // Fetch blocked users
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (blockedError) {
        console.log('Error fetching blocked users:', blockedError);
        setBlockedUsers([]);
      } else if (blockedData && blockedData.length > 0) {
        // Fetch user data for each blocked user
        const userIds = blockedData.map((b: any) => b.blocked_id);
        const { data: usersData } = await supabase
          .from('users')
          .select('id, username, avatar_url, rating')
          .in('id', userIds);

        // Merge user data with blocked users
        const mergedData = blockedData.map((blocked: any) => ({
          ...blocked,
          blocked_user_id: blocked.blocked_id,
          blocked_user: usersData?.find(u => u.id === blocked.blocked_id) || null
        }));
        setBlockedUsers(mergedData);
      } else {
        setBlockedUsers([]);
      }

    } catch (error) {
      console.error('Error fetching friends data:', error);
      Alert.alert('Error', 'Failed to load friends data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFriendsData();
    setRefreshing(false);
  };

  const handleFriendAction = async (action: 'accept' | 'decline' | 'cancel' | 'unfriend', requestId: string, friendId?: string) => {
    setActionLoading(requestId);
    
    try {
      let result;
      
      switch (action) {
        case 'accept':
          result = await acceptFriendRequest(requestId);
          break;
        case 'decline':
          result = await declineFriendRequest(requestId);
          break;
        case 'cancel':
          result = await cancelFriendRequest(requestId);
          break;
        case 'unfriend':
          if (!friendId || !user) return;
          result = await unfriend(user.id, friendId);
          break;
      }

      if (result?.error) {
        throw result.error;
      }

      // Refresh friends data
      await fetchFriendsData();
      
    } catch (error) {
      console.error('Error performing friend action:', error);
      Alert.alert('Error', 'Failed to perform action');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (blockId: string, username: string) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setActionLoading(blockId);
            try {
              const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('id', blockId);

              if (error) throw error;

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', `${username} has been unblocked`);
              await fetchFriendsData();
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  const renderFriendItem = ({ item }: { item: FriendshipWithUser }) => (
    <View style={styles.friendItem}>
      <TouchableOpacity 
        style={styles.friendInfo}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('UserProfile', { userId: item.friend?.id });
        }}
        activeOpacity={0.7}
      >
        {item.friend?.avatar_url ? (
          <Image 
            source={{ uri: item.friend.avatar_url }} 
            style={styles.friendAvatar}
          />
        ) : (
          <View style={styles.friendAvatarPlaceholder}>
            <Text style={styles.friendAvatarText}>👤</Text>
          </View>
        )}
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.friend?.username}</Text>
          {item.friend?.rating && (
            <Text style={styles.friendRating}>
              ⭐ {item.friend.rating.toFixed(1)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.unfriendButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Alert.alert(
            'Unfriend',
            `Are you sure you want to unfriend ${item.friend?.username}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unfriend',
                style: 'destructive',
                onPress: () => handleFriendAction('unfriend', '', item.friend?.id)
              }
            ]
          );
        }}
        disabled={actionLoading === item.id}
      >
        <Text style={styles.unfriendButtonText}>Unfriend</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRequestItem = ({ item }: { item: FriendRequestWithUser }) => (
    <View style={styles.requestItem}>
      <TouchableOpacity 
        style={styles.requestInfo}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('UserProfile', { userId: item.sender?.id });
        }}
        activeOpacity={0.7}
      >
        {item.sender?.avatar_url ? (
          <Image 
            source={{ uri: item.sender.avatar_url }} 
            style={styles.requestAvatar}
          />
        ) : (
          <View style={styles.requestAvatarPlaceholder}>
            <Text style={styles.requestAvatarText}>👤</Text>
          </View>
        )}
        <View style={styles.requestDetails}>
          <Text style={styles.requestName}>{item.sender?.username}</Text>
          <Text style={styles.requestSubtext}>
            {activeTab === 'requests' ? 'Wants to be friends' : 'Request sent'}
          </Text>
        </View>
      </TouchableOpacity>
      
      {activeTab === 'requests' ? (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.requestButton, styles.acceptButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleFriendAction('accept', item.id);
            }}
            disabled={actionLoading === item.id}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.requestButton, styles.declineButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleFriendAction('decline', item.id);
            }}
            disabled={actionLoading === item.id}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.requestButton, styles.cancelButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleFriendAction('cancel', item.id);
          }}
          disabled={actionLoading === item.id}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={styles.friendItem}>
      <TouchableOpacity 
        style={styles.friendInfo}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('UserProfile', { userId: item.blocked_user_id });
        }}
        activeOpacity={0.7}
      >
        {item.blocked_user?.avatar_url ? (
          <Image 
            source={{ uri: item.blocked_user.avatar_url }} 
            style={styles.friendAvatar}
          />
        ) : (
          <View style={styles.friendAvatarPlaceholder}>
            <Text style={styles.friendAvatarText}>👤</Text>
          </View>
        )}
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.blocked_user?.username || 'Unknown User'}</Text>
          {item.blocked_user?.rating && (
            <Text style={styles.friendRating}>⭐ {item.blocked_user.rating.toFixed(1)}</Text>
          )}
          <Text style={styles.friendSubtext}>
            Blocked {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.friendButton, styles.unblockButton]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          handleUnblock(item.id, item.blocked_user?.username || 'this user');
        }}
        disabled={actionLoading === item.id}
      >
        <Text style={styles.unblockButtonText}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  const getCurrentData = () => {
    switch (activeTab) {
      case 'friends':
        return friends;
      case 'requests':
        return pendingRequests;
      case 'blocked':
        return blockedUsers;
      default:
        return sentRequests;
    }
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'friends':
        return {
          emoji: '👥',
          title: 'No friends yet',
          subtitle: 'Connect with other users to build your network'
        };
      case 'requests':
        return {
          emoji: '📥',
          title: 'No pending requests',
          subtitle: 'Friend requests will appear here'
        };
      case 'blocked':
        return {
          emoji: '✅',
          title: 'No blocked users',
          subtitle: 'Users you block will appear here'
        };
      default:
        return {
          emoji: '📤',
          title: 'No sent requests',
          subtitle: 'Your friend requests will appear here'
        };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const emptyMessage = getEmptyMessage();
  const currentData = getCurrentData();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('SearchUsers');
          }}
        >
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => {
            setActiveTab('friends');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={[styles.tabEmoji, activeTab === 'friends' && styles.activeTabEmoji]}>👥</Text>
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            {friends.length}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => {
            setActiveTab('requests');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={[styles.tabEmoji, activeTab === 'requests' && styles.activeTabEmoji]}>📥</Text>
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            {pendingRequests.length}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'blocked' && styles.activeTab]}
          onPress={() => {
            setActiveTab('blocked');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={[styles.tabEmoji, activeTab === 'blocked' && styles.activeTabEmoji]}>🚫</Text>
          <Text style={[styles.tabText, activeTab === 'blocked' && styles.activeTabText]}>
            {blockedUsers.length}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {activeTab === 'friends' && (
          friends.length > 0 ? (
            <FlatList
              data={friends}
              renderItem={renderFriendItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>{emptyMessage.emoji}</Text>
              <Text style={styles.emptyTitle}>{emptyMessage.title}</Text>
              <Text style={styles.emptySubtitle}>{emptyMessage.subtitle}</Text>
            </View>
          )
        )}
        
        {activeTab === 'requests' && (
          pendingRequests.length > 0 ? (
            <FlatList
              data={pendingRequests}
              renderItem={renderRequestItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>{emptyMessage.emoji}</Text>
              <Text style={styles.emptyTitle}>{emptyMessage.title}</Text>
              <Text style={styles.emptySubtitle}>{emptyMessage.subtitle}</Text>
            </View>
          )
        )}
        
        {activeTab === 'blocked' && (
          blockedUsers.length > 0 ? (
            <FlatList
              data={blockedUsers}
              renderItem={renderBlockedUser}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>{emptyMessage.emoji}</Text>
              <Text style={styles.emptyTitle}>{emptyMessage.title}</Text>
              <Text style={styles.emptySubtitle}>{emptyMessage.subtitle}</Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  searchButton: {
    padding: 8,
  },
  searchButtonText: {
    fontSize: 20,
    color: '#3B82F6',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabEmoji: {
    fontSize: 20,
  },
  activeTabEmoji: {
    transform: [{ scale: 1.1 }],
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    fontSize: 20,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  friendRating: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
  },
  friendSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  friendButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unfriendButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unfriendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  unblockButton: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockButtonText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  requestAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestAvatarText: {
    fontSize: 20,
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  requestSubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: '#EF4444',
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#6B7280',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
});
