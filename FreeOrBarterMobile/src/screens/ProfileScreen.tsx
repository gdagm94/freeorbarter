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
  FlatList,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Item } from '../types';
import ItemCard from '../components/ItemCard';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  created_at: string;
  zipcode: string | null;
  gender: string | null;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<'free' | 'barter'>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;

    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch user's items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

    } catch (error) {
      console.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const freeItems = items.filter(item => item.type === 'free');
  const barterItems = items.filter(item => item.type === 'barter');
  const activeItems = activeTab === 'free' ? freeItems : barterItems;

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            {profile?.avatar_url ? (
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
              <Text style={styles.profileName}>
                {profile?.username || user?.full_name || 'User'}
              </Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              <View style={styles.profileMeta}>
                <Text style={styles.profileRating}>
                  ⭐ {profile?.rating?.toFixed(1) || 'No ratings'}
                </Text>
                {profile?.zipcode && (
                  <Text style={styles.profileLocation}>
                    📍 {profile.zipcode}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('WatchedItems');
              }}
            >
              <Text style={styles.quickActionEmoji}>⭐</Text>
              <Text style={styles.quickActionText}>Watchlist</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('History');
              }}
            >
              <Text style={styles.quickActionEmoji}>📜</Text>
              <Text style={styles.quickActionText}>History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Navigate to settings when implemented
              }}
            >
              <Text style={styles.quickActionEmoji}>⚙️</Text>
              <Text style={styles.quickActionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Listings Section */}
        <View style={styles.listingsSection}>
          <Text style={styles.sectionTitle}>My Listings</Text>
          
          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'free' && styles.activeTab]}
              onPress={() => {
                setActiveTab('free');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.tabEmoji}>🎁</Text>
              <Text style={[styles.tabText, activeTab === 'free' && styles.activeTabText]}>
                Free ({freeItems.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'barter' && styles.activeTab]}
              onPress={() => {
                setActiveTab('barter');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.tabEmoji}>🔄</Text>
              <Text style={[styles.tabText, activeTab === 'barter' && styles.activeTabText]}>
                Barter ({barterItems.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Items Grid */}
          {activeItems.length > 0 ? (
            <FlatList
              data={activeItems}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.itemsGrid}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyListings}>
              <Text style={styles.emptyListingsEmoji}>
                {activeTab === 'free' ? '🎁' : '🔄'}
              </Text>
              <Text style={styles.emptyListingsText}>
                No {activeTab} items yet
              </Text>
              <Text style={styles.emptyListingsSubtext}>
                Tap the + button to create your first listing
              </Text>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity 
            style={styles.signOutButton} 
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
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
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748B',
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
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickAction: {
    alignItems: 'center',
    padding: 12,
  },
  quickActionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
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
    fontSize: 16,
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#1E293B',
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
    marginBottom: 4,
  },
  emptyListingsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  signOutSection: {
    padding: 16,
    paddingBottom: 32,
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});