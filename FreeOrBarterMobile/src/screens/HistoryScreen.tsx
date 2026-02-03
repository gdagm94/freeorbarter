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
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';
import * as Haptics from 'expo-haptics';
import { BackButton } from '../components/BackButton';

interface HistoryEntry {
  id: string;
  action_type: 'created' | 'edited' | 'deleted';
  item_id: string | null;
  item_title: string;
  item_description: string | null;
  item_images: string[];
  item_category: string;
  item_condition: string;
  item_type: string;
  changes: any;
  created_at: string;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [archivedItems, setArchivedItems] = useState<Item[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'archived' | 'history'>('archived');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) fetchData();
    });
    return unsubscribe;
  }, [navigation, user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch archived items (completed trades)
      const { data: archivedData, error: archivedError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['traded', 'claimed'])
        .order('created_at', { ascending: false });

      if (archivedError) throw archivedError;

      // Fetch history entries
      const { data: historyData, error: historyError } = await supabase
        .from('user_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;

      setArchivedItems(archivedData || []);
      setHistoryEntries(historyData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getActionText = (actionType: string) => {
    switch (actionType) {
      case 'created': return 'Created listing';
      case 'edited': return 'Edited listing';
      case 'deleted': return 'Deleted listing';
      default: return 'Action';
    }
  };

  const getActionEmoji = (actionType: string) => {
    switch (actionType) {
      case 'created': return '✨';
      case 'edited': return '✏️';
      case 'deleted': return '🗑️';
      default: return '';
    }
  };

  const renderHistoryItem = ({ item }: { item: HistoryEntry }) => (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => item.item_id && navigation.navigate('ItemDetails', { itemId: item.item_id })}
      activeOpacity={0.8}
    >
      <View style={styles.historyContent}>
        <View style={styles.actionInfo}>
          <Text style={styles.actionEmoji}>{getActionEmoji(item.action_type)}</Text>
          <View style={styles.actionDetails}>
            <Text style={styles.actionText}>{getActionText(item.action_type)}</Text>
            <Text style={styles.actionTime}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.itemInfo}>
          {item.item_images && item.item_images.length > 0 ? (
            <Image
              source={{ uri: item.item_images[0] }}
              style={styles.itemThumbnail}
            />
          ) : (
            <View style={styles.placeholderThumbnail}>
              <Text style={styles.placeholderText}>📷</Text>
            </View>
          )}
          <View style={styles.itemText}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.item_title}
            </Text>
            <Text style={styles.itemType}>
              {item.item_type === 'free' ? '🎁 Free' : '🔄 Barter'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'archived' && styles.activeTabButton,
        ]}
        onPress={() => {
          setActiveTab('archived');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.tabText,
          activeTab === 'archived' && styles.activeTabText,
        ]}>
          Completed Trades ({archivedItems.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'history' && styles.activeTabButton,
        ]}
        onPress={() => {
          setActiveTab('history');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.tabText,
          activeTab === 'history' && styles.activeTabText,
        ]}>
          All Activity ({historyEntries.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <BackButton style={styles.backButton} />
        <View style={styles.headerContent}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>
            {activeTab === 'archived'
              ? `${archivedItems.length} completed trades`
              : `${historyEntries.length} activities`
            }
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {renderTabButtons()}

      {activeTab === 'archived' ? (
        <FlatList
          data={archivedItems}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              onPress={() => navigation.navigate('ItemDetails', { itemId: item.id })}
            />
          )}
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
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={styles.emptyText}>No completed trades</Text>
                <Text style={styles.emptySubtext}>
                  Items that have been traded or claimed will appear here
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={historyEntries}
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
                <Text style={styles.emptyText}>No activity yet</Text>
                <Text style={styles.emptySubtext}>
                  Your listing activity will appear here
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
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
