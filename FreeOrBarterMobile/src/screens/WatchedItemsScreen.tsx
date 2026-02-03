import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { BackButton } from '../components/BackButton';

interface WatchedItem {
  id: string;
  item_id: string;
  user_id: string;
  created_at: string;
  item: {
    id: string;
    title: string;
    description: string;
    images: string[];
    condition: string;
    category: string;
    created_at: string;
    user_id: string;
    status: string;
    location: string;
    user: {
      username: string;
      avatar_url: string | null;
    };
  };
}

type SortOption = 'date_added' | 'alphabetical' | 'category' | 'condition';
type FilterOption = 'all' | 'available' | 'pending' | 'sold';

const WatchedItemsScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [watchedItems, setWatchedItems] = useState<WatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date_added');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWatchedItems();
    }
  }, [user]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) fetchWatchedItems();
    });
    return unsubscribe;
  }, [navigation, user]);

  const fetchWatchedItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('watched_items')
        .select(`
          *,
          item:items(
            *,
            user:users(username, avatar_url)
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWatchedItems(data || []);
    } catch (error) {
      console.error('Error fetching watched items:', error);
      Alert.alert('Error', 'Failed to load watched items');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWatchedItems();
    setRefreshing(false);
  };

  const handleSort = (option: SortOption) => {
    setSortBy(option);
    setShowSortModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFilter = (option: FilterOption) => {
    setFilterBy(option);
    setShowFilterModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getSortedAndFilteredItems = () => {
    let filtered = watchedItems;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        item.item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(item => item.item.status === filterBy);
    }

    // Apply sorting
    switch (sortBy) {
      case 'alphabetical':
        return filtered.sort((a, b) => a.item.title.localeCompare(b.item.title));
      case 'category':
        return filtered.sort((a, b) => a.item.category.localeCompare(b.item.category));
      case 'condition':
        return filtered.sort((a, b) => a.item.condition.localeCompare(b.item.condition));
      case 'date_added':
      default:
        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  };

  const handleItemPress = (item: WatchedItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      (navigation as any).navigate('ItemDetails', { itemId: item.item.id });
    }
  };

  const handleLongPress = (item: WatchedItem) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedItems([item.id]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBatchAction = async (action: 'remove' | 'mark_sold') => {
    if (selectedItems.length === 0) return;

    try {
      if (action === 'remove') {
        const { error } = await supabase
          .from('watched_items')
          .delete()
          .in('id', selectedItems);

        if (error) throw error;
        Alert.alert('Success', 'Items removed from watchlist');
      }

      setSelectedItems([]);
      setIsSelectionMode(false);
      await fetchWatchedItems();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error performing batch action:', error);
      Alert.alert('Error', 'Failed to perform action');
    }
  };

  const getSortIcon = (option: SortOption) => {
    switch (option) {
      case 'date_added': return '📅';
      case 'alphabetical': return '🔤';
      case 'category': return '📂';
      case 'condition': return '⭐';
      default: return '📅';
    }
  };

  const getFilterIcon = (option: FilterOption) => {
    switch (option) {
      case 'all': return '📋';
      case 'available': return '✅';
      case 'pending': return '⏳';
      case 'sold': return '💰';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'sold': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return '✅';
      case 'pending': return '⏳';
      case 'sold': return '💰';
      default: return '❓';
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateEmoji}>👀</Text>
      <Text style={styles.emptyStateTitle}>No Watched Items</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start watching items to see them here
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => (navigation as any).navigate('Home')}
      >
        <Text style={styles.exploreButtonText}>Explore Items</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: { item: WatchedItem }) => {
    const isSelected = selectedItems.includes(item.id);
    const statusColor = getStatusColor(item.item.status);
    const statusIcon = getStatusIcon(item.item.status);

    return (
      <TouchableOpacity
        style={[
          styles.itemCard,
          isSelected && styles.selectedItemCard,
          isSelectionMode && styles.selectionModeCard
        ]}
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.7}
      >
        {isSelectionMode && (
          <View style={styles.selectionIndicator}>
            <View style={[
              styles.selectionCircle,
              isSelected && styles.selectedCircle
            ]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        )}

        <Image
          source={{ uri: item.item.images?.[0] || 'https://via.placeholder.com/150' }}
          style={styles.itemImage}
          resizeMode="cover"
        />

        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.item.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusIcon}>{statusIcon}</Text>
              <Text style={styles.statusText}>{item.item.status}</Text>
            </View>
          </View>

          <Text style={styles.itemCategory}>{item.item.category}</Text>

          <View style={styles.itemMeta}>
            <Text style={styles.itemCondition}>{item.item.condition}</Text>
            <Text style={styles.itemLocation}>
              📍 {item.item.location}
            </Text>
          </View>

          <View style={styles.itemFooter}>
            <View style={styles.userInfo}>
              <Image
                source={{ uri: item.item.user.avatar_url || 'https://via.placeholder.com/30' }}
                style={styles.userAvatar}
              />
              <Text style={styles.username}>{item.item.user.username}</Text>
            </View>
            <Text style={styles.watchDate}>
              Added {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const sortedAndFilteredItems = getSortedAndFilteredItems();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading your watchlist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <BackButton style={styles.backButton} />
        <View style={styles.headerContent}>
          <Text style={styles.title}>Watchlist</Text>
          <Text style={styles.subtitle}>
            {sortedAndFilteredItems.length} {sortedAndFilteredItems.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search and Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search your watchlist..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowSortModal(true)}
          >
            <Text style={styles.controlButtonIcon}>{getSortIcon(sortBy)}</Text>
            <Text style={styles.controlButtonText}>Sort</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Text style={styles.controlButtonIcon}>{getFilterIcon(filterBy)}</Text>
            <Text style={styles.controlButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selection Mode Controls */}
      {isSelectionMode && (
        <View style={styles.selectionControls}>
          <TouchableOpacity
            style={styles.selectionAction}
            onPress={() => handleBatchAction('remove')}
          >
            <Text style={styles.selectionActionText}>Remove Selected</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.selectionCancel}
            onPress={() => {
              setIsSelectionMode(false);
              setSelectedItems([]);
            }}
          >
            <Text style={styles.selectionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Items List */}
      {sortedAndFilteredItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={sortedAndFilteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            {(['date_added', 'alphabetical', 'category', 'condition'] as SortOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.modalOption,
                  sortBy === option && styles.selectedModalOption
                ]}
                onPress={() => handleSort(option)}
              >
                <Text style={styles.modalOptionIcon}>{getSortIcon(option)}</Text>
                <Text style={[
                  styles.modalOptionText,
                  sortBy === option && styles.selectedModalOptionText
                ]}>
                  {option.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                {sortBy === option && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSortModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter By</Text>
            {(['all', 'available', 'pending', 'sold'] as FilterOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.modalOption,
                  filterBy === option && styles.selectedModalOption
                ]}
                onPress={() => handleFilter(option)}
              >
                <Text style={styles.modalOptionIcon}>{getFilterIcon(option)}</Text>
                <Text style={[
                  styles.modalOptionText,
                  filterBy === option && styles.selectedModalOptionText
                ]}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
                {filterBy === option && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

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
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    minWidth: 80,
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
  controlsContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 100,
    justifyContent: 'center',
  },
  controlButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  controlButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  selectionControls: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionAction: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectionActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  selectionCancel: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  selectionCancelText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    padding: 20,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  selectedItemCard: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  selectionModeCard: {
    opacity: 0.9,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 1,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F1F5F9',
  },
  itemContent: {
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  itemCategory: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemCondition: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  itemLocation: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    textAlign: 'right',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  username: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  watchDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  exploreButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedModalOption: {
    backgroundColor: '#EFF6FF',
  },
  modalOptionIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  selectedModalOptionText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  modalCloseButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
});

export default WatchedItemsScreen;