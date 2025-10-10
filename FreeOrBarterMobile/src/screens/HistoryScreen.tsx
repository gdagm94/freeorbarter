import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';
import * as Haptics from 'expo-haptics';

interface HistoryItem {
  id: string;
  item_id: string;
  user_id: string;
  action: 'created' | 'viewed' | 'contacted' | 'watched' | 'unwatched';
  created_at: string;
  items: Item;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'created' | 'viewed' | 'contacted' | 'watched'>('all');

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, activeFilter]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) fetchHistory();
    });
    return unsubscribe;
  }, [navigation, user, activeFilter]);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      if (activeFilter === 'created') {
        // Fetch user's created items
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const historyData = (data || []).map(item => ({
          id: item.id,
          item_id: item.id,
          user_id: user.id,
          action: 'created' as const,
          created_at: item.created_at,
          items: item
        }));
        
        setHistory(historyData);
      } else {
        // Fetch other actions from activity_log or similar table
        // For now, we'll create a simple history based on watched items
        const { data, error } = await supabase
          .from('watched_items')
          .select(`
            *,
            items (*)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const historyData = (data || []).map(watch => ({
          id: watch.id,
          item_id: watch.item_id,
          user_id: user.id,
          action: 'watched' as const,
          created_at: watch.created_at,
          items: watch.items
        }));
        
        setHistory(historyData);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'created': return 'Created listing';
      case 'viewed': return 'Viewed item';
      case 'contacted': return 'Contacted seller';
      case 'watched': return 'Added to watchlist';
      case 'unwatched': return 'Removed from watchlist';
      default: return 'Action';
    }
  };

  const getActionEmoji = (action: string) => {
    switch (action) {
      case 'created': return '✨';
      case 'viewed': return '👁️';
      case 'contacted': return '💬';
      case 'watched': return '⭐';
      case 'unwatched': return '❌';
      default: return '';
    }
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity 
      style={styles.historyItem}
      onPress={() => navigation.navigate('ItemDetails', { itemId: item.item_id })}
      activeOpacity={0.8}
    >
      <View style={styles.historyContent}>
        <View style={styles.actionInfo}>
          <Text style={styles.actionEmoji}>{getActionEmoji(item.action)}</Text>
          <View style={styles.actionDetails}>
            <Text style={styles.actionText}>{getActionText(item.action)}</Text>
            <Text style={styles.actionTime}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        <View style={styles.itemInfo}>
          {item.items.images && item.items.images.length > 0 ? (
            <Image 
              source={{ uri: item.items.images[0] }} 
              style={styles.itemThumbnail}
            />
          ) : (
            <View style={styles.placeholderThumbnail}>
              <Text style={styles.placeholderText}>📷</Text>
            </View>
          )}
          <View style={styles.itemText}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.items.title}
            </Text>
            <Text style={styles.itemType}>
              {item.items.type === 'free' ? '🎁 Free' : '🔄 Barter'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const filteredHistory = history.filter(item => 
    activeFilter === 'all' || item.action === activeFilter
  );

  const renderFilterTabs = () => (
    <View style={styles.filterContainerWrapper}>
      <View style={styles.filterContainer}>
        {[
          { key: 'all', label: 'All' },
          { key: 'created', label: 'Created' },
          { key: 'watched', label: 'Watched' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              activeFilter === filter.key && styles.activeFilterTab,
            ]}
            onPress={() => {
              setActiveFilter(filter.key as any);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterText,
              activeFilter === filter.key && styles.activeFilterText,
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.filterContainer}>
        {[
          { key: 'viewed', label: 'Viewed' },
          { key: 'contacted', label: 'Contacted' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterTab,
              activeFilter === filter.key && styles.activeFilterTab,
            ]}
            onPress={() => {
              setActiveFilter(filter.key as any);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterText,
              activeFilter === filter.key && styles.activeFilterText,
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
        >
          <Text style={styles.backButtonIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>
            {filteredHistory.length} {filteredHistory.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {renderFilterTabs()}

      <FlatList
        data={filteredHistory}
        renderItem={renderHistoryItem}
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
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>No history yet</Text>
              <Text style={styles.emptySubtext}>
                Your activity will appear here as you use the app
              </Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    width: 40,
    alignItems: 'center',
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
  },
  filterContainerWrapper: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activeFilterTab: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.3,
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  listContainer: {
    paddingVertical: 8,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  historyContent: {
    padding: 16,
  },
  actionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  actionDetails: {
    flex: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  actionTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
  },
  itemThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeholderText: {
    fontSize: 16,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  itemType: {
    fontSize: 12,
    color: '#64748B',
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
