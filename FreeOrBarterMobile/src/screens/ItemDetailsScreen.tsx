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
  useWindowDimensions,
  Share,
  ViewStyle,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';
import * as Haptics from 'expo-haptics';
import { useDeviceInfo } from '../hooks/useDeviceInfo';
import { useResponsiveStyles, getResponsivePadding } from '../utils/responsive';
import {
  ReportContentSheet,
  ReportTargetPayload,
} from '../components/ReportContentSheet';
import { ImageViewer } from '../components/ImageViewer';

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
  const [reportTarget, setReportTarget] = useState<ReportTargetPayload | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState(1.25);
  const [isViewerVisible, setIsViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerIndexRef = React.useRef(0);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { itemId } = route.params || {};
  const { width } = useWindowDimensions();
  const { isTablet } = useDeviceInfo();
  const responsiveStyles = useResponsiveStyles();
  const padding = getResponsivePadding(isTablet);

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

  const openReportSheet = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to report content.');
      return;
    }

    if (!item) {
      Alert.alert('Error', 'Item not found');
      return;
    }

    setReportTarget({
      type: 'item',
      id: item.id,
      displayName: item.title,
      metadata: {
        owner_id: item.user_id,
        owner_username: item.users?.username,
      },
    });
  };

  useEffect(() => {
    const uri = item?.images?.[currentImageIndex];
    if (!uri) return;

    Image.getSize(
      uri,
      (width, height) => {
        if (!width || !height) return;
        const ratio = width / height;
        if (Number.isFinite(ratio) && ratio > 0) {
          setImageAspectRatio(ratio);
        }
      },
      () => setImageAspectRatio(1),
    );
  }, [item?.images, currentImageIndex]);

  const openImageViewer = (index: number) => {
    if (!item?.images?.length) return;
    setViewerIndex(index);
    viewerIndexRef.current = index;
    setIsViewerVisible(true);
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={[styles.topBar, { paddingHorizontal: padding }]}>
        <TouchableOpacity
          style={styles.topBarButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.topBarButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={handleShare}
            accessibilityLabel="Share listing"
          >
            <Text style={styles.topBarButtonText}>⤴</Text>
          </TouchableOpacity>
          {!isOwnItem && (
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={openReportSheet}
              accessibilityLabel="Report listing"
            >
              <Text style={styles.topBarButtonText}>⚑</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          responsiveStyles.contentContainer as ViewStyle,
          { paddingHorizontal: padding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Gallery */}
        <View style={[styles.imageContainer, { aspectRatio: imageAspectRatio }]}>
          <TouchableOpacity 
            style={styles.imageWrapper}
            onPress={() => openImageViewer(currentImageIndex)}
            activeOpacity={0.9}
          >
            {item.images && item.images.length > 0 ? (
              <Image 
                source={{ uri: item.images[currentImageIndex] }} 
                style={styles.image}
                resizeMode="contain"
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
              <TouchableOpacity
                style={styles.prevButton}
                onPress={prevImage}
                accessibilityLabel="Previous photo"
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={nextImage}
                accessibilityLabel="Next photo"
              >
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </>
          )}

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

        {item.images.length > 1 && (
          <View style={styles.inlineIndicator}>
            <Text style={styles.inlineIndicatorText}>
              {currentImageIndex + 1} / {item.images.length}
            </Text>
            <View style={styles.dotsRow}>
              {item.images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentImageIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

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
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('ManageListing', { item });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.manageButtonText}>⚙️ Manage Listing</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isAvailable && (
        <View style={styles.actionBar}>
          <Text style={styles.unavailableText}>
            This item is no longer available
          </Text>
        </View>
      )}

      <ReportContentSheet
        visible={!!reportTarget}
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />

      {item.images?.length > 0 && (
        <ImageViewer
          visible={isViewerVisible}
          images={item.images}
          initialIndex={viewerIndex}
          onIndexChange={(index) => {
            viewerIndexRef.current = index;
          }}
          onClose={() => {
            setIsViewerVisible(false);
            setCurrentImageIndex(viewerIndexRef.current);
            setViewerIndex(viewerIndexRef.current);
          }}
        />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  topBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarButtonText: {
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '700',
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
    width: '100%',
    marginHorizontal: 'auto',
    backgroundColor: '#000000',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
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
  prevButton: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
  },
  badgeContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
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
  inlineIndicator: {
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  inlineIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    backgroundColor: '#0EA5E9',
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
  manageButton: {
    flex: 1,
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
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  unavailableText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});