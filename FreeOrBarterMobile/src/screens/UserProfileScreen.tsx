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
  ActivityIndicator,
  Share,
  Clipboard,
  Modal,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import {
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriend,
  FriendshipStatus,
} from '../lib/friends';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';
import {
  ReportContentSheet,
  ReportTargetPayload,
} from '../components/ReportContentSheet';
import { useBlockStatus } from '../hooks/useBlockStatus';
import { blockUserWithCleanup, unblockUserPair } from '../lib/blocks';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
  zipcode: string | null;
  gender: string | null;
}

interface RouteParams {
  userId: string;
}

export default function UserProfileScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { userId } = route.params as RouteParams;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTargetPayload | null>(null);
  const {
    blockedByMe,
    blockedByOther,
    isEitherBlocked,
    refresh: refreshBlockStatus,
  } = useBlockStatus(user?.id, userId);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) fetchUserData();
    });
    return unsubscribe;
  }, [navigation, userId]);

  const fetchUserData = async () => {
    try {
      if (!refreshing) setLoading(true);

      // Fetch all data in parallel for better performance
      const [profileResult, itemsResult, friendshipResult] = await Promise.all([
        // Fetch user profile
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single(),
        
        // Fetch user's items
        supabase
          .from('items')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'available')
          .order('created_at', { ascending: false }),
        
        // Fetch friendship status if viewing someone else's profile
        user && user.id !== userId 
          ? getFriendshipStatus(user.id, userId)
          : Promise.resolve('none' as FriendshipStatus),
        
      ]);

      // Handle profile
      if (profileResult.error) throw profileResult.error;
      setProfile(profileResult.data);

      // Handle items
      if (itemsResult.error) throw itemsResult.error;
      setItems(itemsResult.data || []);

      // Handle friendship status
      setFriendshipStatus(friendshipResult);

      // If there's a pending request received, get the request ID
      if (friendshipResult === 'pending_received') {
        const { data: requestData } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', userId)
          .eq('receiver_id', user!.id)
          .eq('status', 'pending')
          .single();
        
        setPendingRequestId(requestData?.id || null);
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const profileUrl = `freeorbarter://user/${userId}`;
    const message = `Check out ${profile.username}'s profile on FreeorBarter!`;
    
    Alert.alert(
      'Share Profile',
      'Choose an option',
      [
        {
          text: 'Copy Link',
          onPress: () => {
            Clipboard.setString(profileUrl);
            Alert.alert('Success', 'Profile link copied to clipboard!');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
        {
          text: 'Share',
          onPress: async () => {
            try {
              await Share.share({
                message: `${message}\n${profileUrl}`,
                title: `${profile.username} on FreeorBarter`
              });
            } catch (error) {
              console.error('Error sharing profile:', error);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleMessageUser = async () => {
    if (!user || !userId) return;
    if (isEitherBlocked) {
      Alert.alert('Messaging unavailable', 'Messaging is disabled because someone in this conversation is blocked.');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Check if there's an existing conversation
    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .limit(1);
      
      // Navigate to chat screen (will open existing thread or create new one)
      navigation.navigate('Chat', { otherUserId: userId, itemId: null });
    } catch (error) {
      console.error('Error checking messages:', error);
      // Navigate anyway
      navigation.navigate('Chat', { otherUserId: userId, itemId: null });
    }
  };

  const handleBlockUser = async () => {
    if (!user || !userId) return;

    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile?.username}? You will unfriend them and any open offers will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              setFriendActionLoading(true);
              await blockUserWithCleanup({ blockerId: user.id, blockedId: userId });
              setFriendshipStatus('none');
              await refreshBlockStatus();
              Alert.alert('User blocked', 'You will no longer see their content.');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShowManageMenu(false);
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user');
            } finally {
              setFriendActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleUnblockUser = async () => {
    if (!user || !userId) return;

    Alert.alert('Unblock User', `Are you sure you want to unblock ${profile?.username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          try {
            setFriendActionLoading(true);
            await unblockUserPair({ blockerId: user.id, blockedId: userId });
            await refreshBlockStatus();
            Alert.alert('User unblocked', 'You can interact with them again.');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowManageMenu(false);
          } catch (error) {
            console.error('Error unblocking user:', error);
            Alert.alert('Error', 'Failed to unblock user');
          } finally {
            setFriendActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleFriendAction = async (action: 'send' | 'accept' | 'decline' | 'cancel' | 'unfriend') => {
    if (!user || !userId || user.id === userId) return;

    setFriendActionLoading(true);

    try {
      let result;

      switch (action) {
        case 'send':
          result = await sendFriendRequest(user.id, userId);
          if (result.error) throw result.error;
          Alert.alert('Success', 'Friend request sent!');
          break;

        case 'accept':
          if (!pendingRequestId) throw new Error('No pending request found');
          result = await acceptFriendRequest(pendingRequestId);
          if (result.error) throw result.error;
          Alert.alert('Success', 'You are now friends!');
          break;

        case 'decline':
          if (!pendingRequestId) throw new Error('No pending request found');
          result = await declineFriendRequest(pendingRequestId);
          if (result.error) throw result.error;
          break;

        case 'cancel':
          // For cancel, we need to find the request ID
          const { data: sentRequest } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', user.id)
            .eq('receiver_id', userId)
            .eq('status', 'pending')
            .single();

          if (!sentRequest) throw new Error('No pending request found');
          
          result = await unfriend(user.id, userId);
          if (result.error) throw result.error;
          break;

        case 'unfriend':
          result = await unfriend(user.id, userId);
          if (result.error) throw result.error;
          Alert.alert('Success', 'You are no longer friends');
          break;

        default:
          throw new Error('Invalid action');
      }

      // Refresh friendship status
      const newStatus = await getFriendshipStatus(user.id, userId);
      setFriendshipStatus(newStatus);
      setPendingRequestId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (err) {
      console.error('Error performing friend action:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to perform action');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const openReportUserSheet = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to report users.');
      return;
    }
    if (!profile) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReportTarget({
      type: 'user',
      id: profile.id,
      displayName: profile.username,
      metadata: {
        fromScreen: 'UserProfile',
        friendshipStatus,
        blocked: blockedByMe,
      },
    });
  };

  const renderFriendButton = () => {
    if (!user || user.id === userId) return null;
    if (blockedByOther) {
      return (
        <View style={[styles.friendButton, styles.blockedBanner]}>
          <Text style={styles.blockedBannerText}>
            {profile?.username} has blocked you
          </Text>
        </View>
      );
    }

    if (blockedByMe) {
      return (
        <TouchableOpacity
          style={[styles.friendButton, styles.pendingButton]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            handleUnblockUser();
          }}
          disabled={friendActionLoading}
        >
          {friendActionLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.friendButtonText}>Unblock User</Text>
          )}
        </TouchableOpacity>
      );
    }

    // Show loading state while fetching friendship status
    if (loading) {
      return (
        <View style={[styles.friendButton, styles.loadingButton]}>
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      );
    }

    const buttonConfig = {
      none: { text: 'Add Friend', action: 'send', style: styles.addFriendButton },
      pending_sent: { text: 'Request Sent', action: 'cancel', style: styles.pendingButton },
      pending_received: { text: 'Accept Request', action: 'accept', style: styles.acceptButton },
      friends: { text: 'Friends ✓', action: 'friends', style: styles.friendsButton },
    };

    const config = buttonConfig[friendshipStatus];
    
    // If already friends, show message and manage friendship buttons
    if (friendshipStatus === 'friends') {
      return (
        <View style={styles.friendActionsContainer}>
          <TouchableOpacity
            style={[styles.friendActionButton, styles.messageButton]}
            onPress={handleMessageUser}
          >
            <Text style={styles.friendActionButtonText}>💬 Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.friendActionButton, styles.manageButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowManageMenu(true);
            }}
            disabled={friendActionLoading}
          >
            <Text style={styles.manageButtonText}>⚙️ Manage</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <TouchableOpacity
        style={[styles.friendButton, config.style]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          handleFriendAction(config.action as any);
        }}
        disabled={friendActionLoading}
      >
        {friendActionLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.friendButtonText}>{config.text}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item, index }: { item: Item; index: number }) => (
    <View style={[styles.itemWrapper, index % 2 === 1 && styles.itemWrapperRight]}>
      <ItemCard 
        item={item} 
        onPress={() => navigation.navigate('ItemDetails', { itemId: item.id })} 
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Text style={styles.headerBackButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{profile.username}</Text>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareProfile}
        >
          <Text style={styles.shareButtonText}>🔗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {profile.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.profileAvatar}
              />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Text style={styles.profileAvatarText}>👤</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile.username}</Text>
              <View style={styles.profileMeta}>
                <Text style={styles.profileRating}>
                  ⭐ {profile.rating?.toFixed(1) || 'No ratings'}
                </Text>
                {profile.zipcode && (
                  <Text style={styles.profileLocation}>
                    📍 {profile.zipcode}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Friend Button */}
          <View key={`friend-button-${friendshipStatus}-${blockedByMe}`}>
            {renderFriendButton()}
          </View>
          {user && user.id !== userId && (
            <TouchableOpacity
              style={styles.reportUserChip}
              onPress={openReportUserSheet}
            >
              <Text style={styles.reportUserChipText}>⚑ Report {profile.username}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Listings Section */}
        <View style={styles.listingsSection}>
          <Text style={styles.sectionTitle}>
            {items.length > 0 ? `${profile.username}'s Listings` : 'No Listings'}
          </Text>
          
          {items.length > 0 ? (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.itemsGrid}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyListings}>
              <Text style={styles.emptyListingsEmoji}>📦</Text>
              <Text style={styles.emptyListingsText}>
                No listings yet
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Manage Friendship Menu */}
      <Modal
        visible={showManageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManageMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowManageMenu(false)}
        >
          <View style={styles.manageMenuContainer}>
            <Text style={styles.manageMenuTitle}>Manage Friendship</Text>
            
            {!blockedByMe && friendshipStatus === 'friends' && (
              <TouchableOpacity
                style={styles.manageMenuItem}
                onPress={() => {
                  setShowManageMenu(false);
                  Alert.alert(
                    'Unfriend',
                    `Are you sure you want to unfriend ${profile?.username}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Unfriend', 
                        style: 'destructive', 
                        onPress: () => handleFriendAction('unfriend') 
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.manageMenuItemIcon}>👋</Text>
                <Text style={styles.manageMenuItemText}>Unfriend</Text>
              </TouchableOpacity>
            )}
            
            {blockedByMe ? (
              <TouchableOpacity
                style={[styles.manageMenuItem, styles.successMenuItem]}
                onPress={() => {
                  setShowManageMenu(false);
                  handleUnblockUser();
                }}
              >
                <Text style={styles.manageMenuItemIcon}>✅</Text>
                <Text style={[styles.manageMenuItemText, styles.successText]}>Unblock User</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.manageMenuItem, styles.dangerMenuItem]}
                onPress={() => {
                  setShowManageMenu(false);
                  handleBlockUser();
                }}
              >
                <Text style={styles.manageMenuItemIcon}>🚫</Text>
                <Text style={[styles.manageMenuItemText, styles.dangerText]}>Block User</Text>
              </TouchableOpacity>
            )}
            {user && user.id !== userId && (
              <TouchableOpacity
                style={styles.manageMenuItem}
                onPress={() => {
                  setShowManageMenu(false);
                  openReportUserSheet();
                }}
              >
                <Text style={styles.manageMenuItemIcon}>⚑</Text>
                <Text style={styles.manageMenuItemText}>Report User</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.manageMenuCancelButton}
              onPress={() => setShowManageMenu(false)}
            >
              <Text style={styles.manageMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      <ReportContentSheet
        visible={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  headerBackButton: {
    padding: 8,
  },
  headerBackButtonText: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  shareButton: {
    padding: 8,
  },
  shareButtonText: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 32,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  profileMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  profileRating: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
  profileLocation: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  friendButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingButton: {
    backgroundColor: '#F1F5F9',
  },
  addFriendButton: {
    backgroundColor: '#3B82F6',
  },
  acceptButton: {
    backgroundColor: '#10B981',
  },
  pendingButton: {
    backgroundColor: '#6B7280',
  },
  friendsButton: {
    backgroundColor: '#10B981',
  },
  friendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  blockedBanner: {
    backgroundColor: '#FFE4E6',
  },
  blockedBannerText: {
    color: '#BE123C',
    fontWeight: '600',
  },
  friendActionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  friendActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageButton: {
    backgroundColor: '#3B82F6',
  },
  friendActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  manageButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  manageButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
  listingsSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  itemsGrid: {
    paddingBottom: 16,
  },
  itemWrapper: {
    flex: 1,
    paddingRight: 8,
  },
  itemWrapperRight: {
    paddingRight: 0,
    paddingLeft: 8,
  },
  emptyListings: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 4,
  },
  emptyListingsEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyListingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  manageMenuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  manageMenuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  manageMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 12,
  },
  dangerMenuItem: {
    backgroundColor: '#FEE2E2',
  },
  successMenuItem: {
    backgroundColor: '#D1FAE5',
  },
  manageMenuItemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  manageMenuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  reportUserChip: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  reportUserChipText: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  dangerText: {
    color: '#EF4444',
  },
  successText: {
    color: '#10B981',
  },
  manageMenuCancelButton: {
    padding: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  manageMenuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
});
