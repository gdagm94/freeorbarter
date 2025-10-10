import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Share,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface ItemWithUser extends Item {
  users?: {
    id: string;
    username: string;
    avatar_url: string | null;
    rating: number | null;
  };
}

export default function ItemDetailsScreen() {
  const [item, setItem] = useState<ItemWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWatched, setIsWatched] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { itemId } = route.params || {};

  useEffect(() => {
    if (itemId) {
      fetchItem();
      checkWatchStatus();
    }
  }, [itemId, user]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (itemId) {
        fetchItem();
        checkWatchStatus();
      }
    });
    return unsubscribe;
  }, [navigation, itemId]);

  const fetchItem = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select(`
          *,
          users (
            id,
            username,
            avatar_url,
            rating
          )
        `)
        .eq('id', itemId)
        .single();

      if (error) {
        console.error('Error fetching item:', error);
        Alert.alert('Error', 'Failed to load item details');
        return;
      }

      setItem(data);
    } catch (error) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', 'Failed to load item details');
    } finally {
      setLoading(false);
    }
  };

  const checkWatchStatus = async () => {
    if (!user || !itemId) return;

    try {
      const { data, error } = await supabase
        .from('watched_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_id', itemId)
        .maybeSingle();

      if (!error) {
        setIsWatched(!!data);
      }
    } catch (error) {
      console.error('Error checking watch status:', error);
    }
  };

  const handleMessage = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to message the seller');
      return;
    }

    if (!item) {
      Alert.alert('Error', 'Item not found');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Chat', { 
      itemId: item.id,
      otherUserId: item.user_id,
    });
  };

  const handleBarterOffer = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to make a barter offer');
      return;
    }

    if (!item) {
      Alert.alert('Error', 'Item not found');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('BarterOffer', { itemId: item.id });
  };

  const handleWatchToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to watch items');
      return;
    }

    try {
      if (isWatched) {
        // Remove from watchlist
        const { error } = await supabase
          .from('watched_items')
          .delete()
          .eq('user_id', user.id)
          .eq('item_id', itemId);

        if (error) throw error;
        setIsWatched(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('Removed', 'Item removed from your watchlist');
      } else {
        // Add to watchlist
        const { error } = await supabase
          .from('watched_items')
          .insert([{
            user_id: user.id,
            item_id: itemId,
          }]);

        if (error) {
          if (error.code === '23505') {
            Alert.alert('Already Watching', 'Item is already in your watchlist');
          } else {
            throw error;
          }
          return;
        }

        setIsWatched(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Added!', 'Item added to your watchlist');
      }
    } catch (error) {
      console.error('Error toggling watch status:', error);
      Alert.alert('Error', 'Failed to update watchlist');
    }
  };

  const handleShare = async () => {
    if (!item) return;

    try {
      await Share.share({
        message: `Check out this ${item.type} item on FreeorBarter: ${item.title}`,
        url: `https://freeorbarter.com/items/${item.id}`,
        title: item.title,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const nextImage = () => {
    if (!item || item.images.length <= 1) return;
    setCurrentImageIndex((prev) => (prev + 1) % item.images.length);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const prevImage = () => {
    if (!item || item.images.length <= 1) return;
    setCurrentImageIndex((prev) => (prev - 1 + item.images.length) % item.images.length);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading item details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorText}>Item not found</Text>
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

  const isOwnItem = user?.id === item.user_id;
  const isAvailable = item.status === 'available';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <TouchableOpacity 
            style={styles.imageWrapper}
            onPress={nextImage}
            activeOpacity={0.9}
          >
            {item.images && item.images.length > 0 ? (
              <Image 
                source={{ uri: item.images[currentImageIndex] }} 
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderEmoji}>📷</Text>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Image Navigation */}
          {item.images.length > 1 && (
            <>
              <TouchableOpacity style={styles.prevButton} onPress={prevImage}>
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextButton} onPress={nextImage}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
              <View style={styles.imageIndicator}>
                <Text style={styles.imageIndicatorText}>
                  {currentImageIndex + 1} / {item.images.length}
                </Text>
              </View>
            </>
          )}

          {/* Header Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.headerButtonText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={handleShare}
            >
              <Text style={styles.headerButtonText}>⤴</Text>
            </TouchableOpacity>
          </View>

          {/* Type and Status Badges */}
          <View style={styles.badgeContainer}>
            <View style={[styles.typeBadge, { 
              backgroundColor: item.type === 'free' ? '#10B981' : '#8B5CF6' 
            }]}>
              <Text style={styles.badgeText}>
                {item.type === 'free' ? '🎁 FREE' : '🔄 BARTER'}
              </Text>
            </View>
            {!isAvailable && (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {item.status === 'claimed' ? '✅ CLAIMED' : 
                   item.status === 'traded' ? '🤝 TRADED' : '⏳ PENDING'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>{item.title}</Text>
          
          {/* User Info */}
          {item.users && !isOwnItem && (
            <TouchableOpacity 
              style={styles.userInfo}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('UserProfile', { userId: item.users?.id });
              }}
              activeOpacity={0.7}
            >
              {item.users.avatar_url ? (
                <Image 
                  source={{ uri: item.users.avatar_url }} 
                  style={styles.userAvatar}
                />
              ) : (
                <View style={styles.userAvatarPlaceholder}>
                  <Text style={styles.userAvatarText}>👤</Text>
                </View>
              )}
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{item.users.username}</Text>
                <Text style={styles.userRating}>
                  ⭐ {item.users.rating?.toFixed(1) || 'No ratings'}
                </Text>
              </View>
              <Text style={styles.userChevron}>›</Text>
            </TouchableOpacity>
          )}

          {/* Item Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.description}>{item.description}</Text>
            
            <View style={styles.metaInfo}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Condition</Text>
                <View style={[styles.conditionBadge, { 
                  backgroundColor: getConditionColor(item.condition) 
                }]}>
                  <Text style={styles.conditionText}>
                    {item.condition.replace('-', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Category</Text>
                <Text style={styles.metaValue}>{item.category}</Text>
              </View>
              
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Location</Text>
                <Text style={styles.metaValue}>📍 {item.location}</Text>
              </View>
              
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Posted</Text>
                <Text style={styles.metaValue}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      {!isOwnItem && isAvailable && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.watchButton}
            onPress={handleWatchToggle}
            activeOpacity={0.8}
          >
            <Text style={styles.watchButtonText}>
              {isWatched ? '⭐ Watching' : '☆ Watch'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={item.type === 'free' ? handleMessage : handleBarterOffer}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {item.type === 'free' ? '💬 Request Item' : '🔄 Make Offer'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isOwnItem && (
        <View style={styles.actionBar}>
          <Text style={styles.ownItemText}>This is your listing</Text>
        </View>
      )}

      {!isAvailable && (
        <View style={styles.actionBar}>
          <Text style={styles.unavailableText}>
            This item is no longer available
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const getConditionColor = (condition: string) => {
  switch (condition) {
    case 'new': return '#10B981';
    case 'like-new': return '#3B82F6';
    case 'good': return '#F59E0B';
    case 'fair': return '#F97316';
    case 'poor': return '#EF4444';
    default: return '#6B7280';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 32,
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
    width: width,
    height: width * 0.8,
    backgroundColor: '#000000',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '500',
  },
  headerActions: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  prevButton: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  imageIndicatorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    alignItems: 'flex-end',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
    lineHeight: 34,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  userRating: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  userChevron: {
    fontSize: 20,
    color: '#94A3B8',
    fontWeight: '300',
  },
  detailsSection: {
    gap: 20,
  },
  description: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    fontWeight: '400',
  },
  metaInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  watchButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  watchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  primaryButton: {
    flex: 2,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  ownItemText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
    fontStyle: 'italic',
  },
  unavailableText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});