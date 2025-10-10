import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Item } from '../types';
import * as Haptics from 'expo-haptics';

export default function BarterOfferScreen() {
  const [targetItem, setTargetItem] = useState<Item | null>(null);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { itemId } = route.params || {};

  useEffect(() => {
    if (itemId) {
      fetchData();
    }
  }, [itemId]);

  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (itemId) fetchData();
    });
    return unsubscribe;
  }, [navigation, itemId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching data - User:', user);
      console.log('User ID:', user?.id);
      console.log('Item ID:', itemId);
      
      if (!user) {
        console.log('WARNING: User is not available!');
      }
      
      // Fetch both in parallel
      const [targetResult, userItemsResult] = await Promise.all([
        // Fetch target item
        supabase
          .from('items')
          .select('*')
          .eq('id', itemId)
          .single(),
        
        // Fetch user's barter items (only barter type items can be offered)
        user
          ? supabase
              .from('items')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null })
      ]);

      console.log('Target result:', targetResult);
      console.log('User items result:', userItemsResult);

      if (targetResult.error) {
        console.error('Error fetching target item:', targetResult.error);
        return;
      }

      if (userItemsResult.error) {
        console.error('Error fetching user items:', userItemsResult.error);
      }

      // Set all state at once
      setTargetItem(targetResult.data);
      setUserItems(userItemsResult.data || []);
      
      console.log('Setting userItems state with:', userItemsResult.data?.length || 0, 'items');
      console.log('Items being set:', userItemsResult.data);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOffer = async () => {
    if (!selectedItem || !message.trim() || !user || !targetItem) {
      Alert.alert('Missing Information', 'Please select an item and add a message');
      return;
    }

    const selectedItemData = userItems.find(item => item.id === selectedItem);
    if (!selectedItemData) {
      Alert.alert('Error', 'Selected item not found');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const offerData = {
        sender_id: user.id,
        receiver_id: targetItem.user_id,
        offered_item_id: selectedItem,
        requested_item_id: itemId,
        message: message.trim(),
        status: 'pending',
      };

      console.log('Submitting barter offer:', offerData);

      const result = await supabase
        .from('barter_offers')
        .insert([offerData])
        .select();

      console.log('Insert result:', result);

      if (result.error) {
        console.error('Error creating barter offer:', result.error);
        console.error('Error code:', result.error.code);
        console.error('Error message:', result.error.message);
        console.error('Error details:', result.error.details);
        console.error('Error hint:', result.error.hint);
        Alert.alert('Error', result.error.message || 'Failed to submit barter offer. Please check if you have permission.');
        return;
      }

      console.log('Barter offer created successfully:', result.data);

      // Create a message in the thread about this offer
      const offerMessage = `🔄 Barter Offer: I'd like to trade my "${selectedItemData?.title}" for your "${targetItem.title}".\n\nMessage: ${message.trim()}`;
      
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          sender_id: user.id,
          receiver_id: targetItem.user_id,
          content: offerMessage,
          item_id: itemId,
          offer_item_id: selectedItem,
          is_offer: true,
          read: false,
        }]);

      if (messageError) {
        console.error('Error creating message:', messageError);
        // Don't fail the whole operation if message creation fails
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success!', 'Your barter offer has been sent', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error submitting barter offer:', error);
      Alert.alert('Error', 'Failed to submit barter offer');
    } finally {
      setSubmitting(false);
    }
  };

  const renderUserItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        selectedItem === item.id && styles.selectedItemCard
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedItem(item.id);
      }}
      activeOpacity={0.7}
    >
      {selectedItem === item.id && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓ Selected</Text>
        </View>
      )}
      {item.images && item.images.length > 0 ? (
        <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>📦</Text>
        </View>
      )}
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemCondition}>
          {item.condition} • {item.category}
        </Text>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Make Offer</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedItemData = userItems.find(item => item.id === selectedItem);

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
        <Text style={styles.headerTitle}>Make Offer</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Target Item - What they want */}
        {targetItem && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>🎯 You want to trade for:</Text>
            <View style={styles.targetItemCard}>
              {targetItem.images && targetItem.images.length > 0 ? (
                <Image source={{ uri: targetItem.images[0] }} style={styles.targetItemImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Text style={styles.placeholderEmoji}>📦</Text>
                </View>
              )}
              <View style={styles.targetItemInfo}>
                <Text style={styles.targetItemTitle} numberOfLines={1}>{targetItem.title}</Text>
                <Text style={styles.targetItemMeta}>
                  {targetItem.condition} • {targetItem.category}
                </Text>
                <Text style={styles.targetItemDescription} numberOfLines={2}>
                  {targetItem.description}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* User's Items - What they can offer */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>🔄 Select your item to offer:</Text>
          {userItems.length > 0 ? (
            <FlatList
              data={userItems}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.itemsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>No items to offer</Text>
              <Text style={styles.emptySubtitle}>You need to have listed items to make a barter offer</Text>
              <TouchableOpacity 
                style={styles.addItemButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate('NewListing');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.addItemButtonText}>➕ Add an Item</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Message Section */}
        {userItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>💬 Your message:</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Explain why you want to trade and any details about your offer..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>
              {message.length} characters
            </Text>
          </View>
        )}

        {/* Selected Item Summary */}
        {selectedItemData && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>📋 Offer Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You're offering:</Text>
                <Text style={styles.summaryValue}>{selectedItemData.title}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>In exchange for:</Text>
                <Text style={styles.summaryValue}>{targetItem?.title}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Submit Button - Fixed at bottom */}
      {userItems.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[
              styles.submitButton,
              (!selectedItem || !message.trim() || submitting) && styles.submitButtonDisabled
            ]}
            onPress={handleSubmitOffer}
            disabled={!selectedItem || !message.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                🔄 Submit Barter Offer
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  },
  backButtonText: {
    fontSize: 24,
    color: '#3B82F6',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  targetItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  targetItemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  placeholderText: {
    fontSize: 24,
  },
  targetItemInfo: {
    flex: 1,
  },
  targetItemTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  targetItemMeta: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 6,
  },
  targetItemDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedItemCard: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
    shadowOpacity: 0.15,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  itemCondition: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  addItemButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  messageInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    minHeight: 120,
    textAlignVertical: 'top',
    fontWeight: '500',
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
  },
  summarySection: {
    padding: 16,
    paddingBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    marginVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
