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
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  const fetchUserData = async () => {
    try {
      setLoading(true);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch user's items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch friendship status if viewing someone else's profile
      if (user && user.id !== userId) {
        const status = await getFriendshipStatus(user.id, userId);
        setFriendshipStatus(status);

        // If there's a pending request, get the request ID
        if (status === 'pending_received') {
          const { data: requestData } = await supabase
            .from('friend_requests')
            .select('id')
            .eq('sender_id', userId)
            .eq('receiver_id', user.id)
            .eq('status', 'pending')
            .single();
          
          setPendingRequestId(requestData?.id || null);
        }
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
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
          break;

        case 'accept':
          if (!pendingRequestId) throw new Error('No pending request found');
          result = await acceptFriendRequest(pendingRequestId);
          if (result.error) throw result.error;
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
          break;

        default:
          throw new Error('Invalid action');
      }

      // Refresh friendship status
      const newStatus = await getFriendshipStatus(user.id, userId);
      setFriendshipStatus(newStatus);
      setPendingRequestId(null);

    } catch (err) {
      console.error('Error performing friend action:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to perform action');
    } finally {
      setFriendActionLoading(false);
    }
  };

  const renderFriendButton = () => {
    if (!user || user.id === userId) return null;

    const buttonConfig = {
      none: { text: 'Add Friend', action: 'send', style: styles.addFriendButton },
      pending_sent: { text: 'Request Sent', action: 'cancel', style: styles.pendingButton },
      pending_received: { text: 'Accept Request', action: 'accept', style: styles.acceptButton },
      friends: { text: 'Friends', action: 'unfriend', style: styles.friendsButton },
    };

    const config = buttonConfig[friendshipStatus];
    
    return (
      <TouchableOpacity
        style={[styles.friendButton, config.style]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          
          if (config.action === 'unfriend') {
            Alert.alert(
              'Unfriend',
              `Are you sure you want to unfriend ${profile?.username}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unfriend', style: 'destructive', onPress: () => handleFriendAction('unfriend') }
              ]
            );
          } else {
            handleFriendAction(config.action as any);
          }
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
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
          {renderFriendButton()}
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
  placeholder: {
    width: 40,
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
});
